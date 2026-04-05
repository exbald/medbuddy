# Requirements: MedBuddy MVP

## Summary
MedBuddy is a medication companion for elderly chronic care patients in Taiwan. Scan prescriptions, understand medications, get reminders, confirm doses, and chat with an AI companion. Mobile-first web app + Telegram bot.

## Problem
Elderly chronic care patients struggle to manage multiple medications — remembering schedules, understanding interactions, and communicating with caretakers. Existing apps are too complex, not localized for Taiwan, and not accessible for elderly users.

## Solution
A mobile-first web app with Telegram bot integration that:
- Scans prescriptions via camera + AI vision to extract medications
- Explains medications in plain language (Traditional Chinese primary)
- Sends reminders and tracks adherence with one-tap confirmation
- Provides an AI chat companion for medication questions (with voice)
- Gives caretakers a simple view of patient adherence

## Acceptance Criteria

### Auth & Onboarding
- [ ] Users can register/login with email + password
- [ ] New users complete onboarding: name, role (patient/caretaker)
- [ ] Patients generate invite codes; caretakers link via invite code
- [ ] Unonboarded users are redirected to onboarding flow

### Medication Entry
- [ ] Manual medication add: name, Chinese name, dosage, timing (morning/afternoon/evening/bedtime)
- [ ] Camera scan: capture prescription photo, AI extracts medications as JSON, user confirms/edits/saves
- [ ] After save: AI generates plain-language purpose explanation
- [ ] After save: interaction check against all active meds (OpenFDA + AI fallback)

### Medication List & Home Screen
- [ ] Home screen shows today's medication timeline grouped by time slot
- [ ] Each medication shown as card with name, dosage, time, and large "Take" button
- [ ] Medication list page with all active meds, purpose, interaction warnings
- [ ] Medication detail page with full explanation and interaction details

### Reminders & Adherence
- [ ] Reminders auto-created from medication timing (default: morning=08:00, afternoon=12:30, evening=18:00, bedtime=21:30)
- [ ] Adherence logs created on-demand when today's schedule is queried
- [ ] One-tap "Take" marks dose as taken with timestamp
- [ ] Past unconfirmed doses lazily marked as missed
- [ ] Users can adjust default reminder times in profile

### AI Chat
- [ ] Streaming chat with MedBuddy system prompt injected with user's medication context
- [ ] Voice input via Web Speech API (zh-TW)
- [ ] Voice output via SpeechSynthesis (toggle)
- [ ] Messages persisted to database
- [ ] Hard guardrail: never diagnose, always say "ask your doctor" for medical decisions

### Telegram Bot
- [ ] grammy.js webhook at /api/telegram/webhook
- [ ] /start links Telegram account via one-time code
- [ ] /meds lists today's medications and status
- [ ] Inline button callbacks update adherence logs
- [ ] Free text forwarded to AI chat
- [ ] Scheduled reminder messages with emoji buttons

### Caretaker View
- [ ] Shows linked patient's today schedule with taken/pending/missed status
- [ ] 7-day adherence percentage
- [ ] Recent missed doses list
- [ ] Role-aware navigation (caretaker tab instead of home)

### i18n & UX
- [x] next-intl with zh-TW (primary, no URL prefix) and en (/en/ prefix)
- [x] All UI strings externalized
- [x] Min 18px text, min 48px touch targets, high contrast
- [x] Bottom tab navigation: Home | Meds | Chat | Profile
- [x] Mobile-first responsive design

## Dependencies
- Existing: Next.js 16, Better Auth, Drizzle ORM + PostgreSQL, Vercel AI SDK, @openrouter/ai-sdk-provider, shadcn/ui, Tailwind CSS 4, zod, lucide-react
- New: next-intl (i18n), grammy (Telegram bot)
- External APIs: OpenRouter (LLM + vision), OpenFDA (drug interactions)
- Env vars needed: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_URL (existing: OPENROUTER_API_KEY, OPENROUTER_MODEL, POSTGRES_URL, BETTER_AUTH_SECRET)
