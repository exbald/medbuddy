import { headers } from "next/headers"
import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { and, like } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { verification } from "@/lib/schema"

/** Generate a 6-character alphanumeric code. */
function generateLinkingCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789" // no ambiguous chars (0/O, 1/I/L)
  const bytes = crypto.randomBytes(6)
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("")
}

/**
 * POST /api/telegram/link
 *
 * Generates a one-time 6-character code for linking a Telegram account.
 * The user sends this code to the MedBuddy Telegram bot via /start <code>.
 */
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id
  const identifier = `telegram-link:${userId}`

  // Delete any existing linking codes for this user
  await db
    .delete(verification)
    .where(
      and(
        like(verification.identifier, `telegram-link:${userId}`),
      ),
    )

  const code = generateLinkingCode()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier,
    value: code,
    expiresAt,
  })

  return NextResponse.json({ code, expiresAt: expiresAt.toISOString() })
}
