# Implementation Plan: MedBuddy MVP

## Overview
Transform the agentic coding boilerplate into MedBuddy — a medication companion for elderly patients in Taiwan. 8 waves, each independently testable. All boilerplate UI completely replaced.

## Key Architecture Decisions
- **Extend Better Auth `user` table** with new columns (Better Auth ignores extras) — no separate profiles table
- **On-demand adherence logs** — created when `/api/adherence/today` is first called each day, no cron
- **`next-intl` with `as-needed` locale prefix** — zh-TW default (no prefix), en gets `/en/`
- **`<input capture="environment">`** for camera — better elderly mobile support than WebRTC
- **Keep `@openrouter/ai-sdk-provider`** (already installed) — don't use raw `openai` SDK

## Parallel Execution Strategy
Tasks are organized into waves. All tasks in a wave can run concurrently.
Each wave depends on the previous wave completing.

---

## Wave 1: Foundation — Dependencies, Schema, i18n, App Shell

**Goal:** Install dependencies, define complete DB schema, set up i18n routing, remove all boilerplate, create app shell with bottom navigation.

### Tasks
- [x] w1-deps-schema: Install dependencies + define database schema `agents: [general]`
- [x] w1-i18n-setup: Set up next-intl with locale routing and initial translation files `agents: [general]`
- [x] w1-app-shell: Remove boilerplate, create root layout, bottom nav, landing page, globals.css elderly styles `agents: [general]`

### Technical Details

**Dependencies:**
```bash
pnpm add next-intl grammy
pnpm dlx shadcn@latest add checkbox tabs sheet scroll-area switch select form toast progress
```

**Schema (`src/lib/schema.ts`)** — extend user table, add 6 new tables:
```typescript
// Extend existing user table with:
locale: text("locale").default("zh-TW"),
phone: text("phone"),
telegramChatId: text("telegram_chat_id"),
role: text("role").default("patient"), // 'patient' | 'caretaker'
onboardingComplete: boolean("onboarding_complete").default(false),

// New tables (all use uuid PKs):
caretakerLink: { id, caretakerId FK→user, patientId FK→user, inviteCode unique, createdAt }
medication: { id, userId FK→user, name, nameLocal, dosage, purpose, timing text[], active bool, scanData jsonb, createdAt }
interaction: { id, userId FK→user, medAId FK→medication, medBId FK→medication, type, severity, description, createdAt }
reminder: { id, userId FK→user, timeSlot, scheduledTime time, active bool, createdAt }
adherenceLog: { id, userId FK→user, medicationId FK→medication, scheduledAt timestamptz, takenAt timestamptz nullable, status, source, createdAt }
chatMessage: { id, userId FK→user, role, content, source, createdAt }
```

After schema: `pnpm db:generate && pnpm db:migrate`

**i18n files to create:**
- `src/i18n/request.ts` — `getRequestConfig()` with locale detection
- `src/i18n/routing.ts` — locales: ['zh-TW', 'en'], defaultLocale: 'zh-TW', localePrefix: 'as-needed'
- `src/i18n/zh-TW.json` — initial keys for nav, common UI, auth
- `src/i18n/en.json` — English translations
- Update `next.config.ts` — wrap with `createNextIntlPlugin()`
- Update `src/proxy.ts` — chain next-intl middleware with auth middleware

**App shell:**
- Delete: `setup-checklist.tsx`, `starter-prompt-modal.tsx`, `site-header.tsx`, `site-footer.tsx`, `github-stars.tsx`, `use-diagnostics.ts`, `api/diagnostics/route.ts`, boilerplate pages (page.tsx, dashboard/, chat/, profile/)
- Rewrite `src/app/layout.tsx` — minimal: html lang from locale, body, ThemeProvider, Toaster
- Create `src/app/[locale]/layout.tsx` — NextIntlClientProvider, bottom nav wrapper
- Create `src/app/[locale]/page.tsx` — landing/auth redirect page
- Create `src/components/bottom-nav.tsx` — fixed bottom: Home | Meds | Chat | Profile (lucide icons, 48px touch targets)
- Update `next.config.ts` Permissions-Policy: `camera=(self), microphone=(self), geolocation=()`
- Update `src/app/globals.css` — base font-size 18px, high-contrast color tokens, 48px min touch targets

---

## Wave 2: Auth + Onboarding

**Goal:** Move auth pages under locale routing, build onboarding wizard with role selection and invite codes.
**Depends on:** Wave 1

### Tasks
- [x] w2-auth-pages: Move auth pages to [locale] routing, update with i18n `agents: [general]`
- [x] w2-onboarding: Build onboarding wizard (role, invite codes) + API routes + middleware redirect `agents: [general]`

### Technical Details

