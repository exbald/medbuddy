/**
 * Shared constants and utility functions used across MedBuddy API routes
 * and background services.
 */

// ---------------------------------------------------------------------------
// Timing slots
// ---------------------------------------------------------------------------

export const VALID_TIMING_SLOTS = [
  "morning",
  "afternoon",
  "evening",
  "bedtime",
] as const

export type TimingSlot = (typeof VALID_TIMING_SLOTS)[number]

/**
 * Default scheduled times per slot (HH:MM format).
 * Used when creating adherence logs on-demand and auto-creating reminders.
 */
export const DEFAULT_SLOT_TIMES: Record<TimingSlot, string> = {
  morning: "08:00",
  afternoon: "12:30",
  evening: "18:00",
  bedtime: "21:30",
}

// ---------------------------------------------------------------------------
// Timezone helpers
// ---------------------------------------------------------------------------

/** Asia/Taipei (UTC+8) offset in milliseconds. */
export const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000

/**
 * Grace period before marking a pending dose as "missed" (30 minutes).
 * Allows users a reasonable window after the scheduled time to take
 * their medication.
 */
export const GRACE_PERIOD_MS = 30 * 60 * 1000

/**
 * Returns a { todayStart, todayEnd, now } triple where todayStart and todayEnd
 * represent the boundaries of "today" in the Asia/Taipei timezone, expressed
 * as UTC Date objects suitable for database queries.
 *
 * The approach: shift UTC to Taipei local time, floor to midnight, then shift
 * back to UTC. This avoids Intl.DateTimeFormat overhead and matches the
 * offset-arithmetic pattern used elsewhere.
 */
export function getTaipeiToday(): {
  now: Date
  todayStart: Date
  todayEnd: Date
} {
  const now = new Date()

  // Shift UTC time to Taipei local time, then floor to midnight
  const taipeiMs = now.getTime() + TAIPEI_OFFSET_MS
  const taipeiMidnight = new Date(taipeiMs)
  taipeiMidnight.setUTCHours(0, 0, 0, 0)

  // Shift back to UTC
  const todayStart = new Date(taipeiMidnight.getTime() - TAIPEI_OFFSET_MS)
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  return { now, todayStart, todayEnd }
}

/**
 * Returns day boundaries for a given YYYY-MM-DD date string in Taipei timezone,
 * expressed as UTC Date objects suitable for database queries.
 */
export function getTaipeiDayBounds(dateStr: string): {
  dayStart: Date
  dayEnd: Date
} {
  const parts = dateStr.split("-").map(Number)
  const year = parts[0]!
  const month = parts[1]!
  const day = parts[2]!
  // Construct midnight in Taipei as a UTC date, then subtract offset
  const taipeiMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  const dayStart = new Date(taipeiMidnight.getTime() - TAIPEI_OFFSET_MS)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
  return { dayStart, dayEnd }
}

// ---------------------------------------------------------------------------
// Time slot classification
// ---------------------------------------------------------------------------

/**
 * Determine the time slot for a given scheduledAt timestamp based on
 * its Taipei-local hour and minute.
 *
 * The scheduledAt is stored in UTC; we convert to Taipei local time
 * before classifying.
 *
 * Boundaries (Taipei local time):
 *   morning   < 11:00  (< 660 minutes)
 *   afternoon < 16:00  (< 960 minutes)
 *   evening   < 20:00  (< 1200 minutes)
 *   bedtime   >= 20:00
 */
export function getTimeSlot(scheduledAt: Date): TimingSlot {
  const taipeiMs = scheduledAt.getTime() + TAIPEI_OFFSET_MS
  const taipeiDate = new Date(taipeiMs)
  const h = taipeiDate.getUTCHours()
  const m = taipeiDate.getUTCMinutes()
  const totalMinutes = h * 60 + m
  if (totalMinutes < 660) return "morning"
  if (totalMinutes < 960) return "afternoon"
  if (totalMinutes < 1200) return "evening"
  return "bedtime"
}

/**
 * Returns the current time slot based on the current time in Taipei.
 */
export function getCurrentTimeSlot(): TimingSlot {
  return getTimeSlot(new Date())
}

/**
 * Format a UTC Date as "HH:MM" in Taipei local time.
 */
export function formatTaipeiTime(utcDate: Date): string {
  const taipeiMs = utcDate.getTime() + TAIPEI_OFFSET_MS
  const taipeiDate = new Date(taipeiMs)
  return `${String(taipeiDate.getUTCHours()).padStart(2, "0")}:${String(taipeiDate.getUTCMinutes()).padStart(2, "0")}`
}
