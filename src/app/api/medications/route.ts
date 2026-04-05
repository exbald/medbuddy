import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { eq, and, desc, sql } from "drizzle-orm"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import {
  VALID_TIMING_SLOTS,
  DEFAULT_SLOT_TIMES,
} from "@/lib/constants"
import { db } from "@/lib/db"
import {
  checkInteractions,
  generateMedicationPurpose,
} from "@/lib/drugs"
import { medication, interaction, reminder, user } from "@/lib/schema"

const createMedicationSchema = z.object({
  name: z.string().min(1).max(200),
  nameLocal: z.string().max(200).optional(),
  dosage: z.string().max(200).optional(),
  timing: z.array(z.enum(VALID_TIMING_SLOTS)).min(1),
})

/**
 * POST /api/medications
 * Creates a new medication, generates an AI purpose description,
 * checks for drug interactions, and auto-creates reminder slots.
 */
export async function POST(req: Request) {
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

  const parsed = createMedicationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: z.prettifyError(parsed.error) },
      { status: 400 },
    )
  }

  const { name, nameLocal, dosage, timing } = parsed.data
  const userId = session.user.id

  // Insert the new medication
  const [newMed] = await db
    .insert(medication)
    .values({
      userId,
      name,
      nameLocal: nameLocal ?? null,
      dosage: dosage ?? null,
      timing,
      active: true,
    })
    .returning()

  if (!newMed) {
    return NextResponse.json(
      { error: "Failed to create medication" },
      { status: 500 },
    )
  }

  // Fetch the user locale for AI purpose generation
  const [currentUser] = await db
    .select({ locale: user.locale })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  const locale = currentUser?.locale ?? "zh-TW"

  // Generate AI purpose and check interactions concurrently
  const existingMeds = await db
    .select({ id: medication.id, name: medication.name })
    .from(medication)
    .where(
      and(
        eq(medication.userId, userId),
        eq(medication.active, true),
      ),
    )

  // Exclude the newly added medication from the existing list
  const existingMedNames = existingMeds
    .filter((m) => m.id !== newMed.id)
    .map((m) => m.name)

  const [purpose, interactions] = await Promise.all([
    generateMedicationPurpose(name, dosage ?? null, locale),
    checkInteractions(name, existingMedNames),
  ])

  // Update the medication row with the AI-generated purpose
  await db
    .update(medication)
    .set({ purpose })
    .where(eq(medication.id, newMed.id))

  // Insert any discovered interactions
  const insertedInteractions = []
  for (const inter of interactions) {
    // Look up the existing medication ID by name
    const matchingMed = existingMeds.find(
      (m) =>
        m.name.toLowerCase() === inter.medicationB.toLowerCase() &&
        m.id !== newMed.id,
    )

    if (matchingMed) {
      const [inserted] = await db
        .insert(interaction)
        .values({
          userId,
          medAId: newMed.id,
          medBId: matchingMed.id,
          type: inter.type,
          severity: inter.severity,
          description: inter.description,
        })
        .returning()

      insertedInteractions.push(inserted)
    }
  }

  // Auto-create reminders for timing slots that the user doesn't already have
  const existingReminders = await db
    .select({ timeSlot: reminder.timeSlot })
    .from(reminder)
    .where(
      and(eq(reminder.userId, userId), eq(reminder.active, true)),
    )

  const existingSlots = new Set(existingReminders.map((r) => r.timeSlot))

  const newReminders = timing
    .filter((slot) => !existingSlots.has(slot))
    .map((slot) => ({
      userId,
      timeSlot: slot,
      scheduledTime: DEFAULT_SLOT_TIMES[slot],
      active: true,
    }))

  if (newReminders.length > 0) {
    await db.insert(reminder).values(newReminders)
  }

  return NextResponse.json(
    {
      medication: { ...newMed, purpose },
      interactions: insertedInteractions,
      purpose,
    },
    { status: 201 },
  )
}

/**
 * GET /api/medications
 * Returns all active medications for the authenticated user,
 * ordered by createdAt desc, with interaction count per medication.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  // Subquery for interaction count (where the medication is either medA or medB)
  const interactionUnion = db
    .select({
      medId: interaction.medAId,
    })
    .from(interaction)
    .where(eq(interaction.userId, userId))
    .unionAll(
      db
        .select({
          medId: interaction.medBId,
        })
        .from(interaction)
        .where(eq(interaction.userId, userId)),
    )
    .as("interaction_union")

  const interactionCount = db
    .select({
      medId: interactionUnion.medId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(interactionUnion)
    .groupBy(interactionUnion.medId)
    .as("interaction_count")

  const medications = await db
    .select({
      id: medication.id,
      name: medication.name,
      nameLocal: medication.nameLocal,
      dosage: medication.dosage,
      purpose: medication.purpose,
      timing: medication.timing,
      active: medication.active,
      createdAt: medication.createdAt,
      interactionCount: sql<number>`coalesce(${interactionCount.count}, 0)`,
    })
    .from(medication)
    .leftJoin(interactionCount, eq(medication.id, interactionCount.medId))
    .where(
      and(
        eq(medication.userId, userId),
        eq(medication.active, true),
      ),
    )
    .orderBy(desc(medication.createdAt))

  return NextResponse.json({ medications })
}
