import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { z } from "zod/v4"
import { visionModel } from "@/lib/ai"
import { auth } from "@/lib/auth"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// Internal schema — the AI extracts rich fields, which we merge before returning
const extractionSchema = z.object({
  medications: z.array(
    z.object({
      name: z.string().describe("English medication name including strength if shown, e.g. 'Achelex 175/350mg'"),
      nameLocal: z.string().optional().describe("Chinese/local medication name, e.g. '肌舒元鬆'"),
      strength: z.string().optional().describe("Drug strength/concentration, e.g. '175/350mg', '20mg', '66.7mg/gm'"),
      amountPerDose: z.string().optional().describe("Amount taken each time, e.g. '1錠', '3ml', '1包', '1顆'. Must be a sensible whole number or simple fraction."),
      form: z.string().optional().describe("Dosage form in Chinese: 錠, 膠囊, 糖漿, 顆粒, 包, etc."),
      frequency: z.string().optional().describe("How often, e.g. '每日3次', '每日1次', '睡前', 'three times daily'"),
      route: z.string().optional().describe("Route of administration, e.g. '口服', 'oral'"),
      instructions: z.string().optional().describe("Meal/timing instructions, e.g. '飯後', '飯前', '空腹', 'at bedtime'"),
      totalDays: z.number().optional().describe("Duration of prescription in days"),
      totalQuantity: z.string().optional().describe("Total quantity dispensed, e.g. '14 Tablet', '1瓶', '42錠'"),
      warnings: z.string().optional().describe("Important warnings, e.g. 'Avoid Falling', '避免開車'"),
    })
  ),
})

type ExtractedMedication = z.infer<typeof extractionSchema>["medications"][number]

/**
 * Combines amountPerDose + strength + warnings into a single dosage string.
 * Examples: "每次1錠 500mg", "每次3ml", "500mg ⚠ Avoid Falling"
 */
function buildDosageString(med: ExtractedMedication): string | undefined {
  const parts: string[] = []

  if (med.amountPerDose) {
    parts.push(`每次${med.amountPerDose}`)
  }

  if (med.strength) {
    parts.push(med.strength)
  }

  if (med.warnings) {
    parts.push(`⚠ ${med.warnings}`)
  }

  return parts.length > 0 ? parts.join(" ") : undefined
}

/**
 * Combines frequency + instructions + route + totalDays into a single string.
 * Examples: "每日3次, 飯後口服, 共14天", "睡前口服, 共14天"
 */
function buildFrequencyString(med: ExtractedMedication): string | undefined {
  const parts: string[] = []

  if (med.frequency) {
    parts.push(med.frequency)
  }

  // Combine instructions and route (e.g. "飯後口服")
  const instructionRoute = [med.instructions, med.route]
    .filter(Boolean)
    .join("")
  if (instructionRoute) {
    parts.push(instructionRoute)
  }

  if (med.totalDays) {
    parts.push(`共${med.totalDays}天`)
  }

  return parts.length > 0 ? parts.join(", ") : undefined
}

const EXTRACTION_PROMPT = `You are a pharmacist assistant that reads Taiwanese prescription labels and pharmacy bags.

COMMON TAIWANESE PRESCRIPTION FORMATS:

1. **Hospital individual medication labels** (e.g. 臺安醫院, 台大醫院):
   - 藥名 Medication: drug name + strength (e.g. "Achelex 175/350mg")
   - Chinese Name: 中文名 (e.g. "肌舒元鬆")
   - 總量 Quantity: total dispensed (e.g. "14 Tablet")
   - 用法用量 Administration: duration, route, timing, per-dose amount
     (e.g. "For 14 Days / oral. at bedtime / Each Time 1 Tablet")
   - 藥品外觀: physical description
   - 適應症/用途: indication
   - 主要副作用: side effects
   - 注意事項: precautions/warnings

2. **Pharmacy bag labels** (e.g. 永真聯順藥局):
   - Compressed grid with all medications
   - Columns typically: 天共(days), quantity, 每次(per dose), 口服(route), frequency
   - May show fractional amounts like "0.22" — these are often total quantity ÷ total doses.
     Infer the actual per-dose amount (usually a whole number like 1錠, 1包, 1顆).

EXTRACTION RULES:
- For per-dose amount (amountPerDose): MUST be a sensible number. Tablets/capsules are almost always whole numbers (1, 2, 3). Syrups can be in ml. If you see a decimal like 0.22 or 0.33, calculate the likely per-dose amount from context (total quantity ÷ frequency × days).
- Distinguish STRENGTH (e.g. "500mg", "175/350mg") from AMOUNT PER DOSE (e.g. "1錠", "3ml").
- Extract meal/timing instructions: 飯前(before meals), 飯後(after meals), 空腹(empty stomach), 睡前(bedtime), etc.
- Extract duration in days if shown.
- Extract warnings like "Avoid Falling", "避免開車", "May cause drowsiness".
- If information is not visible or unclear, omit the field rather than guessing.

Extract all medications from this prescription image.`

/**
 * POST /api/medications/scan
 *
 * Accepts a prescription image via FormData, sends it to the vision model,
 * and returns an array of extracted medications (4 fields: name, nameLocal, dosage, frequency).
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("image")
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing image file" },
      { status: 400 }
    )
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "File must be an image" },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File size must be under 10MB" },
      { status: 400 }
    )
  }

  // Convert the image to a base64 data URL for the vision model
  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")
  const dataUrl = `data:${file.type};base64,${base64}`

  try {
    const { object } = await generateObject({
      model: visionModel,
      schema: extractionSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: dataUrl },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    })

    // Merge rich extraction fields into the 4-field format the frontend expects
    const medications = object.medications.map((med) => ({
      name: med.name,
      nameLocal: med.nameLocal,
      dosage: buildDosageString(med),
      frequency: buildFrequencyString(med),
    }))

    return NextResponse.json({ medications })
  } catch (err: unknown) {
    console.error("Prescription scan failed:", err)
    return NextResponse.json(
      { error: "Prescription scan failed. Please try again." },
      { status: 500 }
    )
  }
}
