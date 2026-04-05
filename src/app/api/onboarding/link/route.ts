import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { caretakerLink } from "@/lib/schema"

const linkSchema = z.object({
  inviteCode: z.string().length(6),
})

/**
 * POST /api/onboarding/link
 * Bidirectional linking via invite code.
 * - If link has patientId set + caretakerId null → patient-initiated: current user becomes caretaker
 * - If link has caretakerId set + patientId null → caregiver-initiated: current user becomes patient
 * Uses atomic WHERE clause to prevent race conditions.
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

  const parsed = linkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: z.prettifyError(parsed.error) },
      { status: 400 },
    )
  }

  const { inviteCode } = parsed.data
  const normalizedCode = inviteCode.toUpperCase()

  const [link] = await db
    .select()
    .from(caretakerLink)
    .where(eq(caretakerLink.inviteCode, normalizedCode))
    .limit(1)

  if (!link) {
    return NextResponse.json(
      { error: "Invite code not found" },
      { status: 404 },
    )
  }

  // Both sides filled → already claimed
  if (link.patientId !== null && link.caretakerId !== null) {
    return NextResponse.json(
      { error: "This invite code has already been used" },
      { status: 409 },
    )
  }

  // Caregiver-initiated: caretakerId set, patientId null → current user becomes patient
  if (link.caretakerId !== null && link.patientId === null) {
    if (link.caretakerId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot link to your own account" },
        { status: 400 },
      )
    }

    const result = await db
      .update(caretakerLink)
      .set({ patientId: session.user.id })
      .where(
        and(eq(caretakerLink.id, link.id), isNull(caretakerLink.patientId)),
      )
      .returning({ id: caretakerLink.id })

    if (result.length === 0) {
      return NextResponse.json(
        { error: "This invite code has already been used" },
        { status: 409 },
      )
    }

    return NextResponse.json({ success: true })
  }

  // Patient-initiated: patientId set, caretakerId null → current user becomes caretaker
  if (link.patientId !== null && link.caretakerId === null) {
    if (link.patientId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot link to your own account" },
        { status: 400 },
      )
    }

    const result = await db
      .update(caretakerLink)
      .set({ caretakerId: session.user.id })
      .where(
        and(eq(caretakerLink.id, link.id), isNull(caretakerLink.caretakerId)),
      )
      .returning({ id: caretakerLink.id })

    if (result.length === 0) {
      return NextResponse.json(
        { error: "This invite code has already been used" },
        { status: 409 },
      )
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json(
    { error: "Invalid invite code state" },
    { status: 400 },
  )
}
