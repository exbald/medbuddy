import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { generateText } from "ai"
import { eq, and, gte, lt, desc, sql } from "drizzle-orm"
import { defaultModel } from "@/lib/ai"
import { auth } from "@/lib/auth"
import { getTaipeiToday } from "@/lib/constants"
import { db } from "@/lib/db"
import {
  user,
  caretakerLink,
  medication,
  adherenceLog,
  interaction,
} from "@/lib/schema"

const VALID_PERIODS = new Set([7, 14, 30])
const DEFAULT_PERIOD = 14

/**
 * GET /api/health-summary
 *
 * Assembles a patient's health data (medications, adherence stats,
 * drug interactions) and generates an AI narrative summary suitable
 * for sharing with a doctor.
 *
 * Query params:
 *   - period: 7 | 14 | 30 (default 14) — days of adherence history
 *   - for: "self" | "patient" (default "self") — whose data to summarize
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // --- Parse query params ---------------------------------------------------
  const url = new URL(request.url)
  const periodParam = Number(url.searchParams.get("period") ?? DEFAULT_PERIOD)
  const periodDays = VALID_PERIODS.has(periodParam) ? periodParam : DEFAULT_PERIOD
  const forParam = url.searchParams.get("for") ?? "self"

  // --- Resolve target user ---------------------------------------------------
  let targetUserId: string

  if (forParam === "patient") {
    const [link] = await db
      .select({ patientId: caretakerLink.patientId })
      .from(caretakerLink)
      .where(eq(caretakerLink.caretakerId, session.user.id))
      .limit(1)

    if (!link?.patientId) {
      return NextResponse.json(
        { error: "Forbidden: no linked patient found" },
        { status: 403 },
      )
    }

    targetUserId = link.patientId
  } else {
    targetUserId = session.user.id
  }

  // --- Fetch patient info ----------------------------------------------------
  const [patientInfo] = await db
    .select({ name: user.name, locale: user.locale })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1)

  if (!patientInfo) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // --- 1. Active medications -------------------------------------------------
  const activeMeds = await db
    .select({
      id: medication.id,
      name: medication.name,
      nameLocal: medication.nameLocal,
      dosage: medication.dosage,
      purpose: medication.purpose,
      timing: medication.timing,
    })
    .from(medication)
    .where(and(eq(medication.userId, targetUserId), eq(medication.active, true)))

  // --- 2. Period boundaries --------------------------------------------------
  const { todayEnd } = getTaipeiToday()
  const periodStart = new Date(
    todayEnd.getTime() - periodDays * 24 * 60 * 60 * 1000,
  )

  // --- 3. Overall adherence stats --------------------------------------------
  const periodLogs = await db
    .select({
      status: adherenceLog.status,
      count: sql<number>`count(*)::int`,
    })
    .from(adherenceLog)
    .where(
      and(
        eq(adherenceLog.userId, targetUserId),
        gte(adherenceLog.scheduledAt, periodStart),
        lt(adherenceLog.scheduledAt, todayEnd),
      ),
    )
    .groupBy(adherenceLog.status)

  const overallAdherence = periodLogs.reduce(
    (acc, row) => {
      const count = Number(row.count)
      const updated = { ...acc, total: acc.total + count }

      if (row.status === "taken") return { ...updated, taken: updated.taken + count }
      if (row.status === "missed") return { ...updated, missed: updated.missed + count }
      if (row.status === "pending") return { ...updated, pending: updated.pending + count }

      return updated
    },
    { taken: 0, missed: 0, pending: 0, total: 0, percentage: 0 },
  )

  const overallWithPercentage = {
    ...overallAdherence,
    percentage:
      overallAdherence.total > 0
        ? Math.round((overallAdherence.taken / overallAdherence.total) * 100)
        : 0,
  }

  // --- 4. Per-medication adherence -------------------------------------------
  const perMedLogs = await db
    .select({
      medicationId: adherenceLog.medicationId,
      status: adherenceLog.status,
      count: sql<number>`count(*)::int`,
    })
    .from(adherenceLog)
    .where(
      and(
        eq(adherenceLog.userId, targetUserId),
        gte(adherenceLog.scheduledAt, periodStart),
        lt(adherenceLog.scheduledAt, todayEnd),
      ),
    )
    .groupBy(adherenceLog.medicationId, adherenceLog.status)

  const perMedMap = new Map<
    string,
    { taken: number; missed: number; total: number; percentage: number }
  >()

  for (const row of perMedLogs) {
    const existing = perMedMap.get(row.medicationId) ?? {
      taken: 0,
      missed: 0,
      total: 0,
      percentage: 0,
    }

    const count = Number(row.count)
    const updated = { ...existing, total: existing.total + count }

    if (row.status === "taken") {
      updated.taken = existing.taken + count
    } else if (row.status === "missed") {
      updated.missed = existing.missed + count
    }

    updated.percentage =
      updated.total > 0 ? Math.round((updated.taken / updated.total) * 100) : 0

    perMedMap.set(row.medicationId, updated)
  }

  const medicationsWithAdherence = activeMeds.map((med) => ({
    ...med,
    adherence: perMedMap.get(med.id) ?? {
      taken: 0,
      missed: 0,
      total: 0,
      percentage: 0,
    },
  }))

  // --- 5. Drug interactions --------------------------------------------------
  const medA = db
    .select({ id: medication.id, name: medication.name })
    .from(medication)
    .as("med_a")

  const medB = db
    .select({ id: medication.id, name: medication.name })
    .from(medication)
    .as("med_b")

  const interactionsList = await db
    .select({
      medAName: medA.name,
      medBName: medB.name,
      type: interaction.type,
      severity: interaction.severity,
      description: interaction.description,
    })
    .from(interaction)
    .innerJoin(medA, eq(interaction.medAId, medA.id))
    .innerJoin(medB, eq(interaction.medBId, medB.id))
    .where(eq(interaction.userId, targetUserId))
    .orderBy(
      desc(
        sql`CASE ${interaction.severity}
          WHEN 'high' THEN 3
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 1
          ELSE 0
        END`,
      ),
    )

  // --- 6. AI narrative -------------------------------------------------------
  const locale = patientInfo.locale || "zh-TW"
  const isZh = locale.startsWith("zh")

  let narrative: string | null = null

  try {
    const { text } = await generateText({
      model: defaultModel,
      system: `You are a medical summary assistant. Generate a concise 3-5 sentence narrative in ${isZh ? "Traditional Chinese (繁體中文)" : "English"} summarizing this patient's medication adherence patterns over the past ${periodDays} days. Flag any concerns: low adherence rates (below 80%), high-severity drug interactions, or frequently missed medications. Be factual and objective — do not diagnose or recommend treatment changes. End with "${isZh ? "請與您的醫師討論。" : "Please discuss with your doctor."}"`,
      prompt: JSON.stringify({
        medications: medicationsWithAdherence,
        overallAdherence: overallWithPercentage,
        interactions: interactionsList,
      }),
    })

    narrative = text
  } catch {
    // AI generation failed — return structured data without narrative
  }

  // --- 7. Response -----------------------------------------------------------
  return NextResponse.json({
    patient: { name: patientInfo.name },
    generatedAt: new Date().toISOString(),
    period: periodDays,
    medications: medicationsWithAdherence,
    overallAdherence: overallWithPercentage,
    interactions: interactionsList,
    narrative,
  })
}
