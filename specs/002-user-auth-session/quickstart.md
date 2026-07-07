# Quickstart: User Authentication & Session Management

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-07-06

This walkthrough verifies the authentication feature end to end: **register → land on the
welcome home page → reload stays signed in → logout → protected access denied → log back in**.
It assumes the vii-pass monorepo from feature 001 is already installed (`npm install` at the
repo root).

---

## 1. Prerequisites

- Node 18+ and the repo dependencies installed (`npm install` at the repo root).
- A MongoDB Atlas cluster reachable from Cloudflare, and its connection string.
- Atlas Network Access allows Cloudflare egress (see 001 quickstart).

The API talks to database **`vii_pass`** and creates the `users` and `sessions` collections
on first use. Indexes are created by the app on startup (unique `users.email`, unique
`sessions.tokenHash`, `sessions.userId`, and the `sessions.expiresAt` TTL index).

---

## 2. Configure environment

Backend local secrets/config — copy the template and fill in real values:

```powershell
Copy-Item backend/.dev.vars.example backend/.dev.vars
```

Set in `backend/.dev.vars` (this file is git-ignored — never commit it):

```ini
MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>/?retryWrites=true&w=majority"
```

Non-secret config lives in `backend/wrangler.toml [vars]` (defaults shown; tune as needed):

```toml
MONGODB_DB_NAME = "vii_pass"
ALLOWED_ORIGINS = "http://localhost:5173"
# New in this feature:
SESSION_IDLE_TTL_SECONDS = "1800"       # 30-minute sliding inactivity timeout
SESSION_ABSOLUTE_TTL_SECONDS = "86400"  # 24-hour absolute session lifetime
PBKDF2_ITERATIONS = "600000"            # password hash work factor (OWASP-aligned)
# COOKIE_DOMAIN is left unset locally (host-only cookie); set it in production only.
```

Frontend:

```powershell
Copy-Item frontend/.env.local.example frontend/.env.local
```

```ini
VITE_API_BASE_URL="http://localhost:8787"
```

> **Local cookies work out of the box**: `localhost:5173` (SPA) and `localhost:8787` (API) are
> same-site, so the `SameSite=Lax` session cookie is sent with `credentials: 'include'`. The
> `Secure` attribute is relaxed on `http://localhost`.

---

## 3. Run both servers

```powershell
npm run dev
```

This starts the API (`http://localhost:8787`) and the SPA (`http://localhost:5173`) together.
Open **http://localhost:5173**.

---

## 4. Verify the flow

### 4.1 Registration (US2, FR-017–FR-020)

1. You are unauthenticated, so visiting `/` redirects you to **/login**.
2. Follow the link to **Create an account**.
3. Enter an email, a display name, and a password of **at least 12 characters**; submit.
4. **Expected**: the account is created and you are taken straight to the **home page**
   showing **"Welcome, <display name>"**.
5. Try registering the **same email** again → **Expected**: a clear "email already exists"
   message and no duplicate account.
6. Try a **short password** or a **malformed email** → **Expected**: inline, accessible
   validation messages; nothing is created.

### 4.2 Session-gated access + reload persistence (US3, FR-006/FR-007, SC-002/SC-005)

1. While signed in on the home page, **reload** the browser → **Expected**: you remain signed
   in (no re-login) and still see the welcome message.
2. Open a new tab and request protected data directly, e.g.:
   ```powershell
   # Without the cookie → denied
   curl.exe -i http://localhost:8787/api/auth/me
   ```
   **Expected**: `401` with a JSON `ApiError` (no user data).
3. Confirm the session cookie is **HttpOnly**: in DevTools → Application → Cookies, the
   `session` cookie shows HttpOnly = true and is **not** readable via `document.cookie`
   (FR-013).

### 4.3 Login (US1, FR-002/FR-003)

1. Use the **user menu → Logout** (or clear the cookie) to sign out, then go to **/login**.
2. Enter the **correct** credentials → **Expected**: you land on the home page.
3. Enter a **wrong password** (and separately, an **unknown email**) → **Expected**: the
   **same** generic error ("Incorrect email or password.") in both cases — no hint about which
   field was wrong (SC-004).
4. Repeat several rapid failures → **Expected**: throttling kicks in with a `429`/"try again
   later" response (FR-014, SC-009).

### 4.4 Logout invalidates the session (US4, FR-009, SC-003)

1. Sign in, then open the **user menu in the top-right corner** → it shows your identity and a
   **Logout** action.
2. Choose **Logout** → **Expected**: you are returned to **/login**.
3. Attempt to reuse the old session (e.g., browser Back, or replay the previous cookie):
   ```powershell
   curl.exe -i --cookie "session=<OLD_TOKEN>" http://localhost:8787/api/auth/me
   ```
   **Expected**: `401` — the server-side session was deleted, so the old cookie is worthless.

### 4.5 Demo features are gone (FR-012, SC-007)

1. Navigate directly to `/records` or `/files` → **Expected**: no such screen (redirected to
   home/login); nothing exposes the former demo features.
2. `curl.exe -i http://localhost:8787/api/records` → **Expected**: `404` (route removed).
3. `curl.exe -i http://localhost:8787/api/health` → **Expected**: `200` with `{ api, database }`
   only (retained as an infra signal; no user-facing page).

---

## 5. (Optional) Seed an administrative user

Self-service registration is the primary path, but you can seed a user directly for testing.
Because passwords must be stored as PBKDF2 hashes, prefer creating users **through the running
API** rather than inserting raw documents:

```powershell
curl.exe -i -X POST http://localhost:8787/api/auth/register `
  -H "Content-Type: application/json" `
  --data '{ "email": "admin@example.com", "displayName": "Admin", "password": "change-me-please-12+" }'
```

> Do **not** insert users with plaintext passwords directly into MongoDB — the login flow only
> accepts PBKDF2-hashed credentials produced by the API.

---

## 6. Validate the build

```powershell
npm run typecheck --workspaces --if-present
npm run lint
# Bundle the Worker for the edge without deploying:
Push-Location backend; npx wrangler deploy --dry-run --outdir .wrangler/dryrun; Pop-Location
```

All three should complete cleanly (no type errors, no lint errors, successful Worker bundle).

---

## 7. Production notes (cookies across subdomains)

- Deploy the SPA (Pages) and API (Worker) under the **same registrable domain** as sibling
  subdomains (e.g., `app.example.com` and `api.example.com`).
- Set `COOKIE_DOMAIN=".example.com"` and `ALLOWED_ORIGINS="https://app.example.com"` in the
  Worker's production vars. This keeps the session cookie **first-party** (`SameSite=Lax`),
  so it survives third-party-cookie deprecation (research Decision 4).
- Set the Atlas secret once per environment: `wrangler secret put MONGODB_URI`.
- Consider adding a Cloudflare **rate-limiting rule** on `/api/auth/login` and
  `/api/auth/register` for edge-level brute-force protection (research Decision 6).

---

## Success criteria mapping

| Step | Requirement / Criterion |
|------|-------------------------|
| 4.1 register + duplicate/validation | US2, FR-017–FR-020, SC-010 |
| 4.2 gated access + reload + HttpOnly | FR-006, FR-007, FR-013, SC-002, SC-005 |
| 4.3 login + generic error + throttle | US1, FR-002, FR-003, FR-014, SC-004, SC-009 |
| 4.4 logout invalidates session | US4, FR-008, FR-009, SC-003 |
| 4.5 demo features removed | FR-012, SC-007 |
| 6 build validation | Constitution I (code quality gates) |
