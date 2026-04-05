# MedBuddy 藥好友

A medication companion app for elderly chronic care patients. Scan prescriptions, understand medications, get reminders, confirm doses, and chat with an AI companion — all in Traditional Chinese (zh-TW) with English support.

## Features

- **Prescription Scanning** — Camera capture with vision model OCR to extract medications automatically
- **Medication Management** — Track active medications with plain-language explanations and interaction warnings
- **Smart Reminders** — Scheduled notifications via web push and Telegram bot
- **Dose Confirmation** — One-tap confirmation with adherence logging
- **AI Chat Companion** — Answer medication questions with voice input/output, never gives medical advice
- **Caretaker View** — Simple page showing a linked patient's schedule and adherence status
- **Telegram Bot** — Reminders, confirmations, and chat via Telegram
- **i18n** — Traditional Chinese (primary) and English via next-intl

## Tech Stack

- **Framework**: Next.js 16, React 19, TypeScript
- **AI**: Vercel AI SDK 5 + OpenRouter (100+ models)
- **Auth**: BetterAuth (email/password)
- **Database**: PostgreSQL + Drizzle ORM
- **Bot**: grammy.js (Telegram)
- **UI**: shadcn/ui, Tailwind CSS 4, mobile-first
- **Voice**: Browser-native Web Speech API (STT + TTS)

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL (local or hosted)
- OpenRouter API key ([get one here](https://openrouter.ai/settings/keys))

### Setup

```bash
git clone <your-repo-url> medbuddy
cd medbuddy
npm install
cp env.example .env
# Edit .env with your credentials
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

See `env.example` for all required and optional variables:

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | 32+ char random secret |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `OPENROUTER_MODEL` | No | Model ID (default: `openai/gpt-5-mini`) |
| `NEXT_PUBLIC_APP_URL` | No | Production URL |
| `BLOB_READ_WRITE_TOKEN` | No | Vercel Blob token (uses local storage if unset) |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token for reminders |

## Project Structure

```
src/
├── app/
│   ├── [locale]/              # i18n routes (zh-TW, en)
│   │   ├── (app)/             # Authenticated app pages
│   │   │   ├── home/          # Today's medication timeline
│   │   │   ├── medications/   # Medication list, add, scan
│   │   │   ├── chat/          # AI companion
│   │   │   ├── profile/       # User profile
│   │   │   ├── caretaker/     # Linked patient view
│   │   │   └── onboarding/    # New user setup
│   │   └── layout.tsx
│   └── api/
│       ├── medications/       # CRUD + scan
│       ├── adherence/         # Dose logging
│       ├── chat/              # AI chat (streaming)
│       ├── caretaker/         # Patient data for caretakers
│       ├── interactions/      # Drug interaction checks
│       ├── onboarding/        # Onboarding flow
│       ├── profile/           # User profile
│       └── telegram/          # Bot webhook
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── med-card.tsx           # Medication card
│   ├── chat-bubble.tsx        # Chat message bubble
│   ├── voice-button.tsx       # Voice input button
│   └── bottom-nav.tsx         # Mobile tab navigation
├── i18n/                      # Internationalization config
├── lib/
│   ├── ai.ts                  # OpenRouter wrapper
│   ├── drugs.ts               # Drug interaction checks
│   ├── telegram.ts            # Telegram bot setup
│   ├── auth.ts                # BetterAuth config
│   ├── db.ts                  # Database connection
│   └── schema.ts              # Drizzle schema
└── messages/                  # i18n translation files
```

## Scripts

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Build for production
npm run lint         # ESLint
npm run typecheck    # TypeScript checking
npm run db:generate  # Generate migrations
npm run db:migrate   # Run migrations
npm run db:studio    # Drizzle Studio (DB GUI)
npm run db:reset     # Reset database
```

## Design Principles

- If grandma can't use it in 5 seconds, it's wrong
- One action per screen
- Voice is a first-class input, not an afterthought
- Companion, never doctor — hard guardrail
- Min 18px text, min 48px touch targets, high contrast

## License

MIT
