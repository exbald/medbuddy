# Action Required: MedBuddy MVP

Manual steps requiring human action.

## Before Implementation
- [ ] **Verify PostgreSQL database is accessible** - Run `pnpm db:push` to confirm Neon connection works
- [ ] **Confirm OpenRouter API key has credits** - Vision model calls (prescription scanning) cost more than text
- [ ] **Choose OpenRouter vision model** - Set `OPENROUTER_MODEL` env var (recommend `google/gemini-2.5-flash` for vision + text, or separate vision model env var)

## During Implementation
- [ ] **Start dev server** when prompted - Agent cannot run `pnpm dev`; user must start it for testing
- [ ] **Create Telegram bot** via @BotFather - Get `TELEGRAM_BOT_TOKEN` and add to `.env`
- [ ] **Set Telegram webhook URL** - After deploying or using ngrok, set `TELEGRAM_WEBHOOK_URL` in `.env`
- [ ] **Test on actual mobile device** - Elderly UX cannot be verified on desktop alone
- [ ] **Run database migrations** when schema changes - `pnpm db:generate && pnpm db:migrate`

## After Implementation
- [ ] **Test prescription scan** with real Taiwan prescription images - Vision model accuracy varies by prescription format
- [ ] **Test voice input** on mobile Safari/Chrome - Web Speech API support varies
- [ ] **Verify zh-TW translations** with native speaker - Machine-generated translations may be unnatural
- [ ] **Set up Telegram webhook** in production - Register webhook URL with Telegram API
- [ ] **Configure Vercel Cron** (or equivalent) for Telegram reminder sending - `/api/telegram/reminders` needs periodic triggering
- [ ] **Review OpenRouter costs** - Monitor API usage after launch, especially vision model calls
