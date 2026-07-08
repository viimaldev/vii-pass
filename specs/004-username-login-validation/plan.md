# Implementation Plan: Username-Based Login Validation

**Branch**: `topic/vii-1004-username-login-validation` (feature dir `specs/004-username-login-validation`, story `vii:1004`) | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-username-login-validation/spec.md`

## Summary

Change the account identity and credential rules established in feature 002. The login
identifier moves from an **email address** to a **username** — ASCII alphanumeric only,
unique (case-insensitively), 3–30 characters — and the registration password policy changes
from "at least 12 characters" to a **3–10 character** range. Email is removed from the login
identity entirely; the separate **display name** (used in the welcome message and user menu)
is retained.

Technical approach: a **targeted, in-place edit** of the existing auth slice — no new
dependencies, endpoints, collections, or config. The `users` collection's `email` field
becomes `username` (normalized to lowercase, unique-indexed); the Zod boundary schemas swap
the email rule for a username format/length rule and relax the password rule to 3–10; the
users service, auth routes, shared `PublicUser` type, the two auth pages, the auth context,
and the user-menu identity line are updated to speak "username" instead of "email". Session
handling, PBKDF2 hashing, cookies, and the protected-route gate are unchanged.

**Security note (explicit, documented deviation):** for a password manager, allowing 3-character
passwords is materially weaker than the prior 12-character minimum and runs against OWASP
guidance (A07: Identification & Authentication Failures). It is implemented exactly as
requested and flagged in [Complexity Tracking](#complexity-tracking) and
[research.md](./research.md) Decision 3 with a recommended future revisit.

## Technical Context

**Language/Version**: TypeScript 5.5 (strict) — unchanged. Backend bundled for the Cloudflare
Workers V8 isolate (`nodejs_compat`); frontend for the browser.

**Primary Dependencies**: **No change.** Backend — Hono 4, official `mongodb` driver 6, Zod 3,
Web Crypto `SubtleCrypto` (PBKDF2). Frontend — React 18, Vite 5, React Router 6. No packages
added or removed.

**Storage**: MongoDB Atlas database `vii_pass`, existing **`users`** collection. The login
identifier field `email` becomes `username`; the unique index moves from `email` to
`username`. The `sessions` collection is untouched.

**Testing**: No unit-test suites (Constitution Principle II + project instructions). Primary
verification is TypeScript strict + ESLint/Prettier + the manual [quickstart.md](./quickstart.md)
walkthrough. Auth is a critical security flow, so optional lightweight checks are permitted but
not required.

**Target Platform**: API on Cloudflare Workers (edge); SPA static build on Cloudflare Pages —
unchanged.

**Project Type**: Web application (existing `frontend/` + `backend/` + `shared/` monorepo).

**Performance Goals**: Unchanged from feature 002 — `GET /api/auth/me` and session-validated
reads p95 < 200ms (single indexed lookup, now by `username`/`tokenHash`); `POST
/api/auth/register` and `/api/auth/login` p95 < 500ms (deliberate PBKDF2 cost, unchanged).
Auth pages interactive < 2s.

**Constraints**: Workers V8 runtime; PBKDF2 iteration cap 100,000 on Workers (already handled).
Username uniqueness must be race-safe → enforced by a unique index, not an application check.
The requested 3–10 password range is applied as-is (documented security trade-off). No secrets
in source.

**Scale/Scope**: Single-role authenticated users. ~8 source files edited, 0 added, 0 removed;
1 collection field rename + 1 index change; no new endpoints. Assumes **no production accounts
under the old email scheme** (early lifecycle) — no data migration in scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| **I. Code Quality** | Strict TS, ESLint/Prettier clean, single-responsibility modules unchanged; the email→username swap is a rename-in-place with updated TSDoc, no dead code, no commented-out blocks. | PASS |
| **II. Testing Standards** | No unit tests. Manual quickstart covers the changed register/login flows; optional integration checks allowed, not required. No coverage gate. | PASS |
| **III. UX Consistency** | Register/login reuse the shared design tokens and existing field/hint/alert patterns; accessible inline validation (`aria-describedby`, `aria-invalid`), keyboard/contrast/semantic labels preserved; errors stay actionable and non-leaky (generic login failure retained). | PASS |
| **IV. Performance** | No new work on hot paths; lookups stay a single indexed query (`username` unique index replaces `email`). Existing auth-endpoint budget (p95 < 500ms) unchanged. | PASS |
| **V. Scalability & Maintainability** | No new state, deps, or config; uniqueness enforced by a DB unique index (stateless, race-safe); YAGNI honored (single normalized `username` field, no extra columns). | PASS |

**Security gates** (Quality Gates & project instructions): passwords remain hashed with PBKDF2
+ per-user salt and are never stored/compared in plaintext; session tokens remain hashed and
HttpOnly; login keeps a single generic, non-enumerating error; Zod validation stays at the
boundary; usernames are validated to a strict `^[A-Za-z0-9]+$` allowlist (injection-safe,
used only in an equality filter); no secrets added. **One deliberate relaxation:** the password
minimum drops from 12 to 3 characters per explicit user request — weaker than OWASP guidance
for a password manager. This is a *justified, documented* deviation (not an unjustified
violation): see Complexity Tracking. All other gates satisfied.

**Result**: PASS. One documented security deviation (password length policy), justified by an
explicit product requirement and recorded below; no unjustified violations.

**Post-Design Re-evaluation** (after Phase 1): Re-checked against
[data-model.md](./data-model.md) and [contracts/openapi.yaml](./contracts/openapi.yaml). The
design keeps password material hashed, exposes only `PublicUser` (now `{ id, username,
displayName }`, still no secret fields), preserves the generic login error, adds no secrets or
dependencies, and enforces uniqueness via the unique index. No new violations; the lone
password-length deviation is unchanged. **Constitution Check remains PASS.**

## Project Structure

### Documentation (this feature)

```text
specs/004-username-login-validation/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── openapi.yaml     # Phase 1 output — updated auth API (username + 3–10 password)
└── checklists/
    └── requirements.md  # From /speckit.specify
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── schemas/
│   │   └── auth.schema.ts       # (edit) replace emailField with usernameField
│   │                            #        (trim → 3–30 chars → ^[A-Za-z0-9]+$ → toLowerCase);
│   │                            #        password min 12 → min 3 / max 10; login username = trim+lowercase, non-empty
│   ├── services/
│   │   └── users.service.ts     # (edit) UserDoc.email → username; unique index email→username;
│   │                            #        createUser input/dup-key → 409 username_taken;
│   │                            #        verifyCredentials(username); toPublicUser returns username
│   └── routes/
│       └── auth.ts              # (edit) login destructures { username, password };
│                                #        error text "Incorrect username or password." (register unchanged in shape)
│   # UNCHANGED: lib/password.ts, lib/tokens.ts, lib/mongo.ts, services/sessions.service.ts,
│   #            middleware/*, routes/health.ts, env.ts, wrangler.toml (no new vars)

