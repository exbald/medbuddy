/**
 * Shared adherence log generation logic.
 *
 * Extracts the on-demand log creation pattern used by both
 * /api/adherence/today and /api/caretaker/patient into a single
 * function with a race-condition fix via INSERT ... ON CONFLICT DO NOTHING.
 *
 * NOTE: The adherence_log table currently lacks a unique constraint on
 * (user_id, medication_id, scheduled_at). A migration adding that constraint
 * is required for the onConflictDoNothing() call to be effective. Until that
 * migration is applied, the INSERT will succeed without deduplication but
 * will not error. Once the constraint exists, concurrent requests will
 * safely be deduplicated.
 */

import { and, eq, gte, inArray, lt } from "drizzle-orm"
import { DEFAULT_SLOT_TIMES, GRACE_PERIOD_MS } from "@/lib/constants"
import { db } from "@/lib/db"
import { adherenceLog, medication, reminder } from "@/lib/schema"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdherenceLogRow {
  logId: string
  medicationId: string
  scheduledAt: Date
  takenAt: Date | null
  status: string
  medName: string
  medNameLocal: string | null
  medDosage: string | null
}

export interface EnsureTodayLogsResult {
  todaysLogs: AdherenceLogRow[]
  missedLogIds: string[]
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Ensure today's adherence logs exist for a given user, creating them
 * on-demand if they don't yet exist.
 *
 * Steps:
 * 1. Check if any logs already exist for today.
 * 2. If not, query active medications and reminders, then INSERT new logs
 *    using onConflictDoNothing() to prevent duplicate rows if two requests
 *    race each other.
 * 3. Re-fetch all of today's logs with medication details.
 * 4. Lazily mark past pending logs as "missed".
 *
 * @param userId     The user whose logs to ensure.
 * @param todayStart Start-of-day boundary (inclusive).
 * @param todayEnd   End-of-day boundary (exclusive).
 * @param now        The current timestamp, used for "missed" detection.
 */
export async function ensureTodayLogs(
  userId: string,
  todayStart: Date,
  todayEnd: Date,
  now: Date,
): Promise<EnsureTodayLogsResult> {
  // Step 1: Check for existing logs
  const existingLogs = await db
    .select({ id: adherenceLog.id })
    .from(adherenceLog)
    .where(
      and(
        eq(adherenceLog.userId, userId),
        gte(adherenceLog.scheduledAt, todayStart),
        lt(adherenceLog.scheduledAt, todayEnd),
      ),
    )
    .limit(1)

  // Step 2: Generate logs on-demand if none exist
  if (existingLogs.length === 0) {
    const [activeMeds, userReminders] = await Promise.all([
      db
        .select({
          id: medication.id,
          timing: medication.timing,
        })
        .from(medication)
        .where(
          and(eq(medication.userId, userId), eq(medication.active, true)),
        ),
      db
        .select({
          timeSlot: reminder.timeSlot,
          scheduledTime: reminder.scheduledTime,
        })
        .from(reminder)
        .where(
          and(eq(reminder.userId, userId), eq(reminder.active, true)),
        ),
    ])

    // Build a map of slot -> scheduled time from user's reminders
    const slotTimeMap: Record<string, string> = {}
    for (const r of userReminders) {
      slotTimeMap[r.timeSlot] = r.scheduledTime
    }

    // Create adherence log rows for each medication + timing slot
    const newLogs: Array<{
      userId: string
      medicationId: string
      scheduledAt: Date
      status: string
      source: string
    }> = []

    for (const med of activeMeds) {
      if (!med.timing || med.timing.length === 0) continue
      for (const slot of med.timing) {
        const timeStr =
          slotTimeMap[slot] ?? DEFAULT_SLOT_TIMES[slot as keyof typeof DEFAULT_SLOT_TIMES] ?? "08:00"
        const parts = timeStr.split(":").map(Number)
        const hours = parts[0] ?? 8
        const minutes = parts[1] ?? 0
        // todayStart is Taipei midnight expressed in UTC; add the local HH:MM offset
        const scheduledAt = new Date(
          todayStart.getTime() + hours * 60 * 60 * 1000 + minutes * 60 * 1000,
        )

        newLogs.push({
          userId,
          medicationId: med.id,
          scheduledAt,
          status: "pending",
          source: "web",
        })
      }
    }

    if (newLogs.length > 0) {
      // Use onConflictDoNothing to safely handle concurrent requests.
      // Requires a unique constraint on (user_id, medication_id, scheduled_at).
      await db.insert(adherenceLog).values(newLogs).onConflictDoNothing()
    }
  }

  // Step 3: Re-fetch all today's logs with medication details
  const todaysLogs = await db
    .select({
      logId: adherenceLog.id,
      medicationId: adherenceLog.medicationId,
      scheduledAt: adherenceLog.scheduledAt,
      takenAt: adherenceLog.takenAt,
      status: adherenceLog.status,
      medName: medication.name,
      medNameLocal: medication.nameLocal,
      medDosage: medication.dosage,
    })
    .from(adherenceLog)
    .innerJoin(medication, eq(adherenceLog.medicationId, medication.id))
    .where(
      and(
        eq(adherenceLog.userId, userId),
        gte(adherenceLog.scheduledAt, todayStart),
        lt(adherenceLog.scheduledAt, todayEnd),
      ),
    )
    .orderBy(adherenceLog.scheduledAt)

  // Step 4: Lazily mark past pending logs as missed (with grace period)
  const missedLogIds: string[] = []
  for (const log of todaysLogs) {
    const graceDeadline = new Date(log.scheduledAt.getTime() + GRACE_PERIOD_MS)
    if (log.status === "pending" && graceDeadline < now) {
      missedLogIds.push(log.logId)
    }
  }

  if (missedLogIds.length > 0) {
    await db
      .update(adherenceLog)
      .set({ status: "missed" })
      .where(
        and(
          eq(adherenceLog.userId, userId),
          inArray(adherenceLog.id, missedLogIds),
        ),
      )
  }

  return { todaysLogs, missedLogIds }
}
