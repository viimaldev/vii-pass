# Phase 0 Research: User Authentication & Session Management

**Feature**: [spec.md](./spec.md) | **Branch**: `topic/vii-1001-user-auth-session` | **Date**: 2026-07-06

This document resolves the technical unknowns for adding authentication, self-service
registration, and session management to vii-pass on the existing Cloudflare topology
(React/Vite → Pages → Hono/Workers → MongoDB Atlas). It builds on the decisions in
[../001-mern-cloudflare-setup/research.md](../001-mern-cloudflare-setup/research.md) (Hono,
native `mongodb` driver + Zod, env-driven secrets) and does not re-litigate them.

The single [NEEDS CLARIFICATION] from the spec (account provisioning) was resolved by the
requester as **self-service registration in scope** (Decision 8).

---

## Decision 1 — Password hashing: PBKDF2-HMAC-SHA-256 via Web Crypto (Workers-native)

- **Decision**: Hash passwords with **PBKDF2-HMAC-SHA-256** using the Workers-native Web
  Crypto API (`crypto.subtle.importKey` + `crypto.subtle.deriveBits`), with a **per-user
  random 16-byte salt** and an OWASP-aligned iteration count (**default 600,000**, tunable
  via `SESSION`/hash config). Store an encoded string capturing algorithm, iteration count,
  salt, and derived key so the work factor can be raised later without breaking existing
  hashes. Verify with a constant-time comparison.
- **Rationale**:
  - Web Crypto `SubtleCrypto` is **natively available on Workers** with no dependency, no
    WASM bundle, and no `nodejs_compat` requirement — the most reliable option at the edge.
  - PBKDF2 is **adaptive** (iteration count is the work factor), satisfying the "strong,
    adaptive algorithm" intent of the constitution and project instructions.
  - It avoids the Workers **CPU-time and 128 MB memory limits** that memory-hard KDFs
    (argon2id/scrypt) can trip — especially problematic on the free plan's tight CPU budget.
  - OWASP Password Storage guidance explicitly lists PBKDF2-HMAC-SHA-256 at
    ≥ 600,000 iterations as an acceptable configuration.
- **Alternatives considered**:
  - **argon2id via `hash-wasm` (WASM)**: Strongest (memory-hard) and honors "argon2"
    literally; works on Workers via inlined WASM. **Rejected as primary** because memory/CPU
    tuning is fragile under Workers limits and it adds bundle weight and a dependency.
    Recorded as the **upgrade path** if the threat model later demands memory-hardness — the
    encoded-hash format makes migration seamless (verify-old, rehash-on-login).
  - **bcrypt via `bcryptjs` (pure JS)**: Rejected — CPU-heavy pure-JS implementation is slow
    on Workers and risks exceeding CPU limits; no memory-hardness advantage over tuned PBKDF2.
  - **Native `bcrypt`/`argon2` Node addons**: Rejected — native addons do not run on the
    Workers V8 runtime.
- **Deviation note**: Project instructions give "bcrypt/argon2" as *examples* ("e.g."). We
  honor the intent — a strong, salted, adaptive hash — with the Workers-native PBKDF2, and
  document argon2id as the sanctioned upgrade path.

---

## Decision 2 — Session model: opaque server-side sessions, token stored hashed

- **Decision**: Use **server-side sessions**. On login/registration, generate a
  **high-entropy random token** (32 bytes from `crypto.getRandomValues`, base64url-encoded).
  Persist a **`sessions` document keyed by the SHA-256 hash of the token** (never the raw
  token), with `userId`, `createdAt`, `lastActivityAt`, and `expiresAt`. Return only the raw
  token to the client in a cookie. On each request, hash the presented token and look it up.
- **Rationale**:
  - Storing only the **hash** of the session token means a database disclosure cannot be
    replayed to hijack sessions (defense in depth, mirroring password handling).
  - Opaque server-side sessions allow **instant revocation** (logout, admin kill) — a JWT
    cannot be revoked before expiry without extra infrastructure. This directly serves FR-009
    (logout invalidates) and SC-003 (post-logout access denied 100%).
  - No signing secret to manage (unlike JWT/`HMAC`), reducing secret sprawl (Constitution V).
  - A single indexed lookup by `tokenHash` keeps session validation < 200ms (Performance).
