# Requirements: Doctor-Ready Health Summary Export

## Summary

Generate a concise, printable health summary that elderly patients can bring to doctor appointments — covering current medications, adherence patterns, drug interactions, and an AI-generated narrative in Traditional Chinese.

## Problem

Elderly chronic care patients in Taiwan see multiple specialists who don't share medication records. Patients struggle to recall what they take, when they last missed doses, or what interactions exist. Doctors get incomplete verbal reports and make decisions with missing context. A structured, up-to-date medication summary bridges this communication gap.

## Solution

A one-tap "Generate Health Summary" feature that:
1. Assembles the patient's current medication list, adherence stats (configurable period: 7/14/30 days), and drug interaction warnings
2. Uses AI to generate a concise natural-language narrative in the patient's locale (zh-TW or en)
3. Renders a clean, printable HTML page optimized for A4 paper
4. Provides print and share options (browser print → PDF, or copy link)

**Why HTML instead of PDF?** Zero new dependencies, works on every device, browser print-to-PDF produces clean A4 output, and the page can also be shared as a URL. Avoids adding `pdfkit` or `@react-pdf/renderer` to the bundle.

## Acceptance Criteria

- [ ] Patient can generate a health summary from their profile page
- [ ] Summary includes: patient name, report date, medication list (name, Chinese name, dosage, purpose, timing), adherence stats for selected period, drug interaction warnings (severity-sorted), AI narrative
- [ ] AI narrative is 3-5 sentences summarizing adherence patterns and flagging concerns, in the user's locale
- [ ] Summary renders as a clean print-optimized page (A4-friendly, no nav/chrome)
- [ ] Print button triggers `window.print()`
- [ ] Page works without JavaScript for the static content (SSR)
- [ ] Caretaker can also generate summary for their linked patient
- [ ] Summary includes a disclaimer: "This summary is auto-generated and not a medical record"
- [ ] Loading state while AI narrative generates
- [ ] All UI strings in zh-TW and en

## Non-Goals (explicitly out of scope)

- PDF file generation server-side (use browser print-to-PDF instead)
- Vital signs tracking (no vitals data exists yet)
- Persisting generated summaries in the database
- Sharing via LINE/Telegram
- Doctor-facing portal or login

## Dependencies

- Existing medication data (`medication` table)
- Existing adherence logs (`adherence_log` table)
- Existing drug interactions (`interaction` table)
- AI text generation via OpenRouter (`generateText` from Vercel AI SDK)
- i18n via `next-intl`
