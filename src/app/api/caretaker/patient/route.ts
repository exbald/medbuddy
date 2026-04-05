import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { eq, and, gte, lt, desc, sql } from "drizzle-orm"
import { ensureTodayLogs } from "@/lib/adherence"
import { auth } from "@/lib/auth"
import { getTimeSlot, getTaipeiToday, formatTaipeiTime } from "@/lib/constants"
import { db } from "@/lib/db"
import { user, caretakerLink, medication, adherenceLog } from "@/lib/schema"

/**
 * GET /api/caretaker/patient
 *
 * Returns the linked patient's info, medications, today's schedule,
 * 7-day adherence stats, and recent missed doses.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  // Verify user role is caretaker
  const [currentUser] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!currentUser || currentUser.role !== "caretaker") {
    return NextResponse.json(
      { error: "Forbidden: caretaker role required" },
      { status: 403 },
    )
  }

  // Find linked patient
  const [link] = await db
    .select({ patientId: caretakerLink.patientId })
    .from(caretakerLink)
    .where(eq(caretakerLink.caretakerId, userId))
    .limit(1)

  if (!link || !link.patientId) {
    return NextResponse.json({ patient: null }, { status: 200 })
  }

  const patientId = link.patientId

  // Fetch patient info
  const [patientInfo] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, patientId))
    .limit(1)

  if (!patientInfo) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 })
  }

  // Fetch patient's active medications
  const activeMeds = await db
    .select({
      id: medication.id,
      name: medication.name,
      nameLocal: medication.nameLocal,
      dosage: medication.dosage,
      timing: medication.timing,
    })
    .from(medication)
    .where(and(eq(medication.userId, patientId), eq(medication.active, true)))

  // Today's date boundaries in Asia/Taipei timezone
  const { now, todayStart, todayEnd } = getTaipeiToday()

  // Ensure today's logs exist and get them
  const { todaysLogs, missedLogIds } = await ensureTodayLogs(
    patientId,
    todayStart,
    todayEnd,
    now,
  )

  // Group today's logs by time slot
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
      grouped[slot] = { timeSlot: slot, scheduledTime: timeStr, medications: [] }
    }

    grouped[slot].medications.push({
      logId: log.logId,
      medicationId: log.medicationId,
      name: log.medName,
      nameLocal: log.medNameLocal,
      dosage: log.medDosage,
      status: missedLogIds.includes(log.logId) ? "missed" : log.status,
      scheduledAt: log.scheduledAt.toISOString(),
      takenAt: log.takenAt?.toISOString() ?? null,
    })
  }

  const slotOrder = ["morning", "afternoon", "evening", "bedtime"]
  const todaySchedule = slotOrder
    .filter((s) => grouped[s])
    .map((s) => grouped[s])

  // 7-day adherence stats
  const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)

  const weekLogs = await db
    .select({
      status: adherenceLog.status,
      count: sql<number>`count(*)::int`,
    })
    .from(adherenceLog)
    .where(
      and(
        eq(adherenceLog.userId, patientId),
        gte(adherenceLog.scheduledAt, weekStart),
        lt(adherenceLog.scheduledAt, todayEnd),
      ),
    )
    .groupBy(adherenceLog.status)

  let taken = 0
  let missed = 0
  let pending = 0
  let total = 0

  for (const row of weekLogs) {
    const count = Number(row.count)
    total += count
    if (row.status === "taken") taken = count
    else if (row.status === "missed") missed = count
    else if (row.status === "pending") pending = count
  }

  const percentage = total > 0 ? Math.round((taken / total) * 100) : 0

  const weekStats = { taken, missed, pending, total, percentage }

  // Recent missed doses (last 7 days)
  const recentMissed = await db
    .select({
      name: medication.name,
      nameLocal: medication.nameLocal,
      dosage: medication.dosage,
      scheduledAt: adherenceLog.scheduledAt,
    })
    .from(adherenceLog)
    .innerJoin(medication, eq(adherenceLog.medicationId, medication.id))
    .where(
      and(
        eq(adherenceLog.userId, patientId),
        eq(adherenceLog.status, "missed"),
        gte(adherenceLog.scheduledAt, weekStart),
        lt(adherenceLog.scheduledAt, todayEnd),
      ),
    )
    .orderBy(desc(adherenceLog.scheduledAt))
    .limit(20)

  const formattedMissed = recentMissed.map((row) => ({
    name: row.name,
    nameLocal: row.nameLocal,
    dosage: row.dosage,
    scheduledAt: row.scheduledAt.toISOString(),
  }))

  return NextResponse.json({
    patient: patientInfo,
    medications: activeMeds,
    todaySchedule,
    weekStats,
    recentMissed: formattedMissed,
  })
}
