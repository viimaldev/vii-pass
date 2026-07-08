# Quickstart: Username-Based Login Validation

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-07-08

This walkthrough verifies the identity change end to end: **register with a username (no
email) → username/password validation is enforced → sign in with the username → the user menu
shows the username**. It assumes the vii-pass monorepo is already installed (`npm install` at
the repo root) and that features 001–002 are in place.

---

## 1. Prerequisites

- Node 18+ and repo dependencies installed (`npm install` at the repo root).
- A MongoDB Atlas cluster reachable from Cloudflare, with `backend/.dev.vars` holding
  `MONGODB_URI` (git-ignored — never commit it). Config is otherwise unchanged from feature
  002; **no new environment variables** are introduced by this feature.

The API talks to database **`vii_pass`** and uses the existing `users` collection. On first use
it creates a **unique `username`** index.

---

## 2. One-time development cleanup (legacy `email` index)

Because feature 002 created a unique index on `users.email`, a development database may still
have old email-based users and an `email_1` index. This feature does **not** drop it
automatically (research Decision 5). In **development only**, clear the old data/index so the
new `username` rules apply cleanly:

```javascript
// mongosh, against the vii_pass database
use vii_pass
db.users.drop()            // dev only: removes old email-based accounts
// (the app recreates the collection + the unique `username` index on next register)
```

> Production is assumed to have no accounts under the old scheme (early lifecycle), so no
> migration is performed. If real email-based accounts ever existed, a separate rename/backfill
> migration would be required — out of scope here.

---

## 3. Run both servers

```powershell
npm run dev
```

Starts the API (`http://localhost:8787`) and the SPA (`http://localhost:5173`). Open
**http://localhost:5173**. (Local same-site cookies work out of the box — see the 002
quickstart.)

---

## 4. Verify the flow

### 4.1 Registration with a username (US1, FR-001/FR-002/FR-008)

1. Unauthenticated, visiting `/` redirects you to **/login**; follow **Create an account**.
2. **Expected**: the form shows a **Username** field (no Email field) and password guidance
   that reads **"Use 3 to 10 characters."**
3. Enter a unique alphanumeric username (e.g. `alice01`, ≥ 3 chars), a display name, and a
   password of **3–10 characters**; submit.
4. **Expected**: the account is created and you land on the **home page** showing
   **"Welcome, <display name>"**. No email was requested anywhere.

### 4.2 Username validation and duplicates (US3, FR-003/FR-004/FR-005/FR-010)

On the registration form, confirm each invalid input is rejected with clear, accessible inline
feedback and **no account is created**:

1. Username **shorter than 3** chars (e.g. `ab`) → rejected ("at least 3 characters").
2. Username with a **special character** (e.g. `al ice`, `bob!`, `a@b.com`) → rejected
   ("letters and numbers only").
3. A **already-registered** username (retry `alice01`, including a case variant like
   `Alice01`) → rejected with **"This username is already taken."** and no duplicate
   (case-insensitive uniqueness, FR-006).
4. Boundary: exactly **3** chars (`abc`) is **accepted**; **2** chars is rejected.

### 4.3 Password range 3–10 (US3, FR-007)

1. Password of **2** characters → rejected ("at least 3 characters"); **11** characters →
   rejected ("10 characters or fewer"). Neither creates an account.
2. Boundary: exactly **3** and exactly **10** characters are **accepted**.

> Tip — verify server-side enforcement too (the API is the source of truth). With the SPA's
> client checks bypassed, the same rules must be enforced by the API:
>
> ```powershell
> # username too short → 400 validation error
> curl.exe -i -X POST http://localhost:8787/api/auth/register `
>   -H "Content-Type: application/json" `
>   -d '{"username":"ab","displayName":"Ann","password":"secret1"}'
>
> # password too long (11) → 400 validation error
> curl.exe -i -X POST http://localhost:8787/api/auth/register `
>   -H "Content-Type: application/json" `
>   -d '{"username":"annie","displayName":"Ann","password":"12345678901"}'
> ```

### 4.4 Sign in with the username (US2, FR-012)

1. Use the **user menu → Log out**, then go to **/login**.
2. **Expected**: the sign-in form shows a **Username** field (no Email field).
3. Enter the **correct** username + password → you land on the home page.
4. Enter an **unknown username** (and separately a **wrong password**) → **Expected**: the
   **same** generic error **"Incorrect username or password."** in both cases — no hint about
   which field was wrong, no session created.

### 4.5 Identity display (FR-013)

1. While signed in, open the **user menu** in the corner → **Expected**: it shows the display
   name and the **username** (no email anywhere).
2. Reload the browser → **Expected**: you remain signed in and the welcome message is intact
   (session behavior unchanged).

---

## 5. Quality gates (before marking done)

```powershell
npm run typecheck   # strict TypeScript, backend + frontend + shared — must pass
npm run lint        # ESLint/Prettier — must be clean
npm run build       # SPA build — must succeed
```

**Done when**: every scenario in §4 behaves as described, no reference to "email" remains in
the registration or sign-in experience, and all three gates above are green.

---

## 6. Acceptance checklist (maps to spec Success Criteria)

- [ ] Account created with only a username + password, no email in the flow (SC-001, SC-004).
- [ ] Usernames < 3 chars, non-alphanumeric, or duplicate (incl. case-only) are all rejected
      with no account created (SC-002).
- [ ] Passwords outside 3–10 rejected; every 3–10 password accepted (SC-003).
- [ ] Sign-in succeeds first try with the correct username; no email anywhere (SC-005).
- [ ] Every invalid registration input shows accessible inline feedback naming the violated
      rule (SC-006).