**Auth pages:**
- Move `src/app/(auth)/` → `src/app/[locale]/(auth)/`
- Update sign-in, sign-up, forgot-password, reset-password forms with `useTranslations()`
- Keep existing Better Auth components in `src/components/auth/`, update imports

**Onboarding:**
- `src/app/[locale]/onboarding/page.tsx` — client component, step wizard:
  1. Name confirmation (pre-filled from auth user.name)
  2. Role selection: two large cards — "I'm a Patient" / "I'm a Caretaker" (48px+ touch targets)
  3. Patient path: generate 6-char invite code, display with copy button
  4. Caretaker path: text input for invite code, validate + link
- `src/app/api/onboarding/route.ts` — POST: validate zod input, update user (role, locale, onboardingComplete=true), generate invite code for patients
- `src/app/api/onboarding/link/route.ts` — POST: validate invite code, create caretakerLink row
- Update `src/proxy.ts` — after auth cookie check, query user.onboardingComplete; if false, redirect to `/onboarding`
- Update `src/lib/session.ts` — add `requireOnboarding()`, update protectedRoutes array

---

## Wave 3: Medication Entry + AI Wrapper

**Goal:** Manual medication add, prescription scanning via vision model, AI purpose generation, drug interaction checking.
**Depends on:** Wave 2

### Tasks
- [x] w3-ai-wrapper: Create AI wrapper (lib/ai.ts) and drug interaction checker (lib/drugs.ts) `agents: [general]`
- [x] w3-med-manual: Build manual medication add page + POST/GET API routes `agents: [general]`
- [x] w3-med-scan: Build prescription scan page + vision API route `agents: [general]`

### Technical Details

**AI wrapper (`src/lib/ai.ts`):**
```typescript
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
  headers: { "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL, "X-Title": "MedBuddy" }
})
export const defaultModel = openrouter(process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash")
```

**Drug interaction checker (`src/lib/drugs.ts`):**
- `checkInteractions(medicationName: string, existingMeds: string[])` — call OpenFDA API `/drug/interaction.json`
- Fallback: if OpenFDA returns nothing, ask OpenRouter to check interactions
- Return: `{ type: 'interaction'|'duplication', severity: 'low'|'medium'|'high', description: string }[]`

**Manual add page (`src/app/[locale]/medications/add/page.tsx`):**
- Form: name (text), nameLocal (text, Chinese name), dosage (text), timing (checkboxes: morning/afternoon/evening/bedtime)
- On submit → POST /api/medications → response includes AI-generated purpose + any interactions found
- Show interaction warnings if found (alert banner)

**API routes:**
- `src/app/api/medications/route.ts`:
  - POST: validate with zod, insert medication, call OpenRouter for purpose generation, call drugs.ts for interactions, insert any found interactions, auto-create reminders for timing slots, return medication + interactions
  - GET: return user's active medications with interaction count
- `src/app/api/medications/scan/route.ts`:
  - POST: receive FormData with image file, convert to base64, send to OpenRouter vision model with prompt: "Extract all medication names, dosages, and frequencies from this prescription. Return JSON array: [{name, nameLocal, dosage, frequency}]"
  - Return parsed JSON for user confirmation

**Scan page (`src/app/[locale]/medications/scan/page.tsx`):**
- `<input type="file" accept="image/*" capture="environment">` with large camera icon button
- Preview captured image
- Loading state while AI processes
- Results: editable list of extracted medications, confirm/edit each, bulk save

**Interactions API (`src/app/api/interactions/route.ts`):**
- GET: return all interaction warnings for authenticated user

---

## Wave 4: Medication List + Home Screen

**Goal:** Today's medication timeline on home screen, medication list with details, and medication detail/edit pages.
**Depends on:** Wave 3

### Tasks
- [x] w4-home-screen: Build home page with today's timeline grouped by time slot `agents: [general]`
- [x] w4-med-list: Build medication list, detail page, and individual medication API routes `agents: [general]`

### Technical Details

**Home screen (`src/app/[locale]/home/page.tsx`):**
- Server component that fetches today's adherence schedule
- Groups medications by time slot: morning (08:00), afternoon (12:30), evening (18:00), bedtime (21:30)
- Each slot section: time label + medication cards
- Uses `<MedCard>` component for each medication

**Med card (`src/components/med-card.tsx`):**
```typescript
interface MedCardProps {
  medication: { id, name, nameLocal, dosage }
  status: 'pending' | 'taken' | 'missed'
  scheduledTime: string
  onTake: (id: string) => void
}
```
- Large card: pill emoji + name (+ Chinese name if different) + dosage + scheduled time
- Big "Take" button (green, 48px+ height) when pending
- Checkmark icon when taken, X icon when missed
- Tap card body → navigate to medication detail

