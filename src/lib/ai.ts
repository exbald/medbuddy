import { createOpenRouter } from "@openrouter/ai-sdk-provider"

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
  headers: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "X-Title": "MedBuddy",
  },
})

export const defaultModel = openrouter(
  process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash"
)

export const visionModel = openrouter(
  process.env.OPENROUTER_VISION_MODEL ||
    process.env.OPENROUTER_MODEL ||
    "google/gemini-2.5-flash"
)