- **Alternatives considered**:
  - **Stateless JWT in a cookie**: Rejected as primary — revocation-before-expiry needs a
    denylist (reintroducing server state), and a leaked signing key forges any session. The
    opaque-session approach is simpler and safer for the spec's strict revocation requirement.
  - **Storing the raw token in the DB**: Rejected — a DB leak would expose live sessions.

---

## Decision 3 — Session transport: HttpOnly + Secure cookie (not client-readable storage)

- **Decision**: Deliver the session token in a cookie with **`HttpOnly`, `Secure`,
  `SameSite=Lax`, `Path=/`**, and (in production) `Domain` set to the shared parent domain.
  Set `Max-Age` to the session lifetime. Never expose the token to JavaScript; never place it
  in `localStorage`/`sessionStorage`.
- **Rationale**:
  - FR-013 mandates that session identifiers **not be accessible to client-side scripts** and
    be transmitted only over secure connections — `HttpOnly` + `Secure` is precisely this and
    rules out token-in-JS designs.
  - `HttpOnly` mitigates token theft via XSS; `Secure` forces HTTPS-only transport;
    `SameSite=Lax` mitigates CSRF for top-level navigations while allowing the SPA's
    same-site API calls.
- **Alternatives considered**:
  - **Authorization: Bearer token held in JS memory**: Rejected — violates FR-013 (readable
    by scripts) and is lost on reload (would fail FR-007 without insecure persistence).
  - **`SameSite=Strict`**: Rejected as default — breaks link-in navigations to the app; `Lax`
    is the standard balance. `None` is avoided (see Decision 4).

---

## Decision 4 — Cross-origin cookie strategy: same registrable domain in production

- **Decision**: In production, deploy the SPA (Pages) and API (Worker) under the **same
  registrable domain** as sibling subdomains (e.g., `app.example.com` and `api.example.com`),
  and scope the cookie to the shared parent (`Domain=.example.com`). This makes the session
  cookie **first-party** with `SameSite=Lax`. CORS allows the specific SPA origin with
  `Access-Control-Allow-Credentials: true`; the SPA sends `credentials: 'include'`. In local
  dev, `http://localhost:5173` (SPA) and `http://localhost:8787` (API) are already **same-site**
  (site = `localhost`), so `SameSite=Lax` cookies flow; `Secure` is relaxed on `http://localhost`.
- **Rationale**:
  - A cross-**site** API (different registrable domain) would make the session cookie a
    **third-party cookie**, which modern browsers block/deprecate — breaking sessions. Sharing
    the registrable domain keeps the cookie first-party and durable (SC-005: sessions survive
    reload for their full lifetime).
  - This refines 001 Decision 6 (standalone Worker + CORS): keep the separate Worker, but put
    it on a sibling subdomain rather than an unrelated origin.
- **Alternatives considered**:
  - **`SameSite=None; Secure` cross-site cookie**: Rejected — subject to third-party-cookie
    blocking; fragile long term.
  - **Routing `/api/*` to the Worker on the very same host as Pages**: Viable and even
    simpler for cookies (fully same-origin, `SameSite=Strict` possible). Recorded as an
    acceptable alternative if unified hosting is preferred; the plan assumes sibling subdomains
    to preserve the independent-Worker boundary from 001.
- **Config**: `ALLOWED_ORIGINS` (existing) enumerates the SPA origin(s); a new `COOKIE_DOMAIN`
  var sets the production cookie domain (empty/omitted in local dev → host-only cookie).

---

## Decision 5 — Session lifetime: sliding inactivity + absolute maximum

- **Decision**: Enforce **two** bounds (FR-010): a **sliding inactivity timeout** (default
  **30 minutes** — each authenticated request advances `lastActivityAt` and the effective
  expiry) and an **absolute maximum lifetime** (default **24 hours** from `createdAt`,
  independent of activity). A session is valid only if now < inactivity-expiry AND now <
  absolute-expiry. Both defaults are tunable via env (`SESSION_IDLE_TTL_SECONDS`,
  `SESSION_ABSOLUTE_TTL_SECONDS`).
