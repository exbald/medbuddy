# Authentication and Onboarding

MedBuddy uses Better Auth for email/password authentication. After signing up, every user must complete a 3-step onboarding wizard that sets their name, role (patient or caretaker), and optionally links accounts via an invite code. The middleware redirects unonboarded users away from app routes until onboarding is finished.

## Architecture

### Auth Flow

Better Auth handles registration, login, password reset, and session management. The auth catch-all route lives at `src/app/api/auth/[...all]/route.ts`. Client-side hooks are imported from `@/lib/auth-client`, and server-side session checks use `@/lib/auth`.

Protected routes are defined in the middleware (`src/proxy.ts`). If a session cookie is missing, the user is redirected to the landing page (`/`).

### Onboarding Wizard

The onboarding page at `/onboarding` is a client component with 3 steps:

1. **Name confirmation** -- Pre-filled from the auth session. The user can edit it.
2. **Role selection** -- Patient or caretaker. Large card-based buttons designed for elderly users (48px+ touch targets, 18px+ text).
3. **Invite code** -- Behavior depends on the selected role:
   - **Patient**: The API generates a 6-character invite code (uppercase alphanumeric, excluding ambiguous characters like 0/O/1/I/L). The user shares this code with their caretaker.
   - **Caretaker**: The user enters a 6-character code from their patient. The `/api/onboarding/link` endpoint links the accounts.

On completion, the POST to `/api/onboarding` runs inside a database transaction that:
- Updates the user row with name, role, and `onboardingComplete = true`.
- For patients, inserts a `caretaker_link` row with the generated invite code (retries up to 3 times on collision).
- Sets an `onboarding_complete` httpOnly cookie so the middleware can skip DB lookups on future requests.

### Middleware Redirect

The middleware in `src/proxy.ts` runs `next-intl` locale handling first, then checks two layers:

1. **Authentication**: Routes in `protectedRoutes` (`/home`, `/medications`, `/chat`, `/profile`, `/onboarding`, `/caretaker`) require a session cookie. Missing session redirects to `/`.
2. **Onboarding**: Routes in `onboardingRequiredRoutes` (all protected routes except `/onboarding` itself) check for the `onboarding_complete` cookie. If absent, the user is redirected to `/onboarding`.

The middleware strips locale prefixes before matching, so `/en/home` and `/home` both trigger protection checks.

### Invite Code Linking

`POST /api/onboarding/link` accepts a 6-character code, normalizes it to uppercase, and performs an atomic update using a `WHERE caretakerId IS NULL` clause to prevent race conditions. It also prevents self-linking (a patient cannot use their own code).

## Key Files

| File | Purpose |
|------|---------|
| `src/app/[locale]/onboarding/page.tsx` | Onboarding wizard UI (3-step client component) |
| `src/app/api/onboarding/route.ts` | GET: check onboarding status; POST: complete onboarding |
| `src/app/api/onboarding/link/route.ts` | POST: link caretaker to patient via invite code |
| `src/proxy.ts` | Middleware for auth + onboarding redirect |
| `src/lib/auth.ts` | Better Auth server configuration |
| `src/lib/auth-client.ts` | Better Auth client hooks |
| `src/lib/schema.ts` | `user` table (role, onboardingComplete) and `caretakerLink` table |

## Configuration

| Environment Variable | Purpose |
|---------------------|---------|
| `BETTER_AUTH_SECRET` | 32-character secret for session encryption |
| `POSTGRES_URL` | Database connection string |
| `NEXT_PUBLIC_APP_URL` | Base URL for redirects |

## Common Tasks

### Adding a new protected route

Add the path to `protectedRoutes` in `src/proxy.ts`. If the route also requires completed onboarding, add it to `onboardingRequiredRoutes` as well.

### Changing invite code format

Modify `INVITE_CODE_CHARS` and `INVITE_CODE_LENGTH` in `src/app/api/onboarding/route.ts`. Update the Zod schema in `link/route.ts` to match the new length (`z.string().length(NEW_LENGTH)`).

### Adding a new role

1. Add the role string to the `onboardingSchema` enum in `src/app/api/onboarding/route.ts`.
2. Handle the new role in the onboarding POST handler (decide whether it generates an invite code).
3. Update the onboarding wizard UI to include a new `RoleCard`.
4. Update `BottomNav` in `src/components/bottom-nav.tsx` to show role-appropriate navigation.
