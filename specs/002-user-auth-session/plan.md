# Implementation Plan: User Authentication & Session Management

**Branch**: `topic/vii-1001-user-auth-session` (feature dir `specs/002-user-auth-session`, story `vii:1001`) | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-user-auth-session/spec.md`

## Summary

Turn the vii-pass scaffold into an authentication-first application. Remove the prior
demonstration use cases (health UI, records, files) from the end-user experience, and add:
a polished **login** page (US1), **self-service registration** (US2), a **session-gated
welcome home page** (US3), and a corner **user menu with logout** (US4). Accounts live in
the `users` collection of the `vii_pass` MongoDB Atlas database with passwords stored only
as salted hashes; server-side **session** records (referenced by an opaque, HttpOnly,
Secure cookie) gate every protected page and data request.

Technical approach: extend the existing Hono-on-Workers API and React/Vite SPA. Hash
passwords with **PBKDF2-HMAC-SHA-256 via the Workers-native Web Crypto API** (adaptive work
factor; no extra deps, no CPU-limit surprises). Represent sessions as documents in a
`sessions` collection keyed by the **SHA-256 hash of a high-entropy random token**; enforce
them with a `requireSession` middleware applied to all non-public routes. Deploy the API and
SPA under the **same registrable domain** (sibling subdomains) so the session cookie is
first-party (`SameSite=Lax`) and survives third-party-cookie deprecation.

## Technical Context

**Language/Version**: TypeScript 5.5 (strict) on Node 18+ tooling; compiled/bundled for the
Cloudflare Workers V8-isolate runtime (backend) and the browser (frontend).

**Primary Dependencies**: Backend — Hono 4 (routing/middleware), official `mongodb` driver 6
(Atlas via `nodejs_compat`), Zod 3 (boundary validation), `hono/cookie` (session cookie),
Web Crypto `SubtleCrypto` (PBKDF2 hashing, random tokens — no new dependency). Frontend —
React 18, Vite 5, React Router 6.

**Storage**: MongoDB Atlas database `vii_pass` — new collections `users` and `sessions`.
Cloudflare R2 binding (`BUCKET`) is retained in `wrangler.toml` but becomes **dormant**
(files feature removed); it may be removed in a later cleanup.

**Testing**: No unit-test suites (Constitution Principle II + project instructions). Primary
verification is TypeScript strict, ESLint/Prettier, and the manual [quickstart.md](./quickstart.md)
walkthrough. Because authentication is a critical security flow, a *very small, optional* set
of integration checks MAY be added later — never a blocker.

**Target Platform**: API on Cloudflare Workers (edge); SPA static build on Cloudflare Pages.

**Project Type**: Web application (separate `frontend/` + `backend/` + shared types),
extending the existing monorepo.

**Performance Goals**: Session-validated reads and `GET /api/auth/me` p95 < 200ms (one
indexed `sessions` lookup). **Auth endpoints (`/api/auth/login`, `/api/auth/register`) have a
documented budget of p95 < 500ms** because password hashing is *intentionally* costly (see
Complexity Tracking). Primary pages interactive < 2s (Constitution IV).

**Constraints**: Workers V8 runtime (no Node APIs beyond `nodejs_compat`); Workers CPU limits
make memory-hard KDFs risky, motivating PBKDF2 (research Decision 1). Session identifiers MUST
be HttpOnly (FR-013) — no client-script-readable tokens. Cross-subdomain cookies require the
same registrable domain in production. No secrets in source (FR/SC security gates).

**Scale/Scope**: Single-role authenticated users; four user stories; ~2 new collections, ~5
new API endpoints, ~4 new/updated SPA screens. Removal of 3 prior demo use cases.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| **I. Code Quality** | Strict TS, ESLint/Prettier clean, single-responsibility modules (users service, sessions service, middleware), TSDoc on exports; no dead code (demo features are removed, not commented out). | PASS |
| **II. Testing Standards** | No unit tests. Auth is a critical security flow → optional lightweight integration checks allowed but not required; manual quickstart verifies the flow. No coverage gate. | PASS |
| **III. UX Consistency** | Login/register/home/user-menu use the shared design tokens; consistent loading/empty/error states; WCAG 2.1 AA (keyboard, contrast, semantic labels, focus, skip link); actionable, non-leaky errors (generic login failure). | PASS |
| **IV. Performance** | Budgets defined above; auth-endpoint deviation for deliberate hashing cost is documented in Complexity Tracking; session validation is a single indexed lookup. | PASS (documented deviation) |
| **V. Scalability & Maintainability** | Stateless Workers; session state externalized to MongoDB (not in-process); env-driven config; no signing secret needed (opaque server-side sessions); YAGNI (single role, no MFA/reset). | PASS |

**Security gates** (Quality Gates & project instructions): passwords never stored/compared in
plaintext (PBKDF2 + per-user salt); session tokens stored **hashed**, transported via
HttpOnly+Secure cookie; generic auth errors prevent enumeration on login; brute-force
throttling (FR-014); Zod validation at the boundary; secrets only in env. All satisfied by
design.

**Result**: PASS. One documented performance deviation (auth-endpoint latency) recorded in
Complexity Tracking; no unjustified violations.

**Post-Design Re-evaluation** (after Phase 1): Re-checked against the completed
[data-model.md](./data-model.md) and [contracts/openapi.yaml](./contracts/openapi.yaml). No
new violations introduced — the design keeps password material hashed (PBKDF2), stores only
`SHA-256(token)` for sessions, exposes only `PublicUser` (never `passwordHash`/`status`/lock
fields), returns a single generic login error, and adds no new secrets or dependencies. The
lone Complexity-Tracking deviation is unchanged. **Constitution Check remains PASS.**

## Project Structure

### Documentation (this feature)

```text
specs/002-user-auth-session/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── openapi.yaml     # Phase 1 output — auth + health API
└── checklists/
    └── requirements.md  # From /speckit.specify
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── index.ts                     # (edit) mount auth router; apply requireSession globally; drop records/files
│   ├── env.ts                       # (edit) add SESSION_* + COOKIE_DOMAIN config to Bindings
│   ├── lib/
│   │   ├── mongo.ts                 # (keep) cached client + getDb
│   │   ├── password.ts              # (new) PBKDF2 hash + verify via Web Crypto
│   │   └── tokens.ts                # (new) random session token + SHA-256 hashing
│   ├── schemas/
│   │   ├── auth.schema.ts           # (new) register/login Zod schemas
│   │   └── health.schema.ts         # (keep, trim) api+database only
│   ├── services/
│   │   ├── users.service.ts         # (new) create/find users, credential verification
│   │   ├── sessions.service.ts      # (new) create/validate/revoke sessions; sliding + absolute expiry
│   │   └── health.service.ts        # (edit) report api + database only
│   ├── middleware/
│   │   ├── cors.ts                  # (edit) allow credentials for cookie auth
│   │   ├── error.ts                 # (keep) add 401/403/409/429 statuses
│   │   ├── validate.ts              # (keep) Zod helpers
│   │   └── requireSession.ts        # (new) gate protected routes; attach user to context
│   └── routes/
│       ├── auth.ts                  # (new) register, login, logout, me
│       └── health.ts                # (keep) infra-only, unauthenticated
│   # REMOVED: routes/records.ts, routes/files.ts, services/records.service.ts,
│   #          services/files.service.ts, schemas/record.schema.ts, schemas/file.schema.ts,
│   #          lib/r2.ts (dormant; removed with files feature)

