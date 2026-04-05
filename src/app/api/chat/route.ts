import { headers } from "next/headers"
import { streamText, UIMessage, convertToModelMessages } from "ai"
import { and, eq, gte, lte } from "drizzle-orm"
import { z } from "zod/v4"
import { defaultModel } from "@/lib/ai"
import { auth } from "@/lib/auth"
import { buildSystemPrompt } from "@/lib/chat-prompt"
import { db } from "@/lib/db"
import { adherenceLog, chatMessage, medication, user } from "@/lib/schema"
import { upload } from "@/lib/storage"

const textPartSchema = z.object({
  type: z.literal("text"),
  text: z.string().max(10000, "Message text too long"),
})

const filePartSchema = z.object({
  type: z.literal("file"),
  mediaType: z.string(),
  url: z.string().max(500_000),
  filename: z.string().optional(),
})

// Allow unknown part types (step-start, source, reasoning, etc.) from assistant messages
const unknownPartSchema = z.object({
  type: z.string(),
}).passthrough()

const messagePartSchema = z.union([textPartSchema, filePartSchema, unknownPartSchema])

// C1 fix: require id and parts to match UIMessage shape
const messageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(messagePartSchema).min(1),
})

const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(100, "Too many messages"),
})

function extractText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

function extractImageDataUrl(message: UIMessage): string | null {
  const filePart = message.parts.find(
    (p): p is { type: "file"; mediaType: string; url: string } =>
      p.type === "file"
  )
  return filePart?.url ?? null
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const parsed = chatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Invalid request",
        details: z.prettifyError(parsed.error),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  const { messages }: { messages: UIMessage[] } = parsed.data as { messages: UIMessage[] }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "OpenRouter API key not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }

  // Fetch user locale
  const [userRow] = await db
    .select({ locale: user.locale })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  const userLocale = userRow?.locale || "zh-TW"

  // Fetch user's active medications
  const userMeds = await db
    .select({
      name: medication.name,
      nameLocal: medication.nameLocal,
      dosage: medication.dosage,
      purpose: medication.purpose,
      timing: medication.timing,
    })
    .from(medication)
    .where(
      and(eq(medication.userId, session.user.id), eq(medication.active, true))
    )

  // Fetch 7-day adherence summary
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const now = new Date()

  const recentLogs = await db
    .select({ status: adherenceLog.status })
    .from(adherenceLog)
    .where(
      and(
        eq(adherenceLog.userId, session.user.id),
        gte(adherenceLog.scheduledAt, sevenDaysAgo),
        lte(adherenceLog.scheduledAt, now)
      )
    )

  const adherenceSummary = {
    taken: recentLogs.filter((l) => l.status === "taken").length,
    missed: recentLogs.filter((l) => l.status === "missed").length,
    pending: recentLogs.filter((l) => l.status === "pending").length,
    total: recentLogs.length,
  }

  // Detect language of latest user message for reply language
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")
  const lastUserText = lastUserMsg ? extractText(lastUserMsg) : ""
  const hasCJK = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(lastUserText)
  const replyLanguage = hasCJK ? "zh-TW" : "en"

  const systemPrompt = buildSystemPrompt(userMeds, adherenceSummary, userLocale, replyLanguage)

  // C2 fix: Only persist the last user message if it's not already in DB
  // (prevents duplicates when history is reloaded and resent)
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")
  if (lastUserMessage) {
    const text = extractText(lastUserMessage)
    const rawImageUrl = extractImageDataUrl(lastUserMessage)

    if (text || rawImageUrl) {
      const existing = await db
        .select({ id: chatMessage.id })
        .from(chatMessage)
        .where(eq(chatMessage.id, lastUserMessage.id))
        .limit(1)

      if (existing.length === 0) {
        let imageUrl: string | null = null
        if (rawImageUrl?.startsWith("data:")) {
          const commaIndex = rawImageUrl.indexOf(",")
          const header = rawImageUrl.slice(0, commaIndex)
          const base64Data = rawImageUrl.slice(commaIndex + 1)
          const mediaType = header.match(/data:(.*?);/)?.[1] ?? "image/jpeg"
          const ext = mediaType.split("/")[1] || "jpg"
          const buffer = Buffer.from(base64Data, "base64")
          const filename = `chat-${session.user.id}-${Date.now()}.${ext}`
          const result = await upload(buffer, filename, "chat-images", {
            maxSize: 10 * 1024 * 1024,
          })
          imageUrl = result.url
        }

        await db.insert(chatMessage).values({
          id: lastUserMessage.id,
          userId: session.user.id,
          role: "user",
          content: text || "",
          imageUrl,
          source: "web",
        })
      }
    }
  }

  const result = streamText({
    model: defaultModel,
    system: systemPrompt,
    messages: convertToModelMessages(messages),
    // H1 fix: catch persistence errors so they don't silently vanish
    onFinish: async ({ text }) => {
      if (text) {
        try {
          await db.insert(chatMessage).values({
            userId: session.user.id,
            role: "assistant",
            content: text,
            source: "web",
          })
        } catch (error) {
          console.error("Failed to persist assistant message:", error)
        }
      }
    },
  })

  return result.toUIMessageStreamResponse()
}
