# Requirements: Caretaker Medication History

## Summary

Allow caretakers to browse a day-by-day medication history for their linked patient, showing which doses were taken, missed, or skipped over the past 30 days.

## Problem

Caretakers currently only see today's schedule and a 7-day summary on the dashboard. They cannot investigate what happened on a specific past day — e.g., "Did mom take her blood pressure medication last Tuesday?" The data already exists in the `adherenceLog` table; it's just not exposed.

## Solution

Add a dedicated history page (`/caretaker/history`) with prev/next day navigation, showing each day's medication doses grouped by time slot (morning/afternoon/evening/bedtime) with status indicators. A day summary card shows the adherence rate for that day.

## Acceptance Criteria

- [ ] Caretaker can navigate to a "Medication History" page from the dashboard
- [ ] History page shows one day at a time with prev/next day buttons and a "Today" shortcut
- [ ] Each day displays medications grouped by time slot (morning, afternoon, evening, bedtime)
- [ ] Each medication row shows: name, local name (Chinese), dosage, and status (taken/missed/skipped/pending)
- [ ] Day summary card shows taken count vs total and a progress bar
- [ ] Navigation is bounded: no further than 30 days in the past, no future dates
- [ ] Days with no adherence logs show an empty state message
- [ ] Page works in both zh-TW and en locales
- [ ] Existing caretaker dashboard continues to work after refactoring
- [ ] Passes `npm run lint && npm run typecheck`

## Dependencies

- Existing `adherenceLog` table with status tracking (already populated by patient's daily usage)
- Existing `caretakerLink` table for authorization (caretaker → patient mapping)
- Existing caretaker auth pattern (`/api/caretaker/patient/route.ts`)
- Existing date/timezone utilities in `src/lib/constants.ts`
- shadcn/ui components: Card, Badge, Button (already installed)
