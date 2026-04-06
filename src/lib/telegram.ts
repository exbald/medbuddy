import { generateText } from "ai"
import { and, eq, gte, lt, lte, like } from "drizzle-orm"
import { Bot, InlineKeyboard } from "grammy"
import { defaultModel } from "@/lib/ai"
import { buildSystemPrompt } from "@/lib/chat-prompt"
import { getTimeSlot, getTaipeiToday } from "@/lib/constants"
import { db } from "@/lib/db"
import {
  adherenceLog,
  chatMessage,
  medication,
  user,
  verification,
} from "@/lib/schema"
import { upload } from "@/lib/storage"

// ---------------------------------------------------------------------------
// Bot instance (lazy-initialized, singleton across serverless invocations)
// ---------------------------------------------------------------------------

let _bot: Bot | null = null

/**
 * Returns the shared Bot instance, creating it on first call.
 * This avoids crashing the server at module-load time when
 * TELEGRAM_BOT_TOKEN is not configured (e.g. non-Telegram deployments).
 */
export function getBot(): Bot {
  if (!_bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN environment variable is not set")
    }
    _bot = new Bot(token)
    registerHandlers(_bot)
  }
  return _bot
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a Telegram chat ID to a user row. Returns null if unlinked. */
async function findUserByChatId(chatId: string) {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      locale: user.locale,
    })
    .from(user)
    .where(eq(user.telegramChatId, chatId))
    .limit(1)
  return row ?? null
}

/** Fetch active medications for a user. */
async function fetchUserMeds(userId: string) {
  return db
    .select({
      name: medication.name,
      nameLocal: medication.nameLocal,
      dosage: medication.dosage,
      purpose: medication.purpose,
      timing: medication.timing,
    })
    .from(medication)
    .where(and(eq(medication.userId, userId), eq(medication.active, true)))
}

/** Fetch 7-day adherence summary for system prompt context. */
async function fetchAdherenceSummary(userId: string) {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const now = new Date()

  const recentLogs = await db
    .select({ status: adherenceLog.status })
    .from(adherenceLog)
    .where(
      and(
        eq(adherenceLog.userId, userId),
        gte(adherenceLog.scheduledAt, sevenDaysAgo),
        lte(adherenceLog.scheduledAt, now),
      ),
    )

  return {
    taken: recentLogs.filter((l) => l.status === "taken").length,
    missed: recentLogs.filter((l) => l.status === "missed").length,
    pending: recentLogs.filter((l) => l.status === "pending").length,
    total: recentLogs.length,
  }
}

/** Status to emoji mapping. */
const STATUS_EMOJI: Record<string, string> = {
  taken: "\u2705",
  pending: "\u23F3",
  missed: "\u274C",
  skipped: "\u23ED\uFE0F",
}

// ---------------------------------------------------------------------------
// Handler registration (called once when the bot is first created)
// ---------------------------------------------------------------------------

