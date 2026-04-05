# Requirements: Caregiver-Initiated Patient Invite

## Summary
Allow caregivers to generate an invite link and share it with a patient, who then signs up and is automatically linked — reversing the current patient-first-only flow.

## Problem
The current linking flow requires the patient to register first, get a 6-char invite code, and share it with the caregiver. This doesn't match the real-world scenario where the tech-savvy family member (caregiver) sets up the app first and then helps their elderly parent get started. Elderly users in Taiwan often need a family member to initiate the process for them.

## Solution
Extend the existing `caretaker_link` table to support a "caregiver-initiated" pending state (caretakerId set, patientId null — the reverse of today). Caregiver generates an invite link from the dashboard empty state, shares it with the patient. When the patient clicks the link, a cookie stores the invite code. After signup and onboarding, the system auto-links the accounts without manual code entry.

## Acceptance Criteria
- [ ] Caregiver can generate an invite link from the caretaker dashboard (empty state)
- [ ] Invite link format: `{APP_URL}/invite/{CODE}` (public, no auth required)
- [ ] Patient clicking the invite link is redirected to signup with invite code stored in cookie
- [ ] After patient completes onboarding, accounts are auto-linked (no code entry needed)
- [ ] Caregiver can also generate invite from onboarding step 3 ("Don't have a code? Invite instead")
- [ ] Invite link shows copy button and native share (where available)
- [ ] 6-char code also displayed for manual entry as fallback
- [ ] Invalid/claimed invite links show friendly error with signup link
- [ ] Existing patient-first flow continues to work unchanged
- [ ] Self-linking prevention (can't link to own account)
- [ ] Race condition protection on claiming (atomic WHERE clause)
- [ ] All UI strings available in zh-TW and en

## Dependencies
- Existing `caretaker_link` table and `generateInviteCode()` utility
- BetterAuth signup flow
- Onboarding wizard (3-step)
- next-intl for i18n routing and translations
