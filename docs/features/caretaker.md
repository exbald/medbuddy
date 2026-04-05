# Caretaker Dashboard

Caretakers can monitor their linked patient's medication adherence through a dedicated dashboard. The linking is established during onboarding via invite codes (see `docs/features/auth-onboarding.md`). The bottom navigation adapts based on the user's role, showing a "Patient" tab instead of "Home" for caretakers.

## Architecture

### Patient Data Endpoint

`GET /api/caretaker/patient` is the single endpoint that powers the caretaker dashboard. It:

1. Verifies the user has the `caretaker` role (returns 403 if not).
2. Looks up the linked patient via the `caretaker_link` table. Returns `{ patient: null }` with 200 if no link exists.
3. Fetches the patient's profile (name, email) and active medications.
4. Ensures today's adherence logs exist using the same on-demand generation logic as `GET /api/adherence/today` (see `docs/features/adherence.md`). Past pending logs are lazily marked as missed.
5. Groups today's logs by time slot (morning, afternoon, evening, bedtime).
6. Computes 7-day adherence statistics: taken, missed, pending, total, and percentage.
7. Fetches up to 20 recent missed doses from the past 7 days.

The response shape:

```json
{
  "patient": { "name": "...", "email": "..." },
  "medications": [...],
  "todaySchedule": [
    {
      "timeSlot": "morning",
      "scheduledTime": "08:00",
      "medications": [{ "logId": "...", "status": "taken", ... }]
    }
  ],
  "weekStats": { "taken": 10, "missed": 2, "pending": 3, "total": 15, "percentage": 67 },
  "recentMissed": [{ "name": "...", "scheduledAt": "..." }]
}
```

### Caretaker Page

The page at `/[locale]/(app)/caretaker/page.tsx` is a client component that fetches data from `/api/caretaker/patient` on mount. It displays:

1. **Header** -- "Patient Monitor" with the patient's name.
2. **7-Day Adherence** -- Percentage display with a progress bar and breakdown of taken/missed/pending counts.
3. **Today's Schedule** -- Time-slot cards showing each medication with a status icon (green check for taken, red X for missed, yellow clock for pending) and a badge.
4. **Recent Missed Doses** -- A list of up to 20 missed doses from the past week, each showing the medication name, dosage, date, and time.

If no patient is linked, the page shows an empty state with a link to the onboarding page.

### Role-Aware Navigation

The `BottomNav` component in `src/components/bottom-nav.tsx` accepts a `role` prop and renders different navigation items:

- **Patient** navigation: Home, Meds, Chat, Profile
- **Caretaker** navigation: Patient (caretaker dashboard), Meds, Chat, Profile

The caretaker's first tab links to `/caretaker` instead of `/home`, using the `HeartPulse` icon. Active state is determined by `pathname.startsWith(item.href)`.

## Key Files

| File | Purpose |
|------|---------|
| `src/app/[locale]/(app)/caretaker/page.tsx` | Caretaker dashboard UI |
| `src/app/api/caretaker/patient/route.ts` | GET: patient info, schedule, adherence stats |
| `src/components/bottom-nav.tsx` | Role-aware bottom navigation |
| `src/lib/schema.ts` | `caretakerLink` table (links caretaker to patient) |

## Configuration

No additional environment variables are needed. The caretaker feature relies on the same database and auth configuration as the rest of the app.

## Common Tasks

### Allowing a caretaker to link multiple patients

Currently, the API fetches only the first `caretaker_link` row for the caretaker. To support multiple patients:
1. Remove `.limit(1)` from the link query in `src/app/api/caretaker/patient/route.ts`.
2. Add a patient selector UI in the caretaker page.
3. Accept a `patientId` query parameter in the API to select which patient to view.

### Adding caretaker actions (e.g., marking doses for the patient)

Create a new endpoint (e.g., `POST /api/caretaker/adherence`) that:
1. Verifies the user is a caretaker.
2. Verifies the target adherence log belongs to their linked patient.
3. Updates the log status with `source: "caretaker"`.

### Customizing the adherence stats window

The 7-day window is computed as `todayStart - 6 days`. To change it, modify `weekStart` in `src/app/api/caretaker/patient/route.ts`.