- **Rationale**:
  - Sliding expiry keeps active users signed in across reloads (FR-007, SC-005) while idle
    sessions lapse; the absolute cap bounds the damage window of a stolen cookie.
  - A **MongoDB TTL index** on the absolute-expiry field auto-purges dead sessions, keeping the
    collection small without a cron.
- **Alternatives considered**:
  - **Inactivity-only**: Rejected — a continuously poked session could live forever.
  - **Absolute-only**: Rejected — either too short (annoying) or too long (idle risk).

---

## Decision 6 — Brute-force throttling for login (and registration)

- **Decision**: Throttle repeated failed authentication attempts (FR-014). Primary mechanism:
  **Cloudflare's platform rate limiting** (a WAF rate-limit rule or the Workers rate-limit
  binding) keyed by client IP on `/api/auth/login` and `/api/auth/register`. Application-level
  backstop: track consecutive failures per account on the `users` document
  (`failedLoginCount`, `lockedUntil`) and reject with `429` while locked, resetting on success.
- **Rationale**:
  - Platform rate limiting stops volumetric guessing at the edge before it reaches the Worker
    (cheapest, most robust). The per-account counter adds targeted protection against
    distributed low-rate guessing of one account and gives a clear `429` with a retry hint.
  - Keeps the design portable: even without the WAF rule configured, the account-level lock
    provides baseline protection (SC-009).
- **Alternatives considered**:
  - **Workers KV / Durable Object counters**: More moving parts than needed now (YAGNI);
    the account-document counter reuses the existing Mongo store. Recorded as an option if
    per-IP application-level limits are later required without the WAF.
  - **No throttling**: Rejected — violates FR-014.
- **Enumeration note**: Login returns a **single generic error** for unknown-user and
  wrong-password (FR-003). Registration necessarily reveals that an email is taken (FR-019);
  since email verification is out of scope, this is an **accepted** tradeoff, mitigated by
  rate limiting.

---

## Decision 7 — Registration flow: validate → hash → create → auto-login

- **Decision**: `POST /api/auth/register` validates input with Zod (email format; display
  name required, trimmed, 1–100 chars; password **min 12 chars** per NIST 800-63B length-first
  guidance), normalizes email to lowercase, checks uniqueness via the `users.email` unique
  index, hashes the password (Decision 1), inserts the user, then **establishes a session and
  sets the cookie** so the new user lands authenticated on the home page (FR-020). Duplicate
  email → `409` (FR-019); validation failure → `400` (FR-018).
- **Rationale**:
  - Matches US2 acceptance scenarios and FR-017–FR-020; length-first password policy follows
    current NIST/OWASP guidance (avoid arbitrary composition rules).
  - Relying on the **unique index** (not just a pre-check) closes the race between two
    simultaneous registrations of the same email.
- **Alternatives considered**:
  - **Register then redirect to login** (no auto-login): Rejected per the requester's
    confirmed preference for auto-login after registration.
  - **Complex composition rules**: Rejected — NIST recommends length + breach checks over
    composition; breach-list checking is noted as a possible future enhancement.

---

## Decision 8 — Account provisioning: self-service registration (resolves the clarification)

- **Decision**: Users onboard via **self-service registration** (Decision 7). Administrative
  seeding MAY still be used to create initial/test users (documented in quickstart), but is not
  the primary path.
- **Rationale**: Directly reflects the requester's answer (Option B) to the spec's open
  question; makes the product self-serviceable without an admin step.

---

## Decision 9 — Removing the prior demo use cases (FR-012)

- **Decision**: **Delete** the records and files features end-to-end — backend
  `routes/records.ts`, `routes/files.ts`, their services and Zod schemas, `lib/r2.ts`; frontend
  `RecordsPage`, `FilesPage`, `RecordForm`, `FileUpload`; and their routes/nav. **Retain**
  `GET /api/health` as an **infrastructure-only, unauthenticated** endpoint but remove its
  user-facing page and nav; trim its report to `api` + `database` (drop the R2/`storage`
  component). Remove the now-unused shared types (`StoredRecord`, `FileAssetMeta`,
  `RecordListResponse`) and the `storage` field from `HealthReport`.
