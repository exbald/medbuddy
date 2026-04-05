import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user, reminder } from "@/lib/schema"

const VALID_SLOTS = ["morning", "afternoon", "evening", "bedtime"] as const

const updateProfileSchema = z.object({
  locale: z.enum(["zh-TW", "en"]).optional(),
  reminderTimes: z
    .object({
      morning: z.string().regex(/^\d{2}:\d{2}$/),
      afternoon: z.string().regex(/^\d{2}:\d{2}$/),
      evening: z.string().regex(/^\d{2}:\d{2}$/),
      bedtime: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .optional(),
})

/**
 * GET /api/profile
 * Returns user profile info and reminder times.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  const [currentUser] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      locale: user.locale,
      telegramChatId: user.telegramChatId,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const reminders = await db
    .select({
      timeSlot: reminder.timeSlot,
      scheduledTime: reminder.scheduledTime,
      active: reminder.active,
    })
    .from(reminder)
    .where(eq(reminder.userId, userId))

  // Build reminder times map with defaults
  const reminderTimes: Record<string, string> = {
    morning: "08:00",
    afternoon: "12:30",
    evening: "18:00",
    bedtime: "21:30",
  }
  for (const r of reminders) {
    reminderTimes[r.timeSlot] = r.scheduledTime
  }

  return NextResponse.json({
    profile: {
      ...currentUser,
      reminderTimes,
    },
  })
}

/**
 * PATCH /api/profile
 * Update reminder times and/or locale preference.
 */
export async function PATCH(req: Request) {
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

  const parsed = updateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: z.prettifyError(parsed.error) },
      { status: 400 },
    )
  }

  const { locale, reminderTimes } = parsed.data
  const userId = session.user.id

  // Update locale if provided
  if (locale) {
    await db.update(user).set({ locale }).where(eq(user.id, userId))
  }

  // Update reminder times if provided
  if (reminderTimes) {
    for (const slot of VALID_SLOTS) {
      const time = reminderTimes[slot]
      // Upsert: update existing or create new
      const [existing] = await db
        .select({ id: reminder.id })
        .from(reminder)
        .where(
          and(eq(reminder.userId, userId), eq(reminder.timeSlot, slot)),
        )
        .limit(1)

      if (existing) {
        await db
          .update(reminder)
          .set({ scheduledTime: time })
          .where(eq(reminder.id, existing.id))
      } else {
        await db.insert(reminder).values({
          userId,
          timeSlot: slot,
          scheduledTime: time,
          active: true,
        })
      }
    }
  }

  return NextResponse.json({ success: true })
}

/**
 * DELETE /api/profile
 * Unlink Telegram account from the current user.
 */
export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await db
    .update(user)
    .set({ telegramChatId: null })
    .where(eq(user.id, session.user.id))

  return NextResponse.json({ success: true })
}
