# Action Required: Health Summary Export

Manual steps requiring human action.

## Before Implementation

- [ ] **No actions required** — This feature uses only existing dependencies and infrastructure

## During Implementation

- [ ] **No actions required** — No new env vars, no new packages, no migrations

## After Implementation

- [ ] **Test print output** — Open health summary page in Chrome, click Print, verify the A4 PDF looks clean with no cut-off content
- [ ] **Test on mobile** — Verify the summary page is readable on mobile Safari/Chrome and the print button works
- [ ] **Test both locales** — Generate summary in zh-TW and en, verify AI narrative respects locale
- [ ] **Test caretaker flow** — Link a caretaker, generate summary from caretaker dashboard, verify it shows patient data (not caretaker's)
- [ ] **Run lint + typecheck** — `npm run lint && npm run typecheck`
