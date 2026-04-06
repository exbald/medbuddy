# MedBuddy Feature Status

Last updated: 2026-04-06

## Implemented Features

### Authentication & Onboarding
**Status: Complete**
- Email/password auth via BetterAuth (Google OAuth configured but optional)
- 3-step onboarding wizard: name confirmation, role selection (patient/caretaker), invite code
- Patients generate a 6-char invite code; caretakers enter it to link
- Middleware redirects unauthenticated users to login, non-onboarded users to `/onboarding`
- Files: `src/app/[locale]/(auth)/`, `src/app/[locale]/onboarding/`, `src/app/api/onboarding/`, `src/proxy.ts`
- Docs: `docs/features/auth-onboarding.md`

### Medication Management
**Status: Complete**
- Manual add with AI-generated purpose description
- Prescription scanning via camera + AI vision model (extracts name, strength, per-dose amount, frequency, instructions, duration, warnings; supports Taiwanese hospital labels and pharmacy bag formats)
- Drug interaction checking: OpenFDA API first, AI fallback with severity classification
- CRUD: list, detail view, inline edit, soft-delete (active=false)
- Auto-creates reminder entries for selected timing slots
- Files: `src/app/api/medications/`, `src/app/[locale]/(app)/medications/`, `src/lib/drugs.ts`
- Docs: `docs/features/medications.md`

### Adherence Tracking
**Status: Complete**
- On-demand log generation (no cron) -- logs created when user first views today's schedule
- Lazy missed marking: past pending doses auto-marked missed
- Dose confirmation: mark taken/skipped from web or Telegram
- Custom reminder times per slot (morning/afternoon/evening/bedtime) via profile settings
- Source tracking: `web` or `telegram`
- Files: `src/lib/adherence.ts`, `src/app/api/adherence/`, `src/app/[locale]/(app)/home/`
- Docs: `docs/features/adherence.md`

### AI Chat Companion
**Status: Complete**
- Streaming chat via OpenRouter (Vercel AI SDK `streamText`)
- System prompt includes user's medications and 7-day adherence summary
- Photo attachment: camera/gallery picker, image preview with remove, send image + text or image only
- AI vision: images sent to model for analysis (pill identification, prescription labels, etc.)
- Images persisted to storage (local or Vercel Blob) with URL saved in `chatMessage.imageUrl`
- New chat button to start fresh conversation (clears history)
- Typing indicator (bouncing dots) while waiting for AI response
- Auto-scroll to new messages and during streaming
- Language matching: server detects user message language (CJK detection), AI replies in same language
- Voice input via Web Speech API (`SpeechRecognition`, lang=zh-TW)
- Voice output via `SpeechSynthesis` with per-message read-aloud button
- Message persistence in `chatMessage` table (shared between web and Telegram)
- Files: `src/app/api/chat/`, `src/app/[locale]/(app)/chat/`, `src/lib/chat-prompt.ts`, `src/lib/ai.ts`
- Docs: `docs/features/chat.md`

