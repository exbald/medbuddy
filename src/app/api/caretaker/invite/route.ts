import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { and, eq, isNull } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateInviteCode } from "@/lib/invite-code"
import { user, caretakerLink } from "@/lib/schema"

/**
 * GET /api/caretaker/invite
 * Returns the user's current invite code and whether it's been claimed.
 * Works for both patient-initiated and caretaker-initiated flows.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  const [currentUser] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!currentUser || !currentUser.role) {
    return NextResponse.json(
      { error: "Forbidden: role required" },
      { status: 403 },
    )
  }

  if (currentUser.role === "patient") {
    const [link] = await db
      .select({
        inviteCode: caretakerLink.inviteCode,
        caretakerId: caretakerLink.caretakerId,
      })
      .from(caretakerLink)
      .where(eq(caretakerLink.patientId, userId))
      .limit(1)

    if (!link) {
      return NextResponse.json({ inviteCode: null, claimed: false })
    }

    return NextResponse.json({
      inviteCode: link.inviteCode,
      claimed: link.caretakerId !== null,
    })
  }

  if (currentUser.role === "caretaker") {
    const [link] = await db
      .select({
        inviteCode: caretakerLink.inviteCode,
        patientId: caretakerLink.patientId,
      })
      .from(caretakerLink)
      .where(eq(caretakerLink.caretakerId, userId))
      .limit(1)

    if (!link) {
      return NextResponse.json({ inviteCode: null, claimed: false })
    }

    return NextResponse.json({
      inviteCode: link.inviteCode,
      claimed: link.patientId !== null,
    })
  }

  return NextResponse.json(
    { error: "Forbidden: invalid role" },
    { status: 403 },
  )
}

/**
 * POST /api/caretaker/invite
 * Generates a new invite code.
 * - Patient: creates link with patientId set, caretakerId null
 * - Caretaker: creates link with caretakerId set, patientId null
 * If there's an existing unclaimed code, replaces it.
 * If the existing code was already claimed, creates a new link row.
 */
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  const [currentUser] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!currentUser || !currentUser.role) {
    return NextResponse.json(
      { error: "Forbidden: role required" },
      { status: 403 },
    )
  }

  let inviteCode = ""
  let retries = 3

  if (currentUser.role === "patient") {
    while (retries > 0) {
      try {
        inviteCode = generateInviteCode()

        const updated = await db
          .update(caretakerLink)
          .set({ inviteCode })
          .where(
            and(
              eq(caretakerLink.patientId, userId),
              isNull(caretakerLink.caretakerId),
            ),
          )
          .returning({ id: caretakerLink.id })

        if (updated.length === 0) {
          await db.insert(caretakerLink).values({
            patientId: userId,
            inviteCode,
          })
        }

        break
      } catch (err: unknown) {
        retries--
        if (retries === 0) throw err
      }
    }
  } else if (currentUser.role === "caretaker") {
    while (retries > 0) {
      try {
        inviteCode = generateInviteCode()

        const updated = await db
          .update(caretakerLink)
          .set({ inviteCode })
          .where(
            and(
              eq(caretakerLink.caretakerId, userId),
              isNull(caretakerLink.patientId),
            ),
          )
          .returning({ id: caretakerLink.id })

        if (updated.length === 0) {
          await db.insert(caretakerLink).values({
            caretakerId: userId,
            inviteCode,
          })
        }

        break
      } catch (err: unknown) {
        retries--
        if (retries === 0) throw err
      }
    }
  } else {
    return NextResponse.json(
      { error: "Forbidden: invalid role" },
      { status: 403 },
    )
  }

  return NextResponse.json({ inviteCode, claimed: false })
}
