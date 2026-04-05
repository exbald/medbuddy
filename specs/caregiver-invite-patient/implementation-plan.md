# Implementation Plan: Caregiver-Initiated Patient Invite

## Overview
Extend the caretaker linking system to support caregiver-initiated invites. The caregiver generates a shareable link, the patient signs up via that link, and accounts are auto-linked after onboarding.

## Parallel Execution Strategy
Tasks are organized into waves. All tasks in a wave can run concurrently.
Each wave depends on the previous wave completing.

---

## Wave 1: Schema + Translations

**Goal:** Database schema change and translation keys — foundation for all other waves.

### Tasks
- [x] w1-schema-migration: Make `patientId` nullable on `caretaker_link` table `agents: [general]`
- [x] w1-translations: Add all new i18n keys for caretaker invite, onboarding, and invite landing page `agents: [general]`

### Technical Details

**w1-schema-migration:**

File: `src/lib/schema.ts` (line 115-118)

Change `patientId` from `.notNull()` to nullable:
```typescript
// Before
patientId: text("patient_id")
  .notNull()
  .references(() => user.id, { onDelete: "cascade" }),

// After
patientId: text("patient_id")
  .references(() => user.id, { onDelete: "cascade" }),
```

Then generate + apply migration:
```bash
npm run db:generate
npm run db:migrate
```

**w1-translations:**

Files: `messages/zh-TW.json`, `messages/en.json`

Add under `caretaker` namespace:
```json
"invitePatient": "邀請病患" / "Invite a Patient",
"invitePatientDesc": "產生連結分享給您的家人" / "Generate a link to share with your family member",
"inviteLink": "分享此連結" / "Share this link",
"copyLink": "複製連結" / "Copy link",
"linkCopied": "已複製！" / "Copied!",
"shareLink": "分享" / "Share",
"orManualCode": "或告知此邀請碼" / "Or share this code",
"invitePending": "等待病患加入" / "Waiting for patient to join"
```

Add under `onboarding.inviteStep` namespace:
```json
"noCodePrompt": "沒有邀請碼？" / "Don't have a code?",
"inviteInstead": "改為邀請病患" / "Invite a patient instead"
```

Add new top-level `invite` namespace:
```json
"invite": {
  "title": "加入 MedBuddy" / "Join MedBuddy",
  "subtitle": "{name} 邀請您一起管理用藥" / "{name} invited you to manage medications together",
  "signUp": "建立帳號" / "Create Account",
  "invalid": "此邀請連結無效或已使用" / "This invite link is invalid or has been used",
  "goToSignup": "前往註冊" / "Go to signup"
}
```

---

## Wave 2: API Layer

**Goal:** All backend endpoints updated/created to support bidirectional invite flow.
**Depends on:** Wave 1

### Tasks
- [x] w2-invite-api: Update `/api/caretaker/invite` GET+POST to support caretaker role `agents: [general]`
- [x] w2-link-api: Update `/api/onboarding/link` POST for bidirectional claiming `agents: [general]`
- [x] w2-onboarding-autolink: Update `/api/onboarding` POST to auto-link from invite cookie `agents: [general]`

### Technical Details

**w2-invite-api:**

File: `src/app/api/caretaker/invite/route.ts`

Current: Only allows `role === "patient"`, returns 403 for caretakers.

New GET behavior:
- If patient: query by `patientId` (existing)
- If caretaker: query by `caretakerId` — find link where `caretakerId = userId`
- Return `{ inviteCode, claimed }` — claimed means the other side is filled

New POST behavior:
- If patient: existing logic (create/update link with `patientId` set)
- If caretaker: create/update link with `caretakerId` set, `patientId` null
  - Try update existing unclaimed: `WHERE caretakerId = userId AND patientId IS NULL`
  - If no unclaimed exists: insert new row with `caretakerId` set, `patientId` null

Reuse: `generateInviteCode()` from `src/lib/invite-code.ts`

**w2-link-api:**

File: `src/app/api/onboarding/link/route.ts`

Current: Looks up code, sets `caretakerId` (patient-initiated flow only).

New logic after looking up the code:
1. If `link.patientId === null && link.caretakerId !== null` → caregiver-initiated
   - Current user must not be the caretaker (self-link check: `link.caretakerId !== session.user.id`)
   - Atomic update: `SET patientId = currentUser WHERE patientId IS NULL`
2. If `link.caretakerId === null && link.patientId !== null` → patient-initiated (existing)
   - Self-link check: `link.patientId !== session.user.id`
   - Atomic update: `SET caretakerId = currentUser WHERE caretakerId IS NULL`
