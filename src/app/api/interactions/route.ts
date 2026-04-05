import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { eq, desc, sql } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { interaction, medication } from "@/lib/schema"

/**
 * GET /api/interactions
 * Returns all drug interactions for the authenticated user,
 * with medication names joined, ordered by severity (high first)
 * then by createdAt desc.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const medA = db
    .select({ id: medication.id, name: medication.name })
    .from(medication)
    .as("med_a")

  const medB = db
    .select({ id: medication.id, name: medication.name })
    .from(medication)
    .as("med_b")

  const interactions = await db
    .select({
      id: interaction.id,
      medAId: interaction.medAId,
      medBId: interaction.medBId,
      medAName: medA.name,
      medBName: medB.name,
      type: interaction.type,
      severity: interaction.severity,
      description: interaction.description,
      createdAt: interaction.createdAt,
    })
    .from(interaction)
    .innerJoin(medA, eq(interaction.medAId, medA.id))
    .innerJoin(medB, eq(interaction.medBId, medB.id))
    .where(eq(interaction.userId, session.user.id))
    .orderBy(
      desc(
        sql`CASE ${interaction.severity}
          WHEN 'high' THEN 3
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 1
          ELSE 0
        END`,
      ),
      desc(interaction.createdAt),
    )

  return NextResponse.json({ interactions })
}