- **Rationale**:
  - FR-012/SC-007 require these features to be **unreachable by end users**; deleting the code
    (rather than hiding it) also removes dead code per Constitution I and shrinks attack
    surface.
  - Keeping a bare health endpoint preserves an operational signal without an end-user feature
    (spec Assumption on the internal health check).
- **R2 binding**: Left in `wrangler.toml` as **dormant** (no code references it) to avoid infra
  churn now; flagged for removal in a later cleanup. `MAX_UPLOAD_BYTES`/`ALLOWED_CONTENT_TYPES`
  vars likewise become dormant.
- **Alternatives considered**:
  - **Hide via nav only, keep routes**: Rejected — leaves reachable endpoints and dead code,
    failing "unreachable by end users" and the no-dead-code rule.

---

## Decision 10 — Frontend auth state & route protection

- **Decision**: Add an **`AuthContext`** that bootstraps the current user by calling
  `GET /api/auth/me` on load (the HttpOnly cookie is sent automatically), and exposes
  `login`, `register`, and `logout`. A **`ProtectedRoute`** wrapper redirects unauthenticated
  users to `/login`, preserving the intended destination. `apiClient` sends
  `credentials: 'include'` on every call and **centrally handles `401`** by clearing auth state
  and routing to `/login` (covers mid-session expiry, FR-006/edge cases). `/login` and
  `/register` are the only public routes; `/` (home) is protected.
- **Rationale**:
  - A single source of truth for auth state keeps UX consistent (Constitution III) and makes
    "no data without a valid session" (FR-006) enforced uniformly on the client, complementing
    the server-side `requireSession` gate (the server remains the authority).
  - Bootstrapping via `/api/auth/me` restores the session across reloads without exposing the
    token (FR-007, FR-013).
- **Alternatives considered**:
  - **Per-page auth checks**: Rejected — duplicative and error-prone vs. a shared context +
    route guard.
  - **Persisting user info in `localStorage`**: Avoided for the token; non-sensitive display
    fields could be cached but the server session remains authoritative.

---

## Decision 11 — Verification approach (Constitution Principle II)

- **Decision**: **No unit-test suites.** Verify via TypeScript strict, ESLint/Prettier, a
  Worker `wrangler deploy --dry-run` bundle check, and the manual [quickstart.md](./quickstart.md)
  walkthrough covering register → login → session-gated home → reload persistence → logout →
  post-logout denial. A *very small, optional* integration check of the login/session gate MAY
  be added later since auth is the critical security flow — but it is never a blocker.
- **Rationale**: Matches the constitution (unit tests not required; focus limited effort on
  critical security flows) and project instructions (optional lightweight checks for auth only).

---

## Summary of new/changed configuration

| Key | Location | Purpose | Secret? |
|-----|----------|---------|---------|
| `MONGODB_URI` | Wrangler secret (existing) | Atlas connection | Yes |
| `MONGODB_DB_NAME` = `vii_pass` | `wrangler.toml [vars]` (existing) | Target DB | No |
| `ALLOWED_ORIGINS` | `wrangler.toml [vars]` (existing) | CORS allowlist (SPA origin) | No |
| `COOKIE_DOMAIN` | `wrangler.toml [vars]` (**new**, prod only) | Shared parent domain for first-party cookie | No |
| `SESSION_IDLE_TTL_SECONDS` = `1800` | `wrangler.toml [vars]` (**new**) | Sliding inactivity timeout | No |
| `SESSION_ABSOLUTE_TTL_SECONDS` = `86400` | `wrangler.toml [vars]` (**new**) | Absolute session lifetime | No |
| `PBKDF2_ITERATIONS` = `600000` | `wrangler.toml [vars]` (**new**) | Password hash work factor | No |
| `BUCKET`, `MAX_UPLOAD_BYTES`, `ALLOWED_CONTENT_TYPES` | `wrangler.toml` (existing) | **Dormant** — files feature removed | No |

No new secrets are introduced (opaque sessions need no signing key). All new config is
non-secret and environment-driven (Constitution V; FR-008/SC-007).
