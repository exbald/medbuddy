import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { eq, and, or, gte, desc } from "drizzle-orm"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkInteractions } from "@/lib/drugs"
import { medication, interaction, adherenceLog } from "@/lib/schema"

const VALID_TIMING_SLOTS = ["morning", "afternoon", "evening", "bedtime"] as const

const updateMedicationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  nameLocal: z.string().max(200).optional(),
  dosage: z.string().max(200).optional(),
  timing: z.array(z.enum(VALID_TIMING_SLOTS)).min(1).optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/medications/[id]
 * Returns a single medication with its interactions for the authenticated user.
 */
export async function GET(_req: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: "Missing medication ID" }, { status: 400 })
  }

  const userId = session.user.id

  // Fetch the medication, ensuring it belongs to the authenticated user
  const [med] = await db
    .select()
    .from(medication)
    .where(and(eq(medication.id, id), eq(medication.userId, userId)))
    .limit(1)

  if (!med) {
    return NextResponse.json({ error: "Medication not found" }, { status: 404 })
  }

  // Fetch interactions where this medication is either medA or medB
  const interactions = await db
    .select()
    .from(interaction)
    .where(
      and(
        eq(interaction.userId, userId),
        or(eq(interaction.medAId, id), eq(interaction.medBId, id)),
      ),
    )

  // Collect all "other" medication IDs and resolve names in a single query
  const otherMedIds = [
    ...new Set(
      interactions.map((inter) =>
        inter.medAId === id ? inter.medBId : inter.medAId,
      ),
    ),
  ].filter((mid): mid is string => mid != null)

  const otherMeds =
    otherMedIds.length > 0
      ? await db
          .select({ id: medication.id, name: medication.name })
          .from(medication)
          .where(or(...otherMedIds.map((mid) => eq(medication.id, mid))))
      : []

  const medNameMap = new Map(otherMeds.map((m) => [m.id, m.name]))

  const interactionsWithNames = interactions.map((inter) => {
    const otherMedId = inter.medAId === id ? inter.medBId : inter.medAId
    return {
      id: inter.id,
      type: inter.type,
      severity: inter.severity,
      description: inter.description,
      otherMedName: medNameMap.get(otherMedId) ?? "Unknown",
    }
  })

  // Fetch recent adherence logs (last 7 days) for this medication
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const recentLogs = await db
    .select({
      id: adherenceLog.id,
      scheduledAt: adherenceLog.scheduledAt,
      takenAt: adherenceLog.takenAt,
      status: adherenceLog.status,
      source: adherenceLog.source,
    })
    .from(adherenceLog)
    .where(
      and(
        eq(adherenceLog.userId, userId),
        eq(adherenceLog.medicationId, id),
        gte(adherenceLog.scheduledAt, sevenDaysAgo),
      ),
    )
    .orderBy(desc(adherenceLog.scheduledAt))

  return NextResponse.json({
    medication: med,
    interactions: interactionsWithNames,
    recentLogs,
  })
}

/**
 * PATCH /api/medications/[id]
 * Updates a medication. If timing changed, re-checks drug interactions.
 */
export async function PATCH(req: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: "Missing medication ID" }, { status: 400 })
  }

  const userId = session.user.id

  // Verify medication exists and belongs to the user
  const [existing] = await db
    .select()
    .from(medication)
    .where(and(eq(medication.id, id), eq(medication.userId, userId)))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: "Medication not found" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = updateMedicationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: z.prettifyError(parsed.error) },
      { status: 400 },
    )
  }

  const updates = parsed.data

  // Require at least one field to update
  if (!updates.name && !updates.nameLocal && !updates.dosage && !updates.timing) {
    return NextResponse.json(
      { error: "At least one field is required" },
      { status: 400 },
    )
  }

  // Build the update payload (immutable pattern: construct a new object)
  const updatePayload: Record<string, unknown> = {}
  if (updates.name !== undefined) updatePayload.name = updates.name
  if (updates.nameLocal !== undefined) updatePayload.nameLocal = updates.nameLocal
  if (updates.dosage !== undefined) updatePayload.dosage = updates.dosage
  if (updates.timing !== undefined) updatePayload.timing = updates.timing

  const [updated] = await db
    .update(medication)
    .set(updatePayload)
    .where(eq(medication.id, id))
    .returning()

  // Re-check interactions only when the substance (name) changes.
  // Timing-only changes don't affect drug interactions.
  if (updates.name) {
    const medName = updates.name ?? existing.name

    const existingMeds = await db
      .select({ id: medication.id, name: medication.name })
      .from(medication)
      .where(
        and(
          eq(medication.userId, userId),
          eq(medication.active, true),
        ),
      )

    const existingMedNames = existingMeds
      .filter((m) => m.id !== id)
      .map((m) => m.name)

    const newInteractions = await checkInteractions(medName, existingMedNames)

    // Remove old interactions involving this medication
    const oldInteractions = await db
      .select({ id: interaction.id })
      .from(interaction)
      .where(
        and(
          eq(interaction.userId, userId),
          or(eq(interaction.medAId, id), eq(interaction.medBId, id)),
        ),
      )

    for (const old of oldInteractions) {
      await db.delete(interaction).where(eq(interaction.id, old.id))
    }

    // Insert new interactions
    for (const inter of newInteractions) {
      const matchingMed = existingMeds.find(
        (m) =>
          m.name.toLowerCase() === inter.medicationB.toLowerCase() &&
          m.id !== id,
      )

      if (matchingMed) {
        await db.insert(interaction).values({
          userId,
          medAId: id,
          medBId: matchingMed.id,
          type: inter.type,
          severity: inter.severity,
          description: inter.description,
        })
      }
    }
  }

  return NextResponse.json({ medication: updated })
}

/**
 * DELETE /api/medications/[id]
 * Soft-deletes (deactivates) a medication by setting active = false.
 */
export async function DELETE(_req: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: "Missing medication ID" }, { status: 400 })
  }

  const userId = session.user.id

  // Verify medication exists and belongs to the user
  const [existing] = await db
    .select({ id: medication.id })
    .from(medication)
    .where(and(eq(medication.id, id), eq(medication.userId, userId)))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: "Medication not found" }, { status: 404 })
  }

  await db
    .update(medication)
    .set({ active: false })
    .where(eq(medication.id, id))

  return NextResponse.json({ success: true })
}
