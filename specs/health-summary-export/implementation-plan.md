# Implementation Plan: Health Summary Export

## Overview

Add a "Generate Health Summary" button to the profile page that navigates to a print-optimized summary page. The summary is server-rendered with medication data, adherence stats, and interaction warnings, plus an AI-generated narrative streamed on the client.

No new dependencies. Uses browser print-to-PDF. Zero-dependency approach.

## Parallel Execution Strategy

Tasks are organized into waves. All tasks in a wave can run concurrently.
Each wave depends on the previous wave completing.

---

## Wave 1: API + Data Layer

**Goal:** Build the API endpoint that assembles all summary data and generates the AI narrative.

### Tasks
- [x] w1-summary-api: Create `GET /api/health-summary` endpoint `agents: [general]`
- [x] w1-i18n-keys: Add health summary translation keys to both locale files `agents: [general]`

### Technical Details

**`src/app/api/health-summary/route.ts`**

Auth: require session (same pattern as all other API routes).

Query params:
- `period`: `7 | 14 | 30` (default `14`) — days of adherence data
- `for`: `self | patient` (default `self`) — caretaker generating for linked patient

Data assembly (reuse existing query patterns):

1. **Medications** — query `medication` where `userId` and `active = true`, select `name, nameLocal, dosage, purpose, timing`. Pattern: `src/app/api/caretaker/patient/route.ts` lines 63-72.

2. **Adherence stats** — query `adherence_log` grouped by status for the period. Pattern: `src/app/api/caretaker/patient/route.ts` lines 130-161 (parameterize date range instead of hardcoded 7 days).

3. **Per-medication adherence** — query `adherence_log` joined with `medication`, grouped by `medicationId` + `status`, for the period. This gives per-med taken/missed/total.

4. **Interactions** — query `interaction` with medication name joins, ordered by severity. Pattern: `src/app/api/interactions/route.ts`.

5. **AI narrative** — use `generateText` with `defaultModel` from `src/lib/ai.ts`:
   ```
   System: You are a medical summary assistant. Generate a concise 3-5 sentence
   narrative in {locale} summarizing this patient's medication adherence patterns.
   Flag any concerns (low adherence, high-severity interactions, frequently missed
   medications). Be factual, not diagnostic. End with "請與您的醫師討論" or
   "Please discuss with your doctor."

   User: {assembled medication + adherence + interaction data as JSON}
   ```
   Pattern: `src/lib/telegram.ts` line ~392 (`generateText` call).

Response shape:
```typescript
{
  patient: { name: string },
  generatedAt: string,        // ISO date
  period: number,             // days
  medications: Array<{
    name: string,
    nameLocal: string | null,
    dosage: string,
    purpose: string | null,
    timing: string[],
    adherence: { taken: number, missed: number, total: number, percentage: number }
  }>,
  overallAdherence: { taken: number, missed: number, pending: number, total: number, percentage: number },
  interactions: Array<{
    medAName: string, medBName: string,
    severity: string, type: string, description: string
  }>,
  narrative: string           // AI-generated
}
```

**i18n keys** — add to `messages/zh-TW.json` and `messages/en.json`:
```json
"healthSummary": {
  "title": "健康摘要報告 / Health Summary Report",
  "generate": "產生健康摘要 / Generate Health Summary",
  "generating": "正在產生... / Generating...",
  "period": "{days} 天用藥紀錄 / {days}-Day Medication Record",
  "medications": "目前用藥 / Current Medications",
  "adherence": "服藥遵從率 / Medication Adherence",
  "interactions": "藥物交互作用 / Drug Interactions",
  "noInteractions": "未發現藥物交互作用 / No drug interactions found",
  "narrative": "AI 摘要 / AI Summary",
  "disclaimer": "此摘要由 AI 自動產生，非正式醫療紀錄。請與您的醫師討論。 / This summary is auto-generated and is not a medical record. Please discuss with your doctor.",
  "print": "列印 / Print",
  "periodSelect": "報告期間 / Report Period",
  "days7": "7 天 / 7 Days",
  "days14": "14 天 / 14 Days",
  "days30": "30 天 / 30 Days",
  "taken": "已服 / Taken",
  "missed": "未服 / Missed",
  "overallRate": "整體遵從率 / Overall Rate"
}
```

---

## Wave 2: Summary Page (UI)

**Goal:** Build the print-optimized summary page and add the entry point button.
**Depends on:** Wave 1

