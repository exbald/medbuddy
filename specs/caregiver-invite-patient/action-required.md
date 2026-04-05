# Action Required: Caregiver-Initiated Patient Invite

Manual steps requiring human action.

## Before Implementation
- [ ] **Ensure dev database is running** - Schema migration will alter the `caretaker_link` table
- [ ] **Verify `NEXT_PUBLIC_APP_URL` is set** - Invite links use this to build the shareable URL

## After Implementation
- [ ] **Run database migration** - `npm run db:generate && npm run db:migrate` to apply `patientId` nullable change
- [ ] **Smoke test the full caregiver flow** - Register as caretaker, generate invite, open link in incognito, register as patient, verify auto-link
- [ ] **Smoke test existing patient-first flow** - Ensure it still works unchanged
- [ ] **Test on mobile** - Verify `navigator.share` works on mobile browsers, copy button works as fallback on desktop
