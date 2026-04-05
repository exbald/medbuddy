import { cookies, headers } from "next/headers"
import { NextResponse } from "next/server"
import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateInviteCode } from "@/lib/invite-code"
import { user, caretakerLink } from "@/lib/schema"

const onboardingSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.enum(["patient", "caretaker"]),
})

/**
 * GET /api/onboarding
 * Returns the current user's onboarding status and role.
 * If already onboarded, sets the httpOnly cookie so middleware can skip DB lookups.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [currentUser] = await db
    .select({
      onboardingComplete: user.onboardingComplete,
      role: user.role,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const complete = currentUser.onboardingComplete ?? false

  const response = NextResponse.json({
    complete,
    role: currentUser.role ?? "patient",
  })

  // Set httpOnly cookie server-side so middleware can check without DB query
  if (complete) {
    response.cookies.set("onboarding_complete", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })
  }

  return response
}

/**
 * POST /api/onboarding
 * Completes onboarding: updates user name/role, generates invite code for patients.
 * If an invite_code cookie is present and role is "patient", auto-links to the caregiver.
 * Uses a DB transaction so partial failures don't leave the user in a half-onboarded state.
 * Sets an httpOnly cookie so middleware can skip DB lookups on future requests.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Prevent re-completing onboarding
  const [currentUser] = await db
    .select({ onboardingComplete: user.onboardingComplete })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (currentUser?.onboardingComplete) {
    return NextResponse.json(
      { error: "Onboarding already completed" },
      { status: 400 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = onboardingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: z.prettifyError(parsed.error) },
      { status: 400 },
    )
  }

  const { name, role } = parsed.data

  // Read invite_code cookie for auto-linking
  const cookieStore = await cookies()
  const inviteCodeCookie = cookieStore.get("invite_code")?.value

  let inviteCode: string | undefined
  let autoLinked = false

  // Wrap in transaction so invite code collision or failure rolls back the user update
  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({
        name,
        role,
        onboardingComplete: true,
      })
      .where(eq(user.id, session.user.id))

    // Auto-link from invite cookie if patient signing up via caregiver invite
    if (role === "patient" && inviteCodeCookie) {
      const normalizedCode = inviteCodeCookie.toUpperCase()
      const result = await tx
        .update(caretakerLink)
        .set({ patientId: session.user.id })
        .where(
          and(
            eq(caretakerLink.inviteCode, normalizedCode),
            isNull(caretakerLink.patientId),
          ),
        )
        .returning({ id: caretakerLink.id })

      if (result.length > 0) {
        autoLinked = true
      }
    }

    // Generate patient invite code if not auto-linked (patient needs their own code for sharing)
    if (role === "patient" && !autoLinked) {
      let retries = 3
      while (retries > 0) {
        try {
          inviteCode = generateInviteCode()
          await tx.insert(caretakerLink).values({
            patientId: session.user.id,
            inviteCode,
          })
          break
        } catch (err: unknown) {
          retries--
          if (retries === 0) throw err
        }
      }
    }
  })

  const response = NextResponse.json({ success: true, inviteCode, autoLinked })
  response.cookies.set("onboarding_complete", "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })

  // Clear invite_code cookie
  if (inviteCodeCookie) {
    response.cookies.set("invite_code", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })
  }

  return response
}
