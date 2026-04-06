import { getBot } from "@/lib/telegram"

/**
 * POST /api/telegram/webhook
 *
 * Receives updates from the Telegram Bot API.
 * Validates the secret token header to prevent forged updates.
 */
export async function POST(req: Request) {
  // Validate the webhook secret to ensure the request is from Telegram.
  // When setting the webhook via setWebhook(), pass `secret_token` so
  // Telegram includes it as X-Telegram-Bot-Api-Secret-Token on every request.
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("TELEGRAM_WEBHOOK_SECRET is not configured")
    return new Response("Unauthorized", { status: 401 })
  }

  const headerSecret = req.headers.get("x-telegram-bot-api-secret-token")
  if (headerSecret !== webhookSecret) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    const body = await req.json()
    const bot = getBot()
    if (!bot.isInited()) {
      await bot.init()
    }
    await bot.handleUpdate(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("Telegram webhook error:", message)
  }

  // Always return 200 to prevent Telegram from retrying
  return new Response("OK", { status: 200 })
}
