# Quickstart: Dual Usernames with Roles & Security-Question Password Reset

**Feature**: specs/011-dual-user-roles | **Date**: 2026-07-13

## 1. Prerequisites

- Node 22+, npm workspaces installed (`npm ci` at repo root).
- `backend/.dev.vars` present (MONGODB_URI, MONGODB_DB_NAME=`vii_pass_preview`,
  PBKDF2_ITERATIONS=100000, VAULT_ENC_KEY, SALT_DECOY_PEPPER, ALLOWED_ORIGINS).
  **No new env vars for this feature** — the reset decoys reuse `SALT_DECOY_PEPPER`.
- `frontend/.env.local` with `VITE_API_BASE_URL="http://localhost:8787"`.
- **Drop legacy data once per environment** (identity shape changed — no migration):
  `users`, `sessions`, `sections`, `chords`, and `resetAttempts` if present.

## 2. Run locally

```powershell
npm run dev:node   # Node API :8787 + Vite SPA :5173 (no wrangler needed)
```

## 3. Walkthrough — US1: dual-username registration

1. Open `http://localhost:5173/register`.
2. The form now asks: **Admin Username**, **Username**, **Display Name**,
   **Password** (3–10), **Security question** (dropdown of 5), **Answer**.
3. Fill e.g. `bossvimal` / `vimal` / `Vimal` / `abc123` / "In what city were you
   born?" / ` Chennai ` → submit.
4. Expect: signed in as **bossvimal (admin)**; vault visible; full controls present.
5. Negative checks:
   - Admin Username == Username (any case) → inline "must be different" error.
   - Re-register using `vimal` as the ADMIN username of a new account → 409
     "This username is already taken."
   - No question selected / blank answer → inline required-field messages.
6. DevTools → Network → register request body: contains `authHash`, `kdfSalt`,
   `vaultKeyWrapped`, `securityQuestionId`, `answerHash`, `recoverySalt`,
   `vaultKeyWrappedRecovery` — and **never** the password or the answer text.

## 4. Walkthrough — US2: either-username login + read-only role

1. As admin (`bossvimal`), create a section and a chord with a password field; sign out.
2. Sign in as `vimal` (same password `abc123`). Expect: same vault content.
3. Verify read-only UI: no `+` section tab, no section move/edit, no add-chord tile,
   no edit button on cards, no `↑↓` move buttons, drag-and-drop inert. Reveal (eye)
   and copy still work on every field.
4. Server-side enforcement (SC-003) — with the normal-role session cookie, hit each
   mutating route directly and expect `403 role_forbidden` (PowerShell: use
   HttpClient with `UseCookies=$false` and `TryAddWithoutValidation('Cookie', ...)`;
   `Invoke-WebRequest -Headers @{Cookie=...}` silently drops the header):
   - `POST /api/sections`, `POST /api/sections/reorder`,
     `PATCH|DELETE /api/sections/:id`, `POST /api/sections/:id/chords`,
     `POST /api/sections/:id/chords/reorder`, `PATCH|DELETE /api/chords/:id`.
5. Sign back in as `bossvimal` → all controls back, mutations succeed.

## 5. Walkthrough — US3: security-question password reset

1. Sign out. On the login page, follow **Forgot password?** → `/reset`.
2. Enter `bossvimal` → the registered question appears ("In what city were you born?").
3. Enter answer `chennai` (note: different case/whitespace than registration) →
   reset dialog appears.
4. Set new password `xyz789` → success → sign-in page.
5. Verify:
   - `bossvimal` + `xyz789` → works (admin); `vimal` + `xyz789` → works (normal).
   - Old password `abc123` → 401 for both names.
   - The chord stored in step 4.1 decrypts fine after reset (FR-011) — reveal shows
     the original value.
   - Any session that was still signed in elsewhere is now logged out (FR-012).
6. Non-leak checks (FR-010 / SC-005):
   - Enter `vimal` (normal name) at `/reset` → a question is still shown (decoy);
     any answer → same generic "That didn't match our records."
   - Enter a random unknown name → indistinguishable from the above.
   - 5 wrong answers for one name → 429 "Too many attempts", also for unknown names.

## 6. Responsive / a11y spot-check (Constitution III)

At 320px, 768px, and desktop widths:

- Register form: all six fields usable, dropdown touch-friendly, inline errors
  announced (`aria-invalid`/`aria-describedby`).
- Reset flow: each step fits without horizontal scroll; focus moves to the step's
  first field; dialog keyboard-navigable (Esc, focus trap — existing VaultModal
  pattern).
- Read-only vault at 320px: no layout gaps where admin controls would be.

## 7. Gates

```powershell
npm run typecheck
npm run lint
npm run build --workspaces --if-present
```

## 8. Ship (per environment — DESTRUCTIVE, developer-run)

1. Drop `users`, `sessions`, `sections`, `chords`, `resetAttempts` in the target DB.
2. Deploy (push to `main` → prod; `workflow_dispatch` → preview).
3. Re-register and smoke-test §3–§5 against the deployed URL.