### Tasks
- [x] w2-summary-page: Create the health summary page at `src/app/[locale]/(app)/health-summary/page.tsx` `agents: [general]`
- [x] w2-profile-button: Add "Generate Health Summary" button to profile page `agents: [general]`

### Technical Details

**`src/app/[locale]/(app)/health-summary/page.tsx`** — Client component

URL: `/{locale}/health-summary?period=14`

Page structure:
```
┌─────────────────────────────────────┐
│ 健康摘要報告          [period ▼] [🖨] │
│ Patient Name · 2026-04-06           │
│ 14天用藥紀錄                         │
├─────────────────────────────────────┤
│ AI 摘要                              │
│ [3-5 sentence narrative]            │
├─────────────────────────────────────┤
│ 目前用藥 (4)                         │
│ ┌─────────────────────────────────┐ │
│ │ Metformin 降糖錠 500mg          │ │
│ │ 控制血糖 · 早上/晚上             │ │
│ │ 遵從率: 92% (46/50)            │ │
│ └─────────────────────────────────┘ │
│ [more med cards...]                 │
├─────────────────────────────────────┤
│ 服藥遵從率                           │
│ 整體: 85% · 已服 120 · 未服 21      │
│ [simple bar or text breakdown]      │
├─────────────────────────────────────┤
│ ⚠ 藥物交互作用 (2)                   │
│ Metformin ↔ Lisinopril — 中等風險   │
│ [description]                       │
├─────────────────────────────────────┤
│ ⚕ 此摘要由AI自動產生，非正式醫療紀錄  │
└─────────────────────────────────────┘
```

Implementation:
- `useSearchParams` for `period` (default 14)
- `useEffect` → `fetch("/api/health-summary?period=X")` on mount and period change
- Loading state: `Skeleton` components (reuse existing pattern)
- Period selector: 3 radio-style buttons (7/14/30) — `min-h-12` for elderly UX
- Print button: `window.print()` — large, prominent
- Print CSS: `@media print` rules to hide nav, period selector, print button; force white background; A4-friendly margins

Styling:
- Use existing shadcn `Card`, `Badge`, `Separator` components
- Severity badges reuse `medications.detail.severity.*` translations
- Timing badges reuse `timeSlots.*` translations
- `@media print` block in the page or a scoped CSS module:
  ```css
  @media print {
    .no-print { display: none; }
    body { font-size: 12pt; }
    .summary-page { max-width: 100%; padding: 0; }
  }
  ```

**Profile page entry point** — `src/app/[locale]/(app)/profile/page.tsx`

Add a new accordion section (or a button in an existing section) that links to the summary page:
```tsx
<Link href={`/${locale}/health-summary`}>
  <Button className="w-full min-h-12 text-base">
    <FileText className="h-5 w-5 mr-2" />
    {t("healthSummary.generate")}
  </Button>
</Link>
```

Caretaker variant: same button, but links to `?for=patient`.

---

## Wave 3: Polish + Caretaker Support

**Goal:** Ensure caretaker access works, add print styles, verify end-to-end.
**Depends on:** Wave 2

### Tasks
- [x] w3-caretaker-access: Ensure caretaker can generate summary for linked patient `agents: [general]`
- [x] w3-print-polish: Add print media styles and test print output `agents: [general]`

### Technical Details

**Caretaker access** in API:
- If `for=patient`, look up `caretaker_link` where `caretakerId = session.user.id`
- Use `patientId` instead of `userId` for all queries
- Return patient's name in response
- 403 if no link found

**Caretaker UI**:
- On caretaker dashboard (`src/app/[locale]/(app)/caretaker/page.tsx`), add a "Generate Health Summary" button linking to `/{locale}/health-summary?for=patient`

**Print polish**:
- Add `@media print` styles to `globals.css` or a dedicated print stylesheet
- Hide: bottom nav, period selector, print button, back navigation
- Show: all content expanded, no scroll, white background
- Test: Chrome print preview should produce a clean 1-2 page A4 document
- Add `<title>` tag with patient name + date for PDF filename

---

## File Summary

| File | Action |
|---|---|
| `src/app/api/health-summary/route.ts` | Create — API endpoint |
| `src/app/[locale]/(app)/health-summary/page.tsx` | Create — Summary page |
| `src/app/[locale]/(app)/profile/page.tsx` | Edit — Add generate button |
| `src/app/[locale]/(app)/caretaker/page.tsx` | Edit — Add generate button |
| `messages/zh-TW.json` | Edit — Add healthSummary keys |
| `messages/en.json` | Edit — Add healthSummary keys |
| `src/app/globals.css` | Edit — Add print media styles |
