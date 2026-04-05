import { generateObject } from "ai"
import { z } from "zod/v4"
import { defaultModel } from "@/lib/ai"

export interface DrugInteraction {
  type: "interaction" | "duplication"
  severity: "low" | "medium" | "high"
  description: string
  medicationA: string
  medicationB: string
}

const interactionSchema = z.object({
  interactions: z.array(
    z.object({
      type: z.enum(["interaction", "duplication"]),
      severity: z.enum(["low", "medium", "high"]),
      description: z.string(),
      medicationA: z.string(),
      medicationB: z.string(),
    })
  ),
})

async function checkOpenFDA(
  medicationName: string,
  existingMeds: string[]
): Promise<DrugInteraction[]> {
  try {
    const sanitized = medicationName.replace(/"/g, "")
    const encoded = encodeURIComponent(sanitized)
    const response = await fetch(
      `https://api.fda.gov/drug/label.json?search=drug_interactions:"${encoded}"&limit=1`,
      { signal: AbortSignal.timeout(5000) }
    )

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    const interactionText =
      data.results?.[0]?.drug_interactions?.[0] || ""

    if (!interactionText) {
      return []
    }

    const found: DrugInteraction[] = []
    for (const existingMed of existingMeds) {
      if (
        interactionText
          .toLowerCase()
          .includes(existingMed.toLowerCase())
      ) {
        found.push({
          type: "interaction",
          severity: "medium",
          description: `OpenFDA reports a potential interaction between ${medicationName} and ${existingMed}. Consult your pharmacist.`,
          medicationA: medicationName,
          medicationB: existingMed,
        })
      }
    }

    return found
  } catch {
    return []
  }
}

async function checkWithAI(
  medicationName: string,
  existingMeds: string[]
): Promise<DrugInteraction[]> {
  if (existingMeds.length === 0) {
    return []
  }

  try {
    const { object } = await generateObject({
      model: defaultModel,
      schema: interactionSchema,
      prompt: `You are a pharmacology expert. Check for drug interactions and duplications.

New medication: ${medicationName}
Existing medications: ${existingMeds.join(", ")}

Rules:
- Only report clinically significant interactions
- Check for therapeutic duplications (same drug class)
- Severity: "high" = dangerous/contraindicated, "medium" = monitor closely, "low" = minor
- Be conservative — if unsure, don't report it
- Return empty array if no interactions found

Return JSON with interactions array.`,
    })

    return object.interactions
  } catch {
    return []
  }
}

export async function checkInteractions(
  medicationName: string,
  existingMeds: string[]
): Promise<DrugInteraction[]> {
  if (existingMeds.length === 0) {
    return []
  }

  // Try OpenFDA first
  const fdaResults = await checkOpenFDA(medicationName, existingMeds)

  if (fdaResults.length > 0) {
    return fdaResults
  }

  // Fallback to AI check
  return checkWithAI(medicationName, existingMeds)
}

export async function generateMedicationPurpose(
  medicationName: string,
  dosage: string | null,
  locale: string
): Promise<string> {
  try {
    const { object } = await generateObject({
      model: defaultModel,
      schema: z.object({ purpose: z.string() }),
      prompt: `You are a helpful pharmacist. Explain what the medication "${medicationName}"${dosage ? ` (${dosage})` : ""} is commonly used for.

Rules:
- Use simple, plain language an elderly person can understand
- 2-3 sentences maximum
- Never diagnose — say "commonly used for" not "you have"
- Always end with "If you have questions, ask your doctor or pharmacist"
- Respond in ${locale === "zh-TW" ? "Traditional Chinese (繁體中文)" : "English"}`,
    })

    return object.purpose
  } catch {
    return locale === "zh-TW"
      ? "無法生成用途說明。請諮詢您的醫師或藥師。"
      : "Unable to generate purpose. Please ask your doctor or pharmacist."
  }
}
