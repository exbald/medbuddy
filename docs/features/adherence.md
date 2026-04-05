# Adherence Tracking

MedBuddy uses on-demand adherence log generation. Instead of a cron job that creates daily logs at midnight, logs are created the first time a user (or their caretaker) requests today's schedule. Past pending doses are lazily marked as missed. Users can configure custom reminder times per slot via their profile.

## Architecture

### On-Demand Log Creation

`GET /api/adherence/today` follows this flow:

1. Query `adherence_log` rows for today's date range (midnight to midnight, UTC-based).
2. If no rows exist, generate them:
   - Fetch all active medications and their `timing` arrays.
   - Fetch the user's `reminder` rows to get custom scheduled times per slot.
   - For each medication/slot combination, create a log row with `status: "pending"` and the appropriate `scheduledAt` timestamp.
3. Re-fetch all today's logs joined with medication details.
4. **Lazy missed marking**: Any log with `status: "pending"` whose `scheduledAt` is in the past gets updated to `status: "missed"`.
5. Group logs by time slot and return in slot order (morning, afternoon, evening, bedtime).

Time slot boundaries are determined by the `scheduledAt` hour:
- Morning: before 11:00
- Afternoon: 11:00 to 15:59
- Evening: 16:00 to 19:59
- Bedtime: 20:00 and later

### Dose Confirmation

`POST /api/adherence` accepts `{ logId, status }` where status is `"taken"` or `"skipped"`. When marked as `"taken"`, the server also records `takenAt` with the current timestamp. The endpoint verifies the log belongs to the requesting user before updating.

Dose confirmation is also available via Telegram inline buttons (see `docs/features/telegram.md`). The `source` field on adherence logs tracks whether the action came from `"web"` or `"telegram"`.

### Reminder Time Configuration

`PATCH /api/profile` accepts a `reminderTimes` object with HH:MM strings for each slot:

```json
{
  "reminderTimes": {
    "morning": "07:30",
    "afternoon": "12:00",
    "evening": "18:30",
    "bedtime": "22:00"
  }
}
```

The handler upserts `reminder` rows for each slot. These custom times are used when generating adherence logs (instead of the defaults).

Default times if no custom reminder is set:
- Morning: 08:00
- Afternoon: 12:30
- Evening: 18:00
- Bedtime: 21:30

### Profile Endpoint

`GET /api/profile` returns the user's profile information along with their current reminder times (with defaults filled in for any missing slots).

## Key Files

| File | Purpose |
|------|---------|
| `src/app/api/adherence/today/route.ts` | GET: on-demand today's schedule generation |
| `src/app/api/adherence/route.ts` | POST: mark a dose as taken or skipped |
| `src/app/api/profile/route.ts` | GET: profile + reminder times; PATCH: update settings |
| `src/lib/schema.ts` | `adherenceLog`, `reminder` tables |

## Configuration

No additional environment variables are needed beyond the base database connection (`POSTGRES_URL`).

## Common Tasks

### Changing default reminder times

Edit the `DEFAULT_SLOT_TIMES` constant in `src/app/api/adherence/today/route.ts` and `src/app/api/medications/route.ts`. Both files define the same defaults and should stay in sync.

### Adding a new adherence status

1. Add the status to the `updateAdherenceSchema` enum in `src/app/api/adherence/route.ts`.
2. Update the lazy missed marking logic in `src/app/api/adherence/today/route.ts` if the new status should be auto-applied.
3. Add translation keys in `messages/en.json` and `messages/zh-TW.json` under the `status` namespace.

### Adding a new time slot

1. Add the slot and its default time to `DEFAULT_SLOT_TIMES` in both `adherence/today/route.ts` and `medications/route.ts`.
2. Update the `getTimeSlot` function's minute boundaries in `adherence/today/route.ts`, `caretaker/patient/route.ts`, and `src/lib/telegram.ts`.
3. Add the slot to `VALID_SLOTS` in `src/app/api/profile/route.ts` and to `VALID_TIMING_SLOTS` in `src/app/api/medications/route.ts`.
4. Add the slot to the `updateProfileSchema` Zod object.
