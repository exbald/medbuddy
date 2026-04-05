
# MedBuddy — MVP Build Plan

## What is this?
MedBuddy is a medication companion for elderly chronic care patients. Scan prescriptions, understand your meds, get reminders, confirm doses, chat with an AI companion. Taiwan (Traditional Chinese) is the primary market.


## MVP Scope — What We Build
1. **Scan prescription** → OCR + LLM extracts medications → user confirms
2. **Understand medications** → plain-language explanation of each med, interaction/duplication warnings
3. **Reminders** → scheduled notifications via web + Telegram bot with emoji buttons
4. **Confirm doses** → one-tap confirmation, logs adherence
5. **AI chat companion** → answer medication questions, voice input/output, never give medical advice
6. **Caretaker view** — simple page showing patient's today schedule + adherence status

That's it. No vital signs, no doctor reports, no nutrition tracking, no IoT. Those come later.

## Two Interfaces
1. **Mobile-first web app** — patient-facing, elderly-optimized
2. **Telegram bot** — reminders + confirmations + chat (proves messaging pattern before LINE)

Caretaker view is a simple page within the web app, not a separate dashboard.

## Tech Stack
- **LLM**: OpenRouter API (`openai` npm SDK pointed at `https://openrouter.ai/api/v1`). Model configurable via env var.
- **Voice**: Browser-native Web Speech API (STT + TTS). Graceful fallback if unsupported.
- **OCR**: Send prescription photo directly to OpenRouter vision model — skip Tesseract, keep it simple. Claude/Gemini vision models handle multilingual labels well enough for MVP.
- **Drug data**: OpenFDA API for interaction checks. Simple local lookup table for common Taiwan medications as fallback.
- **Telegram**: grammy.js as Next.js API route webhook
- **i18n**: next-intl (zh-TW primary, en). Japanese/Korean are post-MVP.

## Database Schema (Drizzle)

Keep it flat and simple. No premature normalization.

```sql
-- users
id            uuid PK (supabase auth)
name          text
locale        text default 'zh-TW'
phone         text
telegram_chat_id text nullable
role          text default 'patient'  -- 'patient' | 'caretaker'
created_at    timestamptz

-- caretaker_links
id            uuid PK
caretaker_id  uuid FK→users
patient_id    uuid FK→users
invite_code   text unique
created_at    timestamptz

-- medications
id            uuid PK
user_id       uuid FK→users
name          text
name_local    text nullable
dosage        text
purpose       text nullable          -- LLM-generated explanation
timing        text[] default '{}'    -- ['morning','evening','bedtime']
active        boolean default true
scan_data     jsonb nullable         -- raw OCR/LLM output for audit
created_at    timestamptz

-- interactions (generated on medication add)
id            uuid PK
user_id       uuid FK→users
med_a_id      uuid FK→medications
med_b_id      uuid FK→medications
type          text                   -- 'duplication' | 'interaction'
severity      text                   -- 'low' | 'medium' | 'high'
description   text
created_at    timestamptz

-- reminders
id            uuid PK
user_id       uuid FK→users
time_slot     text                   -- 'morning' | 'afternoon' | 'evening' | 'bedtime'
scheduled_time time                  -- e.g. 08:00
active        boolean default true
created_at    timestamptz

-- adherence_logs
id            uuid PK
user_id       uuid FK→users
medication_id uuid FK→medications
scheduled_at  timestamptz
taken_at      timestamptz nullable
status        text default 'pending' -- 'pending' | 'taken' | 'missed' | 'skipped'
source        text default 'web'     -- 'web' | 'telegram'
created_at    timestamptz

-- chat_messages
id            uuid PK
user_id       uuid FK→users
role          text                   -- 'user' | 'assistant'
content       text
source        text default 'web'     -- 'web' | 'telegram' | 'voice'
created_at    timestamptz
```

No symptom_logs, no vital_signs tables for MVP. Add them when needed — the schema is easy to extend.

## Implementation Order

Build in this exact sequence. Each step should be working before moving to the next.

### 1. Auth + Onboarding
- Supabase auth with magic link (email for dev, phone for production)
- Simple onboarding: name, role selection (patient/caretaker)
- If caretaker: enter invite code to link to patient
- If patient: generate invite code to share with caretaker

### 2. Medication Entry
- **Manual add**: simple form — name, dosage, timing checkboxes (morning/afternoon/evening/bedtime)
- **Scan add**: camera capture → send image to OpenRouter vision model → prompt: "Extract all medication names, dosages, and frequencies from this prescription. Return JSON array: [{name, dosage, frequency}]" → show results for user to confirm/edit/save
- After save: call OpenRouter to generate plain-language `purpose` field ("This medication helps control your blood sugar levels. Take it with food.")
- After save: check interactions against all other active meds via OpenFDA API. Store any findings in interactions table. Show warning banner if found.

### 3. Medication List + Home Screen
- Home screen: today's medication timeline grouped by time slot
- Each med shown as a card: 💊 name + dosage + time + big "✅ Take" button
- Medication list page: all active meds with purpose, warnings badge if interactions exist
- Tap medication → detail view with full explanation + interaction warnings