3. If both set → 409 already claimed

**w2-onboarding-autolink:**

File: `src/app/api/onboarding/route.ts`

In the POST handler, after the transaction that sets role + creates patient invite code:
- Read `invite_code` cookie from request headers: `req.headers.get("cookie")` or use Next.js `cookies()`
- If cookie present AND role === "patient":
  - Look up the caretaker-initiated link by invite code
  - If found and unclaimed (`patientId IS NULL`): set `patientId = session.user.id` (inside transaction)
  - Skip creating a new patient invite code if auto-link succeeded (patient already linked)
- Clear `invite_code` cookie in response (set maxAge=0)

Cookie read pattern (Next.js):
```typescript
import { cookies } from "next/headers"
const cookieStore = await cookies()
const inviteCodeCookie = cookieStore.get("invite_code")?.value
```

---

## Wave 3: UI — Invite Landing Page + Dashboard + Onboarding

**Goal:** All frontend pages updated/created.
**Depends on:** Wave 2

### Tasks
- [x] w3-invite-page: Create `/[locale]/invite/[code]/page.tsx` landing page `agents: [general]`
- [x] w3-dashboard-empty: Update caretaker dashboard empty state with invite button `agents: [general]`
- [x] w3-onboarding-invite: Add "Invite instead" option to onboarding step 3 `agents: [general]`

### Technical Details

**w3-invite-page:**

New file: `src/app/[locale]/invite/[code]/page.tsx`

Server Component (no "use client"). Public page — no auth required.

Logic:
1. Extract `code` from params (dynamic route segment)
2. Query DB: find `caretakerLink` where `inviteCode = code`
3. If not found or both sides filled → show error state with link to signup
4. If valid (one side null):
   - Look up the inviter's name from `user` table (the non-null side)
   - Set `invite_code` cookie (httpOnly, secure in prod, sameSite: lax, maxAge: 7 days)
   - Redirect to signup: `redirect("/register")` or show a page with "Create Account" button linking to register

Use `cookies()` from `next/headers` to set cookie. Use `redirect()` from `next/navigation` or use `next-intl`'s `redirect`.

Styling: centered card with MedBuddy branding, inviter name, large "Create Account" CTA button. Follow elderly-friendly patterns (48px+ touch targets, 18px+ text).

**w3-dashboard-empty:**

File: `src/app/[locale]/(app)/caretaker/page.tsx` (lines 119-133)

Replace the current empty state (UserX icon + "Complete onboarding" link) with:
1. Same UserX icon + "No patient linked" text
2. New "Invite a Patient" button (primary, large)
3. On click: call `POST /api/caretaker/invite`
4. After success, show:
   - Shareable link in a bordered box: `${window.location.origin}/invite/${inviteCode}`
   - "Copy link" button (uses `navigator.clipboard.writeText`)
   - "Share" button if `navigator.share` is available (progressive enhancement)
   - Below: "Or share this code:" with the 6-char code in large monospace font
   - "Waiting for patient to join" status text

State management: add `inviteCode`, `inviteLoading`, `inviteCopied` states.

**w3-onboarding-invite:**

File: `src/app/[locale]/onboarding/page.tsx` (step 3 caretaker section, lines 320-381)

Below the existing code input + link button, add a divider and secondary option:
```
── or ──
"Don't have a code? Invite a patient instead" (text button)
```

On click: call `POST /api/caretaker/invite`, then show the same invite link/code display as the dashboard empty state. Add states: `showInviteMode`, `generatedCode`, `generatingInvite`.

When in invite mode, hide the code input field and show the invite link + code display instead. Include a "Back to enter code" link to toggle back.

---

## Wave 4: Verification

**Goal:** Ensure everything works, passes lint/typecheck.
**Depends on:** Wave 3

### Tasks
- [ ] w4-verify: Run lint, typecheck, and manual smoke test `agents: [general]`

### Technical Details

```bash
npm run lint && npm run typecheck
```

Smoke test checklist:
1. Register as caretaker → skip code entry in onboarding
2. Visit caretaker dashboard → see "Invite a Patient" button
3. Click invite → see shareable link + code
4. Open link in incognito → lands on invite page → click signup
5. Register as patient → complete onboarding → auto-linked
6. Caretaker dashboard now shows patient data
7. Test existing flow: patient registers → gets code → caretaker enters code → works
8. Test edge cases: invalid code URL, already-claimed code URL
