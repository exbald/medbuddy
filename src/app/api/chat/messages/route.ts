import { headers } from "next/headers"
import { and, desc, eq, inArray } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { chatMessage } from "@/lib/schema"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  // H4 fix: only return user and assistant messages, filter out system
  const messages = await db
    .select({
      id: chatMessage.id,
      role: chatMessage.role,
      content: chatMessage.content,
      imageUrl: chatMessage.imageUrl,
      source: chatMessage.source,
      createdAt: chatMessage.createdAt,
    })
    .from(chatMessage)
    .where(
      and(
        eq(chatMessage.userId, session.user.id),
        inArray(chatMessage.role, ["user", "assistant"])
      )
    )
    .orderBy(desc(chatMessage.createdAt))
    .limit(50)

  // Return in chronological order
  return Response.json({ messages: messages.reverse() })
}