frontend/
├── src/
│   ├── App.tsx                      # (edit) public /login, /register; protected / (home); remove demo routes
│   ├── main.tsx                     # (edit) wrap app in AuthProvider
│   ├── auth/
│   │   └── AuthContext.tsx          # (new) current-user state; login/register/logout; bootstrap via /api/auth/me
│   ├── components/
│   │   ├── Layout.tsx               # (edit) render UserMenu when authed; keep skip link/landmarks
│   │   ├── ProtectedRoute.tsx       # (new) redirect to /login without a session
│   │   └── UserMenu.tsx             # (new) corner menu: identity + logout
│   ├── pages/
│   │   ├── LoginPage.tsx            # (new)
│   │   ├── RegisterPage.tsx         # (new)
│   │   └── HomePage.tsx             # (new) "Welcome, <name>"
│   ├── services/
│   │   └── apiClient.ts             # (edit) credentials:'include'; central 401 handling
│   ├── styles/
│   │   └── tokens.css               # (edit) auth-form + user-menu styles
│   └── types/
│       └── index.ts                 # (edit) re-export auth/session view types
│   # REMOVED: pages/HealthPage.tsx, pages/RecordsPage.tsx, pages/FilesPage.tsx,
│   #          components/RecordForm.tsx, components/FileUpload.tsx

shared/
└── types/
    └── index.ts                     # (edit) add PublicUser, AuthResponse; trim HealthReport (drop storage);
                                     #        remove StoredRecord/FileAssetMeta/RecordListResponse
```

**Structure Decision**: Continue the existing web-app monorepo (`frontend/` + `backend/` +
`shared/`). This feature is additive on the backend (auth/session modules + a global session
gate) and largely a **replacement** of the frontend surface (auth screens + protected shell)
with the demo screens deleted. Shared types are updated so the SPA and API keep a single
source of truth for the public user/auth shapes.

## Complexity Tracking

> Only the one item below deviates from a constitutional default; it is justified here.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Auth endpoints exceed the default API p95 < 200ms budget (new budget: p95 < 500ms) | Password hashing (PBKDF2 with a high iteration count) is deliberately CPU-costly to resist offline brute-force attacks — the latency *is* the security control. Only `login` and `register` incur it. | Lowering the iteration count to hit 200ms would weaken hash strength below OWASP guidance; caching/precomputation is impossible for password verification. Session-validated reads still meet < 200ms. |
