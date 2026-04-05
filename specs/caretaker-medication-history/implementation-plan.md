# Implementation Plan: Caretaker Medication History

## Overview

Add a day-by-day medication history view for caretakers: a new date utility, API endpoint, shared UI components, translations, and a history page with date navigation.

## Parallel Execution Strategy

Tasks are organized into waves. All tasks in a wave can run concurrently.
Each wave depends on the previous wave completing.

---

## Wave 1: Foundation

**Goal:** Add date utility, translations, and extract shared components — all independent of each other.

### Tasks

- [ ] w1-date-util: Add `getTaipeiDayBounds()` to constants.ts `agents: [general]`
- [ ] w1-translations: Add `caretaker.history.*` keys to both locale files `agents: [general]`
- [ ] w1-shared-components: Extract StatusIcon and MedicationRow into shared `_components/` `agents: [general]`

### Technical Details

**w1-date-util** — `src/lib/constants.ts`

Add function after `getTaipeiToday()`:

```typescript
/**
 * Returns day boundaries for a given YYYY-MM-DD date string in Taipei timezone,
 * expressed as UTC Date objects suitable for database queries.
 */
export function getTaipeiDayBounds(dateStr: string): {
  dayStart: Date
  dayEnd: Date
} {
  const [year, month, day] = dateStr.split("-").map(Number)
  // Construct midnight in Taipei as a UTC date, then subtract offset
  const taipeiMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  const dayStart = new Date(taipeiMidnight.getTime() - TAIPEI_OFFSET_MS)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
  return { dayStart, dayEnd }
}
```

**w1-translations** — `messages/en.json` and `messages/zh-TW.json`

Add under existing `"caretaker"` key:

en:
```json
"history": {
  "title": "Medication History",
  "viewHistory": "View History",
  "today": "Today",
  "daySummary": "{taken} of {total} taken",
  "noLogs": "No medication records for this day",
  "back": "Back"
}
```

zh-TW:
```json
"history": {
  "title": "服藥紀錄",
  "viewHistory": "查看紀錄",
  "today": "今天",
  "daySummary": "已服用 {taken} / {total}",
  "noLogs": "這天沒有服藥紀錄",
  "back": "返回"
}
```

**w1-shared-components**

File: `src/app/[locale]/(app)/caretaker/_components/status-icon.tsx`

Extract `StatusIcon` from `caretaker/page.tsx` lines 66-86. Add `skipped` case:

```tsx
import { Check, Clock, SkipForward, X } from "lucide-react"

export function StatusIcon({ status }: { status: string }) {
  if (status === "taken") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
      </div>
    )
  }
  if (status === "missed") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
        <X className="h-4 w-4 text-destructive" />
      </div>
    )
  }
  if (status === "skipped") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
        <SkipForward className="h-4 w-4 text-muted-foreground" />
      </div>
    )
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/10">
      <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
    </div>
  )
}
```

File: `src/app/[locale]/(app)/caretaker/_components/medication-row.tsx`

Extract medication row from `caretaker/page.tsx` lines 244-276:

```tsx
import { Badge } from "@/components/ui/badge"
import { StatusIcon } from "./status-icon"

interface MedicationRowProps {
  name: string
  nameLocal: string | null
  dosage: string | null
  status: "pending" | "taken" | "missed" | "skipped"
  statusLabel: string
}

export function MedicationRow({ name, nameLocal, dosage, status, statusLabel }: MedicationRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <StatusIcon status={status} />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-tight">
          {name}
          {nameLocal && nameLocal !== name && (
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              {nameLocal}
            </span>
          )}
        </p>
        {dosage && (
          <p className="text-xs text-muted-foreground">{dosage}</p>
        )}
      </div>
      <Badge
        variant={
          status === "taken"
            ? "default"
            : status === "missed"
              ? "destructive"
              : "secondary"
        }
        className="shrink-0"
      >
        {statusLabel}
      </Badge>
    </div>
  )
}
```

