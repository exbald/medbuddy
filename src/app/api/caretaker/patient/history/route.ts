import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { eq, and, gte, lt } from "drizzle-orm"
import { auth } from "@/lib/auth"
import {
  getTaipeiToday,
  getTaipeiDayBounds,
  getTimeSlot,
  formatTaipeiTime,
  TAIPEI_OFFSET_MS,
} from "@/lib/constants"
import { db } from "@/lib/db"
import { user, caretakerLink, medication, adherenceLog } from "@/lib/schema"

/**
 * GET /api/caretaker/patient/history?date=YYYY-MM-DD
 *
 * Returns one day's adherence logs for the linked patient, grouped by
 * time slot (morning / afternoon / evening / bedtime), along with a
 * summary of taken / missed / skipped / pending counts.
 *
 * Read-only — does NOT call ensureTodayLogs().
 */
export async function GET(request: NextRequest) {
  // ── Auth: session check ──────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  // ── Auth: role check ─────────────────────────────────────────────────
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

  // ── Auth: linked patient lookup ──────────────────────────────────────
  const [link] = await db
    .select({ patientId: caretakerLink.patientId })
    .from(caretakerLink)
    .where(eq(caretakerLink.caretakerId, userId))
    .limit(1)

  if (!link || !link.patientId) {
    return NextResponse.json({ patient: null }, { status: 200 })
  }

  const patientId = link.patientId

  // Fetch patient name
  const [patientInfo] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, patientId))
    .limit(1)

  if (!patientInfo) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 })
  }

  // ── Date parameter ───────────────────────────────────────────────────
  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get("date")

  // Compute today's date string in Taipei timezone
  const nowMs = Date.now() + TAIPEI_OFFSET_MS
  const taipeiNow = new Date(nowMs)
  const todayStr = `${taipeiNow.getUTCFullYear()}-${String(taipeiNow.getUTCMonth() + 1).padStart(2, "0")}-${String(taipeiNow.getUTCDate()).padStart(2, "0")}`

  const dateStr = dateParam ?? todayStr

  // Validate format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 })
  }

  // Validate calendar validity (e.g. reject 2026-02-30)
  const dateParts = dateStr.split("-").map(Number)
  const probe = new Date(Date.UTC(dateParts[0]!, dateParts[1]! - 1, dateParts[2]!))
  if (
    probe.getUTCFullYear() !== dateParts[0] ||
    probe.getUTCMonth() !== dateParts[1]! - 1 ||
    probe.getUTCDate() !== dateParts[2]
  ) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 })
  }

  // Validate range: not in the future, not older than 30 days
  const { todayStart } = getTaipeiToday()
  const { dayStart, dayEnd } = getTaipeiDayBounds(dateStr)
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000)

  if (dayStart.getTime() >= todayEnd.getTime() || dayStart.getTime() < thirtyDaysAgo.getTime()) {
    return NextResponse.json({ error: "Date out of range" }, { status: 400 })
  }

  // ── Query adherence logs ─────────────────────────────────────────────
  const logs = await db
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
        eq(adherenceLog.userId, patientId),
        gte(adherenceLog.scheduledAt, dayStart),
        lt(adherenceLog.scheduledAt, dayEnd),
      ),
    )
    .orderBy(adherenceLog.scheduledAt)

  // ── Group by time slot ───────────────────────────────────────────────
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

  for (const log of logs) {
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
      status: log.status,
      scheduledAt: log.scheduledAt.toISOString(),
      takenAt: log.takenAt?.toISOString() ?? null,
    })
  }

  const slotOrder = ["morning", "afternoon", "evening", "bedtime"]
  const schedule = slotOrder
    .filter((s) => grouped[s])
    .map((s) => grouped[s])

  // ── Compute summary ──────────────────────────────────────────────────
  let taken = 0
  let missed = 0
  let skipped = 0
  let pending = 0

  for (const log of logs) {
    if (log.status === "taken") taken++
    else if (log.status === "missed") missed++
    else if (log.status === "skipped") skipped++
    else pending++
  }

  const total = taken + missed + skipped + pending
  const percentage = total > 0 ? Math.round((taken / total) * 100) : 0

  return NextResponse.json({
    date: dateStr,
    patient: { name: patientInfo.name },
    schedule,
    summary: { taken, missed, skipped, pending, total, percentage },
  })
}
