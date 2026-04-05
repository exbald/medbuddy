import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { adherenceLog } from "@/lib/schema"

const updateAdherenceSchema = z.object({
  logId: z.string().uuid(),
  status: z.enum(["taken", "skipped"]),
})

/**
 * POST /api/adherence
 * Mark a dose as taken or skipped.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = updateAdherenceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: z.prettifyError(parsed.error) },
      { status: 400 },
    )
  }

  const { logId, status } = parsed.data
  const userId = session.user.id

  // Verify the log belongs to this user
  const [existing] = await db
    .select({ id: adherenceLog.id, status: adherenceLog.status })
    .from(adherenceLog)
    .where(and(eq(adherenceLog.id, logId), eq(adherenceLog.userId, userId)))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: "Log not found" }, { status: 404 })
  }

  const updateData: { status: string; takenAt?: Date } = { status }
  if (status === "taken") {
    updateData.takenAt = new Date()
  }

  const [updated] = await db
    .update(adherenceLog)
    .set(updateData)
    .where(eq(adherenceLog.id, logId))
    .returning()

  return NextResponse.json({ log: updated })
}