Then update `src/app/[locale]/(app)/caretaker/page.tsx`:
- Remove inline `StatusIcon` definition (lines 66-86)
- Import `StatusIcon` and `MedicationRow` from `./_components/`
- Replace the inline medication row JSX (lines 244-276) with `<MedicationRow>` usage
- Existing behavior must remain identical

---

## Wave 2: API Endpoint

**Goal:** Create the history API endpoint that the history page will consume.
**Depends on:** Wave 1 (needs `getTaipeiDayBounds`)

### Tasks

- [ ] w2-history-api: Create `GET /api/caretaker/patient/history` endpoint `agents: [general]`

### Technical Details

File: `src/app/api/caretaker/patient/history/route.ts`

Auth pattern — copy from `src/app/api/caretaker/patient/route.ts` lines 16-48:
1. `auth.api.getSession()` — 401 if no session
2. Query `user.role` — 403 if not `"caretaker"`
3. Query `caretakerLink` for `patientId` — return `{ error: "No patient linked" }` if none

Query param: `?date=YYYY-MM-DD`
- Default to today (use `getTaipeiToday()` for today's date string)
- Validate format with regex `/^\d{4}-\d{2}-\d{2}$/`
- Validate within 30-day window: `dayStart >= 30 days ago` and `dayStart <= today`
- Return 400 for invalid dates

Data query:
```typescript
import { eq, and, gte, lt, desc } from "drizzle-orm"

const { dayStart, dayEnd } = getTaipeiDayBounds(dateStr)

const logs = await db
  .select({
    logId: adherenceLog.id,
    medicationId: adherenceLog.medicationId,
    scheduledAt: adherenceLog.scheduledAt,
    takenAt: adherenceLog.takenAt,
    status: adherenceLog.status,
    medName: medication.name,
    medNameLocal: medication.nameLocal,
    medDosage: medication.dosage,
  })
  .from(adherenceLog)
  .innerJoin(medication, eq(adherenceLog.medicationId, medication.id))
  .where(
    and(
      eq(adherenceLog.userId, patientId),
      gte(adherenceLog.scheduledAt, dayStart),
      lt(adherenceLog.scheduledAt, dayEnd),
    ),
  )
  .orderBy(adherenceLog.scheduledAt)
```

Group by time slot using `getTimeSlot()` — same pattern as existing route lines 104-122.

Compute summary:
```typescript
let taken = 0, missed = 0, skipped = 0, pending = 0
for (const group of schedule) {
  for (const med of group.medications) {
    if (med.status === "taken") taken++
    else if (med.status === "missed") missed++
    else if (med.status === "skipped") skipped++
    else pending++
  }
}
const total = taken + missed + skipped + pending
const percentage = total > 0 ? Math.round((taken / total) * 100) : 0
```

Response shape:
```json
{
  "date": "2026-04-05",
  "patient": { "name": "..." },
  "schedule": [
    {
      "timeSlot": "morning",
      "scheduledTime": "08:00",
      "medications": [
        {
          "logId": "...",
          "medicationId": "...",
          "name": "...",
          "nameLocal": "...",
          "dosage": "...",
          "status": "taken",
          "scheduledAt": "...",
          "takenAt": "..."
        }
      ]
    }
  ],
  "summary": { "taken": 3, "missed": 1, "skipped": 0, "pending": 0, "total": 4, "percentage": 75 }
}
```

**Do NOT call `ensureTodayLogs()`** — this endpoint is read-only for historical data.

---

## Wave 3: History Page + Dashboard Link

**Goal:** Build the history page UI and add navigation from the dashboard.
**Depends on:** Wave 1 (shared components, translations) and Wave 2 (API endpoint)

### Tasks

- [ ] w3-history-page: Create the caretaker history page `agents: [general]`
- [ ] w3-dashboard-link: Add "View History" link to caretaker dashboard `agents: [general]`

### Technical Details

**w3-history-page** — `src/app/[locale]/(app)/caretaker/history/page.tsx`

Client component (`"use client"`).

State:
- `currentDate: string` — YYYY-MM-DD, initialized to today
- `data: HistoryData | null`
- `isLoading: boolean`
- `error: string | null`

Hooks:
- `useTranslations("caretaker")` for `t("history.title")`, etc.
- `useTranslations("timeSlots")` for slot labels
- `useTranslations("status")` for status badge labels
- `useLocale()` for date formatting

Date navigation helpers:
```typescript
// Get today in YYYY-MM-DD (Taipei time)
function getTodayStr(): string {
  const now = new Date()
  const taipeiMs = now.getTime() + 8 * 60 * 60 * 1000
  const d = new Date(taipeiMs)
  return d.toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const minDate = addDays(getTodayStr(), -29) // 30-day window
const isToday = currentDate === getTodayStr()
const isOldest = currentDate === minDate
```

Date display using locale:
```typescript
const locale = useLocale()
const displayDate = new Intl.DateTimeFormat(locale === "zh-TW" ? "zh-TW" : "en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
}).format(new Date(currentDate + "T00:00:00+08:00"))
```

Layout (mobile-first, `mx-auto max-w-lg p-4`):

1. **Back link** — `<Link href="/caretaker">` with `ChevronLeft` icon + `t("history.back")`
2. **Title** — `<h1>{t("history.title")}</h1>`
3. **Date nav bar** — flex row:
   - `<Button variant="ghost" size="icon" disabled={isOldest}>` `<ChevronLeft />`
   - `<span className="text-sm font-medium">{displayDate}</span>`
   - `<Button variant="ghost" size="icon" disabled={isToday}>` `<ChevronRight />`
   - `<Button variant="outline" size="sm" disabled={isToday}>{t("history.today")}</Button>`
4. **Day summary card** — Card with percentage, taken/total text, progress bar (same style as weekStats on dashboard)
5. **Time slot groups** — same Card-per-slot pattern as dashboard, using `<MedicationRow>` component
6. **Empty state** — Card with Pill icon + `t("history.noLogs")`

Fetch on `currentDate` change:
```typescript
useEffect(() => {
  let cancelled = false
  setIsLoading(true)
  setError(null)
  fetch(`/api/caretaker/patient/history?date=${currentDate}`)
    .then(res => { if (!res.ok) throw new Error(...); return res.json() })
    .then(result => { if (!cancelled) setData(result) })
    .catch(err => { if (!cancelled) setError(err.message) })
    .finally(() => { if (!cancelled) setIsLoading(false) })
  return () => { cancelled = true }
}, [currentDate])
```

Loading/error states — same patterns as `caretaker/page.tsx` (Loader2 spinner, AlertCircle + retry).

**w3-dashboard-link** — `src/app/[locale]/(app)/caretaker/page.tsx`

After the weekly adherence `</section>` (line 217), add:

```tsx
<div className="mb-6 flex justify-end">
  <Button variant="outline" size="sm" asChild>
    <Link href="/caretaker/history">
      <History className="mr-2 h-4 w-4" />
      {t("history.viewHistory")}
    </Link>
  </Button>
</div>
```

Import `History` from `lucide-react`.

---

## Wave 4: Verification

**Goal:** Ensure everything compiles and works correctly.
**Depends on:** Wave 3

### Tasks

- [ ] w4-verify: Run lint, typecheck, and manual smoke test `agents: [general]`

### Technical Details

```bash
npm run lint && npm run typecheck
```

Verify:
- No TypeScript errors
- No ESLint violations
- Existing caretaker dashboard renders correctly with shared components
- History page fetches and displays data for different dates
- Date navigation prev/next/today buttons work correctly
- Empty state displays for days with no logs
- Both en and zh-TW locales render properly
