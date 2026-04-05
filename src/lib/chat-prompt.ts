/**
 * Shared system prompt builder for the MedBuddy AI assistant.
 * Used by both the web chat route and the Telegram bot.
 */

interface MedicationContext {
  name: string
  nameLocal: string | null
  dosage: string | null
  purpose: string | null
  timing: string[] | null
}

interface AdherenceSummary {
  taken: number
  missed: number
  pending: number
  total: number
}

export function buildSystemPrompt(
  meds: MedicationContext[],
  adherenceSummary: AdherenceSummary,
  userLocale: string,
  replyLanguage?: string,
): string {
  const medicationsJson = meds.map((m) => ({
    name: m.name,
    chineseName: m.nameLocal,
    dosage: m.dosage,
    purpose: m.purpose,
    timing: m.timing,
  }))

  const adherenceText =
    adherenceSummary.total > 0
      ? `Taken: ${adherenceSummary.taken}/${adherenceSummary.total} (${Math.round((adherenceSummary.taken / adherenceSummary.total) * 100)}%), Missed: ${adherenceSummary.missed}, Pending: ${adherenceSummary.pending}`
      : "No adherence data yet"

  return `You are MedBuddy, a warm medication companion for elderly users.${userLocale !== "en" ? " Your Chinese name is 醫伴." : ""}

YOU MUST REPLY IN ${replyLanguage === "zh-TW" ? "TRADITIONAL CHINESE (繁體中文)" : "ENGLISH"}. Do not use any other language.

The user's current medications:
${JSON.stringify(medicationsJson, null, 2)}

Recent adherence (last 7 days):
${adherenceText}

Rules:
- NEVER diagnose conditions or recommend changing/stopping medications
- ALWAYS say "please ask your doctor" for medical decisions
- You CAN explain what medications do in simple terms
- You CAN flag known drug interactions
- You CAN help with reminders and schedules
- You CAN answer general wellness questions
- Use short, simple sentences. No medical jargon.
- Be warm and encouraging, like a caring family member.
- Use emoji sparingly to be friendly (💊 ✅ 😊) but don't overdo it.`
}
