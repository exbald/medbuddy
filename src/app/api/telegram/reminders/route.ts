import { NextResponse } from "next/server"
import { and, eq, gte, lt, isNotNull } from "drizzle-orm"
import { InlineKeyboard } from "grammy"
import { getCurrentTimeSlot, getTimeSlot, getTaipeiToday } from "@/lib/constants"
import { db } from "@/lib/db"
import { adherenceLog, medication, user } from "@/lib/schema"
import { getBot } from "@/lib/telegram"

/**
 * GET /api/telegram/reminders
 *
 * Called by an external cron service to send Telegram reminders.
 * Protected by a required CRON_SECRET bearer token.
 */
export async function GET(req: Request) {
  // Require CRON_SECRET — default-deny if not configured
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("CRON_SECRET is not configured")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const authHeader = req.headers.get("authorization")
  const token = authHeader?.replace("Bearer ", "")
  if (token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { todayStart, todayEnd } = getTaipeiToday()
  const currentSlot = getCurrentTimeSlot()

  // Find all users with a linked Telegram account
  const linkedUsers = await db
    .select({
      id: user.id,
      name: user.name,
      locale: user.locale,
      telegramChatId: user.telegramChatId,
    })
    .from(user)
    .where(isNotNull(user.telegramChatId))

  if (linkedUsers.length === 0) {
    return NextResponse.json({ sent: 0, message: "No linked users" })
  }

  let sentCount = 0

  for (const linkedUser of linkedUsers) {
    if (!linkedUser.telegramChatId) continue

    // Fetch today's pending logs for the current time slot
    const pendingLogs = await db
      .select({
        logId: adherenceLog.id,
        scheduledAt: adherenceLog.scheduledAt,
        medName: medication.name,
        medNameLocal: medication.nameLocal,
        medDosage: medication.dosage,
      })
      .from(adherenceLog)
      .innerJoin(medication, eq(adherenceLog.medicationId, medication.id))
      .where(
        and(
          eq(adherenceLog.userId, linkedUser.id),
          eq(adherenceLog.status, "pending"),
          gte(adherenceLog.scheduledAt, todayStart),
          lt(adherenceLog.scheduledAt, todayEnd),
        ),
      )
      .orderBy(adherenceLog.scheduledAt)

    // Filter to only the current time slot using the shared classifier
    const slotLogs = pendingLogs.filter(
      (log) => getTimeSlot(log.scheduledAt) === currentSlot,
    )

    if (slotLogs.length === 0) continue

    // Build the reminder message
    const slotLabels: Record<string, string> = {
      morning: "\uD83C\uDF05 Morning",
      afternoon: "\u2600\uFE0F Afternoon",
      evening: "\uD83C\uDF06 Evening",
      bedtime: "\uD83C\uDF19 Bedtime",
    }

    const lines: string[] = [
      `\uD83D\uDD14 ${slotLabels[currentSlot] ?? currentSlot} Medication Reminder\n`,
    ]

    const keyboard = new InlineKeyboard()

    for (const log of slotLogs) {
      const name = log.medNameLocal ?? log.medName
      const dosage = log.medDosage ? ` (${log.medDosage})` : ""
      lines.push(`\uD83D\uDC8A ${name}${dosage}`)
      keyboard
        .text(`\u2705 ${name}`, `taken:${log.logId}`)
        .text(`\u23ED\uFE0F Skip`, `skip:${log.logId}`)
        .row()
    }

    try {
      const bot = getBot()
      await bot.api.sendMessage(
        linkedUser.telegramChatId,
        lines.join("\n"),
        { reply_markup: keyboard },
      )
      sentCount++
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      console.error(
        `Failed to send reminder to user ${linkedUser.id}:`,
        message,
      )
    }
  }

  return NextResponse.json({ sent: sentCount, slot: currentSlot })
}
