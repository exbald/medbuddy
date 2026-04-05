# Telegram Bot

MedBuddy integrates a Telegram bot built with grammy.js that allows users to check their medication schedule, confirm doses via inline buttons, and chat with the AI assistant -- all from Telegram. A separate reminder endpoint can be called by an external cron service to push medication reminders.

## Architecture

### Bot Setup

The bot is initialized as a singleton in `src/lib/telegram.ts` using the `TELEGRAM_BOT_TOKEN` environment variable. The module exports the `bot` instance, which is imported by both the webhook handler and the reminders endpoint.

### Webhook Endpoint

`POST /api/telegram/webhook` receives updates from the Telegram Bot API. It passes the raw JSON body to `bot.handleUpdate(body)` and always returns HTTP 200 (even on errors) to prevent Telegram from retrying failed updates.

No authentication is required on this endpoint because Telegram sends updates directly. In production, you can add webhook secret verification if needed.

### Commands

#### `/start <code>` -- Account Linking

Links a Telegram account to a MedBuddy user:

1. If no code is provided, replies with instructions.
2. Looks up the code in the `verification` table (identifier format: `telegram-link:<userId>`).
3. Checks expiry and deletes expired codes.
4. Updates the `user` row to set `telegramChatId` to the Telegram chat ID.
5. Deletes the used verification code.

The linking code is generated from the web app's profile page and stored in the BetterAuth `verification` table with an expiry.

#### `/meds` -- Today's Medication List

Displays today's medication schedule grouped by time slot (Morning, Afternoon, Evening, Bedtime) with status emojis:
- Taken: checkmark
- Pending: hourglass
- Missed: X
- Skipped: skip icon

For pending items, inline keyboard buttons are attached allowing the user to mark each dose as taken or skipped directly from the message.

### Inline Button Callbacks

Callback data format: `taken:<logId>` or `skip:<logId>`.

When a button is pressed:
1. The bot verifies the user is linked and the log belongs to them.
2. Updates the adherence log status and sets `source: "telegram"`.
3. If marking as taken, records `takenAt`.
4. Answers the callback query with a confirmation.
5. Edits the original message to reflect the change.

### Free Text -- AI Chat

Any text message that is not a command is forwarded to the AI:

1. Persists the user message to `chat_message` with `source: "telegram"`.
2. Fetches the user's medications and adherence summary.
3. Builds the same system prompt used by the web chat (via `buildSystemPrompt`).
4. Calls `generateText` (non-streaming, since Telegram does not support streaming).
5. Persists the assistant's reply to `chat_message`.
6. Sends the reply back to the user.

### Reminder Endpoint

`GET /api/telegram/reminders` is designed to be called by an external cron service (e.g., Vercel Cron, Railway cron, or a simple curl job):

1. Optionally validates a `CRON_SECRET` bearer token.
2. Determines the current time slot based on the server's clock.
3. Queries all users with a linked Telegram account (`telegramChatId IS NOT NULL`).
4. For each user, finds pending adherence logs in the current time slot.
5. Sends a reminder message with inline buttons for dose confirmation.
6. Returns a JSON summary: `{ sent: <count>, slot: "<current_slot>" }`.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/telegram.ts` | Bot instance, commands (/start, /meds), callbacks, free-text AI chat |
| `src/app/api/telegram/webhook/route.ts` | POST: receives Telegram webhook updates |
| `src/app/api/telegram/reminders/route.ts` | GET: sends medication reminders (cron-triggered) |
| `src/lib/chat-prompt.ts` | Shared system prompt builder (used by both web and Telegram) |
| `src/lib/schema.ts` | `user.telegramChatId`, `verification` (linking codes), `chatMessage`, `adherenceLog` |

## Configuration

| Environment Variable | Purpose |
|---------------------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `CRON_SECRET` | Optional bearer token to protect the reminders endpoint |
| `OPENROUTER_API_KEY` | API key for AI chat responses |
| `OPENROUTER_MODEL` | AI model for text generation |

### Setting Up the Webhook

Register the webhook URL with Telegram:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/api/telegram/webhook"}'
```

### Setting Up Reminders

Configure an external cron job to hit the reminders endpoint at the desired intervals. For example, four times daily at each slot's default time:

```
0 8 * * *    curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/telegram/reminders
30 12 * * *  curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/telegram/reminders
0 18 * * *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/telegram/reminders
30 21 * * *  curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/telegram/reminders
```

## Common Tasks

### Adding a new bot command

Add a new `bot.command("name", async (ctx) => { ... })` handler in `src/lib/telegram.ts`. The handler has access to the grammy context object for replying, sending keyboards, etc.

### Changing reminder timing

The reminder endpoint determines the current slot based on server time. Adjust the cron schedule to match your users' timezone. The `getCurrentTimeSlot` function in the reminders route uses the same minute boundaries as the rest of the app.

### Adding webhook secret verification

Telegram supports setting a `secret_token` when registering the webhook. You can add header validation in `src/app/api/telegram/webhook/route.ts` by checking `req.headers.get("X-Telegram-Bot-Api-Secret-Token")`.