frontend/
├── src/
│   ├── pages/
│   │   ├── RegisterPage.tsx     # (edit) Email field → Username field (type=text, autoComplete=username);
│   │   │                        #        add username min-3 + alphanumeric client validation;
│   │   │                        #        password rule 12-min → 3–10 range; update hints/aria
│   │   └── LoginPage.tsx        # (edit) Email field → Username field (type=text, autoComplete=username)
│   ├── auth/
│   │   └── AuthContext.tsx      # (edit) login/register signatures + POST bodies use username
│   ├── components/
│   │   └── UserMenu.tsx         # (edit) identity line shows user.username (was user.email)
│   └── styles/
│       └── tokens.css           # (edit, minor) rename .user-menu__email → .user-menu__username (cosmetic)

shared/
└── types/
    └── index.ts                 # (edit) PublicUser.email → PublicUser.username (comment updated)
    # frontend/src/types/index.ts re-exports PublicUser unchanged (no edit needed)
```

**Structure Decision**: Continue the existing web-app monorepo. This feature is a **surgical
in-place modification** of the auth slice created in feature 002 — the same files that
introduced email-based identity are edited to use a username, plus the password-length rule is
relaxed. Nothing is added or deleted; the shared `PublicUser` type keeps the SPA and API in
lockstep on the new identifier.

## Complexity Tracking

> One deviation from a security default is recorded and justified here.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Registration password minimum drops from 12 → 3 characters (new policy: 3–10), weaker than OWASP A07 guidance for a password-manager product | Explicit, unambiguous user requirement ("Password: Length 3-10"). The product owner is entitled to set this policy for their own application; implementing it as specified respects the requirement and keeps the spec, contract, and code consistent. | Keeping the 12-character minimum would contradict the stated requirement. A compromise (e.g., 8-min) was not requested and would silently override the user's decision. The trade-off is instead made **visible** (research Decision 3, spec Assumptions) with a recommended future revisit, rather than hidden. Password material is still salted+PBKDF2-hashed, so storage security is unchanged — only the strength floor moves. |