### 4. Reminders + Adherence
- Auto-generate reminders from medication timing when meds are added
- Default times: morning=08:00, afternoon=12:30, evening=18:00, bedtime=21:30 (user can adjust)
- Create daily adherence_log entries each morning via cron or on-demand
- Confirmation: tap ✅ on home screen → mark as taken, log timestamp
- End of day: any unconfirmed doses auto-marked as 'missed'
- Caretaker alert: if dose not confirmed 60 min after scheduled time, show on caretaker view

### 5. Telegram Bot
- grammy.js webhook at `/api/telegram/webhook`
- `/start` → link Telegram account to web account via one-time code
- `/meds` → list today's medications and status
- Reminder messages sent at scheduled times:
  ```
  💊 吃藥時間到了！(Time for medication!)
  
  🕐 早餐後 (After Breakfast)
  • Metformin 500mg
  • Lisinopril 10mg
  
  [✅ 已服用] [⏰ 稍後提醒] [❌ 跳過]
  ```
- Inline button callbacks → update adherence_logs
- Free text messages → forward to AI chat (same as web chat)

### 6. AI Chat Companion
- Chat page with WhatsApp-style bubbles
- Text input + large 🎤 microphone button
- Voice input: Web Speech API with `lang='zh-TW'`
- Voice output: toggle to read responses aloud via SpeechSynthesis
- Send to OpenRouter with user context (medication list + recent adherence)
- Stream response back
- Store messages in chat_messages table
- Same endpoint serves both web and Telegram chat

### 7. Caretaker View
- Simple page (not a full dashboard): shows linked patient's info
- Today's medication schedule with taken/pending/missed status
- 7-day adherence percentage (simple calculation from adherence_logs)
- List of recent missed doses
- That's it. No charts, no analytics for MVP.

### 8. i18n + UX Polish
- next-intl with zh-TW and en
- All UI strings externalized
- Verify elderly UX: min 18px text, min 48px touch targets, high contrast
- Bottom tab nav: 🏠 Home | 💊 Meds | 💬 Chat | 👤 Profile
- Test on actual phone screen sizes

## AI Chat System Prompt

```
You are MedBuddy (醫伴), a warm medication companion for elderly users.

The user's current medications:
{medications_json}

Recent adherence (last 7 days):
{adherence_summary}

Rules:
- NEVER diagnose conditions or recommend changing/stopping medications
- ALWAYS say "please ask your doctor" for medical decisions
- You CAN explain what medications do in simple terms
- You CAN flag known drug interactions
- You CAN help with reminders and schedules
- You CAN answer general wellness questions
- Respond in {user_locale}
- Use short, simple sentences. No medical jargon.
- Be warm and encouraging, like a caring family member.
```

## API Routes
```
POST /api/medications         — add medication(s)
POST /api/medications/scan    — vision model parse prescription image
GET  /api/medications         — list user's active medications
DELETE /api/medications/[id]  — deactivate medication
GET  /api/interactions        — get interaction warnings for user
POST /api/adherence           — log dose taken/skipped
GET  /api/adherence/today     — today's schedule with status
POST /api/chat                — AI chat (streaming)
GET  /api/caretaker/patient   — get linked patient's data
POST /api/telegram/webhook    — Telegram bot
```

## Environment Variables
```
Already have been set in .env
```

## OpenRouter Setup
All LLM calls go through a single `lib/ai.ts` wrapper:
```typescript
import OpenAI from 'openai';

export const ai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL,
    'X-Title': 'MedBuddy',
  },
});

// Usage: ai.chat.completions.create({ model: process.env.OPENROUTER_MODEL, ... })
```
Swap models by changing the env var. Zero code changes.

## File Structure (keep it flat)
```
src/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx
│   │   ├── page.tsx              (landing/auth)
│   │   ├── home/page.tsx         (today's meds timeline)
│   │   ├── medications/
│   │   │   ├── page.tsx          (list)
│   │   │   ├── add/page.tsx      (manual add)
│   │   │   └── scan/page.tsx     (camera scan)
│   │   ├── chat/page.tsx         (AI companion)
│   │   ├── profile/page.tsx
│   │   └── caretaker/page.tsx    (linked patient view)
│   └── api/
│       ├── medications/
│       ├── adherence/
│       ├── chat/
│       ├── caretaker/
│       └── telegram/
├── components/
│   ├── ui/                       (shadcn)
│   ├── med-card.tsx
│   ├── chat-bubble.tsx
│   ├── voice-button.tsx
│   └── bottom-nav.tsx
├── db/
│   └── schema.ts
├── lib/
│   ├── ai.ts                     (OpenRouter wrapper)
│   ├── drugs.ts                  (OpenFDA interaction check)
│   └── telegram.ts               (grammy bot)
├── i18n/
│   ├── zh-TW.json
│   └── en.json
└── types/
    └── index.ts
```

## What's NOT in MVP (future backlog)
- Doctor visit summary reports
- Vital signs / blood pressure tracking
- IoT device integration
- Nutrition tracking
- Symptom logging
- LINE integration (Telegram proves the pattern)
- Japanese / Korean locales
- B2B hospital dashboard
- Ad monetization
- Premium/paid features

## Design Principles
- If grandma can't use it in 5 seconds, it's wrong
- One action per screen
- Voice is a first-class input, not an afterthought
- Companion, never doctor — hard guardrail
- Scalable architecture, MVP features
