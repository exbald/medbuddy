import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { ensureTodayLogs } from "@/lib/adherence"
import { auth } from "@/lib/auth"
import {
  getTimeSlot,
  getTaipeiToday,
  formatTaipeiTime,
} from "@/lib/constants"

/**
 * GET /api/adherence/today
 *
 * On-demand generation logic:
 * 1. Ensure adherence logs exist for today (creating them if needed)
 * 2. Return grouped by time_slot with medication details
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id
  const { now, todayStart, todayEnd } = getTaipeiToday()

  const { todaysLogs, missedLogIds } = await ensureTodayLogs(
    userId,
    todayStart,
    todayEnd,
    now,
  )

  // Group by time slot
  const grouped: Record<
    string,
    {
      timeSlot: string
      scheduledTime: string
      medications: Array<{
        logId: string
        medicationId: string
        name: string
        nameLocal: string | null
        dosage: string | null
        status: string
        scheduledAt: string
        takenAt: string | null
      }>
    }
  > = {}

  for (const log of todaysLogs) {
    const slot = getTimeSlot(log.scheduledAt)
    const timeStr = formatTaipeiTime(log.scheduledAt)

    if (!grouped[slot]) {
      grouped[slot] = {
        timeSlot: slot,
        scheduledTime: timeStr,
        medications: [],
      }
    }

    grouped[slot].medications.push({
      logId: log.logId,
      medicationId: log.medicationId,
      name: log.medName,
      nameLocal: log.medNameLocal,
      dosage: log.medDosage,
      // Reflect the lazy missed marking
      status: missedLogIds.includes(log.logId) ? "missed" : log.status,
      scheduledAt: log.scheduledAt.toISOString(),
      takenAt: log.takenAt?.toISOString() ?? null,
    })
  }

  // Return in time-slot order
  const slotOrder = ["morning", "afternoon", "evening", "bedtime"]
  const schedule = slotOrder
    .filter((s) => grouped[s])
    .map((s) => grouped[s])

  return NextResponse.json({ schedule })
}