function registerHandlers(bot: Bot) {
  // -------------------------------------------------------------------------
  // /start <code> — Account linking
  // -------------------------------------------------------------------------

  bot.command("start", async (ctx) => {
    const code = ctx.match?.trim()
    if (!code || code === "welcome") {
      const welcome = [
        "\u{1F44B} \u6B61\u8FCE\u4F86\u5230 MedBuddy \u85E5\u597D\u53CB\uFF01",
        "",
        "\u6211\u53EF\u4EE5\u5E6B\u4F60\uFF1A",
        "\u{1F4CA} \u67E5\u770B\u4ECA\u65E5\u7528\u85E5\u6642\u9593\u8868",
        "\u{1F514} \u5B9A\u6642\u63D0\u9192\u5403\u85E5",
        "\u2705 \u4E00\u9375\u78BA\u8A8D\u670D\u85E5",
        "\u{1F4AC} \u56DE\u7B54\u85E5\u7269\u76F8\u95DC\u554F\u984C",
        "",
        "\u{1F449} \u5148\u8A3B\u518A\u5E33\u865F\uFF0C\u518D\u56DE\u4F86\u9023\u7D50 Telegram\uFF01",
      ].join("\n")

      const kb = new InlineKeyboard()
        .url("\u{1F4F1} \u8A3B\u518A\u5E33\u865F", "https://medbuddy.zerodraft.dev/zh-TW/register")
        .row()
        .url("\u{1F517} \u5DF2\u6709\u5E33\u865F\uFF1F\u767B\u5165\u9023\u7D50", "https://medbuddy.zerodraft.dev/zh-TW/profile")

      await ctx.reply(welcome, { reply_markup: kb })
      return
    }

    // Look up the one-time linking code in the verification table
    const [verificationRow] = await db
      .select({
        id: verification.id,
        identifier: verification.identifier,
        expiresAt: verification.expiresAt,
      })
      .from(verification)
      .where(
        and(
          like(verification.identifier, "telegram-link:%"),
          eq(verification.value, code),
        ),
      )
      .limit(1)

    if (!verificationRow) {
      await ctx.reply(
        "Invalid or expired code. Please generate a new one from the MedBuddy app.",
      )
      return
    }

    // Check expiry
    if (verificationRow.expiresAt < new Date()) {
      await db
        .delete(verification)
        .where(eq(verification.id, verificationRow.id))
      await ctx.reply(
        "This code has expired. Please generate a new one from the MedBuddy app.",
      )
      return
    }

    // Extract userId from the identifier (format: "telegram-link:<userId>")
    const userId = verificationRow.identifier.replace("telegram-link:", "")
    const chatId = ctx.from?.id?.toString()
    if (!chatId) {
      await ctx.reply(
        "Unable to determine your Telegram ID. Please try again.",
      )
      return
    }

    // Link the account
    await db
      .update(user)
      .set({ telegramChatId: chatId })
      .where(eq(user.id, userId))

    // Delete the used verification code
    await db
      .delete(verification)
      .where(eq(verification.id, verificationRow.id))

    await ctx.reply(
      "\u2705 Your Telegram account is now linked to MedBuddy! You can use /meds to check today's medications.",
    )
  })

  // -------------------------------------------------------------------------
  // /meds — Today's adherence summary
  // -------------------------------------------------------------------------

  bot.command("meds", async (ctx) => {
    const chatId = ctx.from?.id?.toString()
    if (!chatId) return

    const userRow = await findUserByChatId(chatId)
    if (!userRow) {
      await ctx.reply(
        "Your Telegram account is not linked. Use /start <code> with a code from the MedBuddy app.",
      )
      return
    }

    const { todayStart, todayEnd } = getTaipeiToday()

    const todaysLogs = await db
      .select({
        logId: adherenceLog.id,
        scheduledAt: adherenceLog.scheduledAt,
        status: adherenceLog.status,
        medName: medication.name,
        medNameLocal: medication.nameLocal,
        medDosage: medication.dosage,
      })
      .from(adherenceLog)
      .innerJoin(medication, eq(adherenceLog.medicationId, medication.id))
      .where(
        and(
          eq(adherenceLog.userId, userRow.id),
          gte(adherenceLog.scheduledAt, todayStart),
          lt(adherenceLog.scheduledAt, todayEnd),
        ),
      )
      .orderBy(adherenceLog.scheduledAt)

    if (todaysLogs.length === 0) {
      await ctx.reply("No medications scheduled for today.")
      return
    }

    // Group by time slot for display
    const grouped: Record<string, typeof todaysLogs> = {}
    for (const log of todaysLogs) {
      const slot = getTimeSlot(log.scheduledAt)
      if (!grouped[slot]) {
        grouped[slot] = []
      }
      grouped[slot].push(log)
    }

    const slotLabels: Record<string, string> = {
      morning: "\uD83C\uDF05 Morning",
      afternoon: "\u2600\uFE0F Afternoon",
      evening: "\uD83C\uDF06 Evening",
      bedtime: "\uD83C\uDF19 Bedtime",
    }

    const slotOrder = ["morning", "afternoon", "evening", "bedtime"]
    const lines: string[] = ["\uD83D\uDC8A Today's Medications\n"]

    for (const slot of slotOrder) {
      const logs = grouped[slot]
      if (!logs || logs.length === 0) continue
      lines.push(`${slotLabels[slot] ?? slot}`)
      for (const log of logs) {
        const emoji = STATUS_EMOJI[log.status] ?? "\u2753"
        const name = log.medNameLocal ?? log.medName
        const dosage = log.medDosage ? ` (${log.medDosage})` : ""
        lines.push(`  ${emoji} ${name}${dosage}`)
      }
      lines.push("")
    }

    // Build inline keyboard for pending items
    const keyboard = new InlineKeyboard()
    let hasPending = false
    for (const log of todaysLogs) {
      if (log.status === "pending") {
        hasPending = true
        const label = log.medNameLocal ?? log.medName
        keyboard
          .text(`\u2705 ${label}`, `taken:${log.logId}`)
          .text(`\u23ED\uFE0F Skip`, `skip:${log.logId}`)
          .row()
      }
    }

    if (hasPending) {
      await ctx.reply(lines.join("\n"), { reply_markup: keyboard })
    } else {
      await ctx.reply(lines.join("\n"))
    }
  })

  // -------------------------------------------------------------------------
  // Inline button callbacks: taken:<logId> / skip:<logId>
  // -------------------------------------------------------------------------

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data
    if (!data) return

    const chatId = ctx.from?.id?.toString()
    if (!chatId) return

    const userRow = await findUserByChatId(chatId)
    if (!userRow) {
      await ctx.answerCallbackQuery({ text: "Account not linked." })
      return
    }

    // Parse callback data
    const [action, logId] = data.split(":")
    if (!action || !logId) {
      await ctx.answerCallbackQuery({ text: "Invalid action." })
      return
    }

    if (action !== "taken" && action !== "skip") {
      await ctx.answerCallbackQuery({ text: "Unknown action." })
      return
    }

    const newStatus = action === "taken" ? "taken" : "skipped"

    // Verify the log belongs to this user
    const [existing] = await db
      .select({ id: adherenceLog.id, status: adherenceLog.status })
      .from(adherenceLog)
      .where(
        and(eq(adherenceLog.id, logId), eq(adherenceLog.userId, userRow.id)),
      )
      .limit(1)

    if (!existing) {
      await ctx.answerCallbackQuery({ text: "Log not found." })
      return
    }

    const updateData: { status: string; takenAt?: Date; source: string } = {
      status: newStatus,
      source: "telegram",
    }
    if (newStatus === "taken") {
      updateData.takenAt = new Date()
    }

    await db
      .update(adherenceLog)
      .set(updateData)
      .where(eq(adherenceLog.id, logId))

    const emoji = newStatus === "taken" ? "\u2705" : "\u23ED\uFE0F"
    await ctx.answerCallbackQuery({
      text: `${emoji} Marked as ${newStatus}!`,
    })

    // Update the message to reflect the change
    try {
      await ctx.editMessageText(
        `${emoji} Dose marked as ${newStatus}. Use /meds to see your full schedule.`,
      )
    } catch {
      // Message might not be editable; ignore
    }
  })

  // -------------------------------------------------------------------------
  // Free-text messages: Forward to AI chat
  // -------------------------------------------------------------------------

  bot.on("message:text", async (ctx) => {
    const chatId = ctx.from?.id?.toString()
    if (!chatId) return

    const userRow = await findUserByChatId(chatId)
    if (!userRow) {
      await ctx.reply(
        "Your Telegram account is not linked. Use /start <code> with a code from the MedBuddy app.",
      )
      return
    }

    const userText = ctx.message.text
    if (!userText || userText.trim().length === 0) return

    // Persist the user message
    await db.insert(chatMessage).values({
      userId: userRow.id,
      role: "user",
      content: userText,
      source: "telegram",
    })

    // Build context for the AI
    const [meds, adherenceSummary] = await Promise.all([
      fetchUserMeds(userRow.id),
      fetchAdherenceSummary(userRow.id),
    ])

    const systemPrompt = buildSystemPrompt(
      meds,
      adherenceSummary,
      userRow.locale ?? "zh-TW",
    )

    try {
      const result = await generateText({
        model: defaultModel,
        system: systemPrompt,
        messages: [{ role: "user", content: userText }],
      })

      const responseText =
        result.text || "Sorry, I could not generate a response."

      // Persist the assistant reply
      await db.insert(chatMessage).values({
        userId: userRow.id,
        role: "assistant",
        content: responseText,
        source: "telegram",
      })

      await ctx.reply(responseText)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error"
      console.error("Telegram AI chat error:", errorMessage)
      await ctx.reply(
        "Sorry, I'm having trouble right now. Please try again later.",
      )
    }
  })

  // -------------------------------------------------------------------------
  // Photo messages: Forward image (and optional caption) to AI chat
  // -------------------------------------------------------------------------

  bot.on("message:photo", async (ctx) => {
    const chatId = ctx.from?.id?.toString()
    if (!chatId) return

    const userRow = await findUserByChatId(chatId)
    if (!userRow) {
      await ctx.reply(
        "Your Telegram account is not linked. Use /start <code> with a code from the MedBuddy app.",
      )
      return
    }

    const caption = ctx.message.caption?.trim() ?? ""

    try {
      // Telegram returns multiple photo sizes; the last is the largest
      const file = await ctx.getFile()
      const token = process.env.TELEGRAM_BOT_TOKEN
      if (!token || !file.file_path) {
        throw new Error("Missing bot token or file path")
      }

      const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`
      const response = await fetch(downloadUrl)
      if (!response.ok) {
        throw new Error(`Failed to download Telegram file: ${response.status}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Upload to our storage so the URL is stable + persistable
      const ext = file.file_path.split(".").pop() || "jpg"
      const filename = `tg-${userRow.id}-${Date.now()}.${ext}`
      const uploaded = await upload(buffer, filename, "chat-images", {
        maxSize: 10 * 1024 * 1024,
      })

      // Persist the user message with image URL
      await db.insert(chatMessage).values({
        userId: userRow.id,
        role: "user",
        content: caption,
        imageUrl: uploaded.url,
        source: "telegram",
      })

      // Build context for the AI
      const [meds, adherenceSummary] = await Promise.all([
        fetchUserMeds(userRow.id),
        fetchAdherenceSummary(userRow.id),
      ])

      const systemPrompt = buildSystemPrompt(
        meds,
        adherenceSummary,
        userRow.locale ?? "zh-TW",
      )

      const userPrompt =
        caption ||
        (userRow.locale === "en"
          ? "Please analyze this image. If it shows medication or a prescription, identify it and provide relevant information."
          : "\u8ACB\u5E6B\u6211\u5206\u6790\u9019\u5F35\u5716\u7247\u3002\u5982\u679C\u662F\u85E5\u7269\u6216\u8655\u65B9\u7B7A\uFF0C\u8ACB\u8FA8\u8B58\u4E26\u63D0\u4F9B\u76F8\u95DC\u8CC7\u8A0A\u3002")

      const result = await generateText({
        model: defaultModel,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image", image: buffer },
            ],
          },
        ],
      })

      const responseText =
        result.text || "Sorry, I could not analyze that image."

      await db.insert(chatMessage).values({
        userId: userRow.id,
        role: "assistant",
        content: responseText,
        source: "telegram",
      })

      await ctx.reply(responseText)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error"
      const stack = error instanceof Error ? error.stack : ""
      console.error("Telegram photo handler error:", errorMessage, stack)
      await ctx.reply(`\u26A0\uFE0F Image error: ${errorMessage}`)
    }
  })
}