### Caretaker Dashboard
**Status: Complete**
- Caretaker links to one patient via invite code (during onboarding or from patient's profile)
- **Caregiver-initiated invite**: caretaker generates a shareable link (`/invite/{code}`), patient signs up via link and auto-links after onboarding (no manual code entry needed)
- Invite landing page: public page sets cookie, redirects to signup; invalid/claimed links show friendly error
- Onboarding step 3: caretakers can "Invite a patient instead" if they don't have a code
- Dashboard empty state: "Invite a Patient" button with copy link, native share, and manual code fallback
- Dashboard shows: patient name, today's schedule with status, 7-day adherence stats, recent missed doses
- **Medication history**: day-by-day browsable view of past 30 days, with prev/next navigation, per-day summary (taken/missed/skipped/pending counts + percentage), grouped by time slot
- Role-aware bottom nav: caretakers see "Patient" tab instead of "Home"
- Shared components: `StatusIcon` and `MedicationRow` extracted for reuse across dashboard and history
- Files: `src/app/api/caretaker/`, `src/app/[locale]/(app)/caretaker/`, `src/app/[locale]/(app)/caretaker/history/`, `src/app/[locale]/invite/[code]/`
- Docs: `docs/features/caretaker.md`

### Telegram Bot
**Status: Complete**
- Built with grammy.js, webhook-based (no polling)
- Landing page has a dedicated Telegram highlight section with a direct CTA linking to `t.me/medbuddy_tw_bot?start=welcome`
- `/start` (no code) shows friendly welcome with inline "Sign Up" / "Login & Link" buttons for new users arriving from the landing page
- Account linking: user generates code in Profile, sends `/start <CODE>` to bot
- `/meds` command: today's schedule with inline buttons to mark taken/skipped
- Free-text messages forwarded to AI chat (same system prompt as web)
- Photo messages analyzed by AI vision: downloads from Telegram, uploads to storage for persistence, passes buffer directly to AI (bypasses private blob URLs), supports optional caption as prompt
- Reminders endpoint scheduled via Vercel Cron (`vercel.json`) — once daily on Hobby plan, can run 4x daily on Pro
- Webhook secret validation for security; bot lazy-initialized per serverless invocation
- Files: `src/lib/telegram.ts`, `src/app/api/telegram/`, `vercel.json`
- Docs: `docs/features/telegram.md`
- Requires: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET` env vars

### User Profile
**Status: Complete**
- View name, email, role (read-only)
- Accordion layout with localStorage-persisted open/closed state per section
- Caregiver invite: patients can view, copy, and regenerate invite codes from profile (not just onboarding)
- Edit reminder times per slot (morning/afternoon/evening/bedtime)
- Appearance: dark mode toggle (light/dark/system) + locale toggle (zh-TW/en) in one section
- Notifications: Telegram linking with direct bot link (t.me/medbuddy_tw_bot), LINE placeholder
- Sign out
- Files: `src/app/api/profile/`, `src/app/api/caretaker/invite/`, `src/app/[locale]/(app)/profile/`, `src/lib/invite-code.ts`

### Internationalization (i18n)
**Status: Complete**
- Locales: zh-TW (default, no URL prefix), en (under `/en/`)
- Uses `next-intl` with `as-needed` prefix strategy, browser locale detection disabled
- Landing page includes locale switch button in header
- All UI strings externalized to `messages/zh-TW.json` and `messages/en.json`
- AI chat responds in user's locale
- Files: `src/i18n/`, `messages/`
- Docs: `docs/features/i18n.md`

### UI/UX (Elderly-Optimized)
**Status: Complete**
- Mobile-first with fixed bottom tab navigation
- 18px+ base font size, 48px+ touch targets
- Dark mode support via `next-themes`
- shadcn/ui component library with Tailwind CSS 4
- Loading states, error boundaries, toast notifications
- PWA manifest configured

### Health Summary Export
**Status: Complete**
- One-tap "Generate Health Summary" from profile page (patients) or caretaker dashboard (caretakers)
- Server assembles: active medications, per-med adherence stats, overall adherence, drug interactions (severity-sorted), AI-generated narrative
- AI narrative: 3-5 sentences in user's locale summarizing adherence patterns and flagging concerns
- Configurable period: 7 / 14 / 30 days via period selector
- Print-optimized: `window.print()` button, `@media print` styles hide nav/controls, force white background, A4-friendly layout
- Caretaker support: `?for=patient` param resolves linked patient data
- Disclaimer: auto-generated summary notice on every report
- Loading skeleton and error state with retry
- All UI strings in zh-TW and en
- Files: `src/app/api/health-summary/route.ts`, `src/app/[locale]/(app)/health-summary/page.tsx`, `src/app/[locale]/(app)/profile/page.tsx` (button), `src/app/[locale]/(app)/caretaker/page.tsx` (button), `src/app/globals.css` (print styles)

## Not Yet Implemented

These are known future features, not current blockers:

| Feature | Notes |
|---------|-------|
| LINE bot integration | Profile card exists as "Coming Soon" placeholder; no backend |
| Multiple patients per caretaker | Currently 1:1 linking only |
| Caretaker dose actions | Caretaker cannot mark doses on patient's behalf |
| Medication history archive | Soft-deleted meds are hidden, no archive view (caretaker history covers adherence, not deleted meds) |
| SMS reminders | Only Telegram reminders exist |
| Barcode scanning | Only image-based prescription scanning |
| Offline mode / sync | Requires internet connection |
| Advanced analytics | No charts or trend analysis |
| pgEnum migration | Type/severity fields use text, not Postgres enums |
| Unique constraint on adherence_log | Deduplication uses app-level checks, not DB constraint |

## External Setup Required

These items require manual configuration, not code changes:

1. **PostgreSQL database** -- set `POSTGRES_URL`, run `npm run db:migrate`
2. **OpenRouter API key** -- set `OPENROUTER_API_KEY` (get from openrouter.ai/settings/keys)
3. **Telegram bot** (optional) -- create via @BotFather, set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET`
4. **Telegram webhook registration** -- call Telegram `setWebhook` API with your deploy URL
5. **Cron for reminders** -- Vercel Cron configured in `vercel.json` (once daily on Hobby plan). For 4x daily reminders, upgrade to Vercel Pro or use an external cron service to call `GET /api/telegram/reminders` with `CRON_SECRET` bearer token
6. **Vercel Blob** (production only) -- set `BLOB_READ_WRITE_TOKEN` for file storage; local dev uses `public/uploads/`

## Tech Stack Reference

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, App Router, React 19, TypeScript |
| AI | Vercel AI SDK 5 + OpenRouter (`@openrouter/ai-sdk-provider`) |
| Auth | BetterAuth (email/password) |
| Database | PostgreSQL + Drizzle ORM |
| UI | shadcn/ui + Tailwind CSS 4 + next-themes |
| Telegram | grammy.js |
| i18n | next-intl |
| Package manager | npm |