**Medication list (`src/app/[locale]/medications/page.tsx`):**
- All active medications as cards
- Each card shows: name, dosage, purpose snippet, interaction warning badge
- FAB or top button: "+ Add Medication" linking to add page
- Secondary link to scan page

**Medication detail (`src/app/[locale]/medications/[id]/page.tsx`):**
- Full AI-generated purpose explanation
- Timing schedule
- Interaction warnings (if any) with severity badges
- Edit button → inline edit form
- Deactivate button (soft delete)

**API (`src/app/api/medications/[id]/route.ts`):**
- DELETE: set medication.active = false (soft delete)
- PATCH: update name, dosage, timing; re-check interactions if timing changed

---

## Wave 5: Reminders + Adherence

**Goal:** Adherence tracking with on-demand log creation, dose confirmation, reminder time settings in profile.
**Depends on:** Wave 4

### Tasks
- [x] w5-adherence-api: Build adherence API routes (today schedule + dose logging) `agents: [general]`
- [x] w5-profile: Build profile page with reminder time settings and user preferences `agents: [general]`

### Technical Details

**Adherence today API (`src/app/api/adherence/today/route.ts`):**
- GET: authenticated user's today schedule
- On-demand generation logic:
  1. Query adherence_logs for today (using user's timezone or UTC date boundary)
  2. If none exist: query active medications + reminders, create adherence_log rows for each med/slot combo, status='pending'
  3. Lazy missed marking: for any log where scheduledAt is in the past and status='pending', update to 'missed'
  4. Return grouped by time_slot with medication details

**Adherence log API (`src/app/api/adherence/route.ts`):**
- POST: `{ medicationId, status: 'taken' | 'skipped' }` — validate with zod, update adherence_log row, set takenAt=now if taken

**Wire up home screen:**
- Update home page to call GET /api/adherence/today
- MedCard "Take" button calls POST /api/adherence with status='taken'
- Optimistic UI update, toast on success

**Profile page (`src/app/[locale]/profile/page.tsx`):**
- User info display (name, email, role)
- Reminder time settings: 4 time inputs (morning, afternoon, evening, bedtime)
- Save updates reminder table rows
- Locale preference toggle (zh-TW / en)
- Sign out button

**Profile API (`src/app/api/profile/route.ts`):**
- GET: user profile + reminder times
- PATCH: update reminder times, locale preference

---

## Wave 6: AI Chat Companion

**Goal:** MedBuddy streaming chat with medication context, voice input/output, message persistence.
**Depends on:** Wave 5

### Tasks
- [x] w6-chat-backend: Rewrite chat API with MedBuddy system prompt, medication context, message persistence `agents: [general]`
- [x] w6-chat-ui: Build chat page with WhatsApp-style bubbles, voice input/output `agents: [general]`

### Technical Details

**Chat API rewrite (`src/app/api/chat/route.ts`):**
- Authenticate user
- Fetch user's active medications + 7-day adherence summary
- Build MedBuddy system prompt (from starter-prompt.md spec):
  ```
  You are MedBuddy, a warm medication companion...
  User's medications: {json}
  Recent adherence: {summary}
  Rules: never diagnose, always say "ask your doctor"...
  Respond in {user_locale}
  ```
- Use `streamText()` from Vercel AI SDK with OpenRouter
- After stream completes: persist user message + assistant response to chatMessage table
- Accept `source` param: 'web' | 'telegram' | 'voice'

**Chat UI (`src/app/[locale]/chat/page.tsx`):**
- Client component using `useChat()` from `@ai-sdk/react`
- Load recent messages from DB on mount
- WhatsApp-style layout: messages list + input bar at bottom
- User messages: right-aligned, blue/green
- Assistant messages: left-aligned, gray
- Text input with send button
- Large microphone button (48px+)

**Voice button (`src/components/voice-button.tsx`):**
- Mic icon, toggles recording state
- Uses Web Speech API `SpeechRecognition` with `lang='zh-TW'`
- On result: populate text input, auto-send
- Graceful fallback: hide mic button if Web Speech API unsupported
- Feature detection: `'webkitSpeechRecognition' in window || 'SpeechRecognition' in window`

**Chat bubble (`src/components/chat-bubble.tsx`):**
- Props: role ('user'|'assistant'), content (string), timestamp
- Markdown rendering for assistant messages (react-markdown already installed)
- Speaker icon on assistant messages — tap to read aloud via SpeechSynthesis

**Voice output toggle:**
- Global toggle in chat header: auto-read responses
- Uses `window.speechSynthesis.speak()` with zh-TW voice

---

## Wave 7: Telegram Bot + Caretaker View

**Goal:** Telegram bot for reminders/confirmations/chat, plus caretaker view of patient adherence.
**Depends on:** Wave 6

### Tasks
- [x] w7-telegram: Build grammy.js bot with webhook, account linking, dose confirmations, chat forwarding `agents: [general]`
- [x] w7-caretaker: Build caretaker view page + API route, update bottom nav for role awareness `agents: [general]`

### Technical Details

**Telegram bot (`src/lib/telegram.ts`):**
```typescript
import { Bot } from "grammy"
export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!)
// Register commands and handlers
```

**Webhook (`src/app/api/telegram/webhook/route.ts`):**
- POST: `bot.handleUpdate(await req.json())`
- Commands:
  - `/start <code>` — look up one-time linking code, set user.telegramChatId
  - `/meds` — query today's adherence, format as Telegram message with status emojis
- Inline buttons: `taken:{logId}`, `later:{logId}`, `skip:{logId}` — update adherence_log
- Free text: create chatMessage (source='telegram'), call AI, reply with response

**Reminder sender (`src/app/api/telegram/reminders/route.ts`):**
- GET (called by external cron): query users with telegramChatId + pending reminders for current time slot
- Send formatted message per user:
  ```
  Time for medication!
  After Breakfast:
  - Metformin 500mg
  - Lisinopril 10mg
  [Taken] [Later] [Skip]
  ```

**Caretaker page (`src/app/[locale]/caretaker/page.tsx`):**
- Fetch linked patient via caretakerLink table
- Show patient name
- Today's schedule: medication cards with status (taken/pending/missed)
- 7-day adherence: simple percentage calculation from adherence_logs
- Recent missed doses list (last 7 days)

**Caretaker API (`src/app/api/caretaker/patient/route.ts`):**
- GET: validate user.role='caretaker', find caretakerLink, return patient's medications + today's adherence + 7-day stats

**Bottom nav update (`src/components/bottom-nav.tsx`):**
- If user role is 'caretaker': show Caretaker tab instead of Home tab
- Patient: Home | Meds | Chat | Profile
- Caretaker: Patient | Meds | Chat | Profile

---

## Wave 8: i18n Completion + UX Polish

**Goal:** Complete string externalization, elderly UX audit, PWA manifest, documentation.
**Depends on:** Wave 7

### Tasks
- [x] w8-i18n: Externalize all UI strings to zh-TW.json and en.json `agents: [general]`
- [x] w8-ux-polish: Elderly UX audit, loading skeletons, error boundaries, PWA manifest `agents: [general]`
- [x] w8-docs: Create feature documentation in docs/features/ `agents: [general]`

### Technical Details

**i18n completion:**
- Audit all pages and components for hardcoded strings
- Add translation keys for: medication terms, time slots, status labels, error messages, onboarding steps, chat UI, caretaker view, profile settings
- Ensure all pages use `useTranslations()` (client) or `getTranslations()` (server)

**UX audit checklist:**
- [ ] All text >= 18px (base font in globals.css)
- [ ] All touch targets >= 48px (buttons, cards, nav items)
- [ ] Color contrast >= 4.5:1 (WCAG AA)
- [ ] Simple language in CTAs: "Take Medicine" not "Log Adherence"
- [ ] Large icons + emoji decorations (pill, checkmark, clock)
- [ ] Loading skeletons on all data-fetching pages (shadcn Skeleton component)
- [ ] Error boundaries with clear recovery ("Something went wrong. Tap to try again.")
- [ ] Toast notifications for all user actions (success/error)

**PWA manifest (`src/app/manifest.ts`):**
- name: "MedBuddy", short_name: "MedBuddy", description in zh-TW
- theme_color and background_color matching app theme
- Icons placeholder (user provides actual icons later)

**Documentation (`docs/features/`):**
- `auth-onboarding.md` — auth flow, onboarding wizard, invite codes
- `medications.md` — manual add, prescription scan, AI purpose, interactions
- `adherence.md` — reminders, dose tracking, on-demand log generation
- `chat.md` — AI companion, voice I/O, system prompt, message persistence
- `telegram.md` — bot setup, commands, inline buttons, reminder sending
- `caretaker.md` — caretaker linking, patient view, adherence stats
- `i18n.md` — locale setup, translation workflow, adding new languages

---

## Verification

After each wave:
```bash
pnpm lint && pnpm typecheck
```

End-to-end test plan:
1. Register new user → onboarding flow → select patient role → generate invite code
2. Add medication manually → see AI purpose + interaction check
3. Scan prescription photo → confirm extracted medications → bulk save
4. Home screen shows today's timeline → tap "Take" → adherence logged
5. Open chat → ask about medications → contextual streaming response
6. Test voice input (mic button) and voice output (speaker icon)
7. Register caretaker → enter invite code → see patient's schedule
8. Switch locale to English → all UI strings translated
9. Test on mobile viewport → bottom nav, 48px targets, 18px text
10. Telegram: /start linking, /meds list, inline button dose confirmation
