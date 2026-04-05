# AI Chat

MedBuddy provides an AI chat companion that has full context of the user's medications and recent adherence history. The chat supports voice input via the Web Speech API, voice output via SpeechSynthesis, and persists messages to the database. The same system prompt builder is shared between the web chat and the Telegram bot.

## Architecture

### System Prompt

`buildSystemPrompt` in `src/lib/chat-prompt.ts` constructs the system message sent to the AI model. It includes:

- The user's active medications as JSON (name, Chinese name, dosage, purpose, timing).
- A 7-day adherence summary (taken/total percentage, missed count, pending count).
- Behavioral rules: never diagnose, always recommend consulting a doctor, use simple language, respond in the user's locale (Traditional Chinese or English).

The prompt is rebuilt on every request to ensure it reflects the latest medication and adherence data.

### Chat API

`POST /api/chat/route.ts` handles chat requests:

1. Validates the request body using a Zod schema that expects an array of `UIMessage` objects (matching the Vercel AI SDK `useChat` format).
2. Fetches the user's locale, active medications, and 7-day adherence summary.
3. Builds the system prompt.
4. Persists the last user message to the `chat_message` table (with deduplication by message ID).
5. Calls `streamText` with the `defaultModel` from OpenRouter.
6. On stream finish, persists the assistant's response to the `chat_message` table.
7. Returns a `UIMessageStreamResponse` for streaming to the client.

### Message Persistence

`GET /api/chat/messages` returns the most recent 50 messages for the user (user and assistant roles only, excluding system messages), ordered chronologically. The chat page loads this history on mount and populates the `useChat` state.

Messages from both web and Telegram are stored in the same `chat_message` table with a `source` field to distinguish origin.

### Client-Side Chat

The chat page at `/[locale]/(app)/chat/page.tsx` uses the Vercel AI SDK's `useChat` hook for streaming. Key features:

- **History loading**: On mount, fetches `/api/chat/messages` and hydrates the chat state.
- **Auto-scroll**: Scrolls to the bottom on new messages and during streaming.
- **Auto-resize textarea**: The input grows up to 120px as the user types.
- **Enter to send**: Enter sends the message; Shift+Enter creates a new line.

### Voice Input

The `VoiceButton` component in `src/components/voice-button.tsx` wraps the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`):

- Uses `useSyncExternalStore` to check browser support (returns `null` if unsupported).
- Configures `lang` based on the current locale (defaults to `zh-TW`).
- On result, the transcript is sent directly as a chat message.
- Shows a pulsing microphone icon while listening.

### Voice Output

The `ChatBubble` component in `src/components/chat-bubble.tsx` renders a "read aloud" button on assistant messages. Clicking it uses `SpeechSynthesisUtterance` with:
- `lang` set to the user's locale.
- `rate` set to 0.9 for slightly slower speech (suited for elderly users).

The chat page also has an "auto-read" toggle in the header. When enabled, every new assistant response is automatically read aloud via the `onFinish` callback from `useChat`.

## Key Files

| File | Purpose |
|------|---------|
| `src/app/api/chat/route.ts` | POST: streaming chat with AI (persists messages) |
| `src/app/api/chat/messages/route.ts` | GET: load message history (last 50) |
| `src/app/[locale]/(app)/chat/page.tsx` | Chat page UI with streaming, voice, auto-scroll |
| `src/lib/chat-prompt.ts` | `buildSystemPrompt` -- shared system prompt builder |
| `src/lib/ai.ts` | OpenRouter model configuration |
| `src/components/voice-button.tsx` | Web Speech API voice input button |
| `src/components/chat-bubble.tsx` | Message bubble with SpeechSynthesis read-aloud |
| `src/lib/schema.ts` | `chatMessage` table |

## Configuration

| Environment Variable | Purpose |
|---------------------|---------|
| `OPENROUTER_API_KEY` | API key for OpenRouter |
| `OPENROUTER_MODEL` | Chat model (defaults to `google/gemini-2.5-flash`) |

## Common Tasks

### Modifying the AI personality

Edit the system prompt template in `src/lib/chat-prompt.ts`. The rules section controls what the AI can and cannot do. Changes here affect both the web chat and the Telegram bot.

### Changing the message history limit

Edit the `.limit(50)` in `src/app/api/chat/messages/route.ts` to return more or fewer messages.

### Adding tool use or function calling

Extend the `streamText` call in `src/app/api/chat/route.ts` with a `tools` parameter. The Vercel AI SDK supports tool definitions that the model can invoke during the conversation.

### Adjusting voice settings

- Speech recognition language: passed via the `lang` prop to `VoiceButton`. Set in the chat page based on `useLocale()`.
- Speech synthesis rate: set to `0.9` in both `chat-bubble.tsx` and `chat/page.tsx`. Increase for faster speech, decrease for slower.
