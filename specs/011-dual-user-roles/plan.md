# Implementation Plan: Dual Usernames with Roles & Security-Question Password Reset

**Branch**: `topic/vii-1012-dual-user-roles` | **Date**: 2026-07-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-dual-user-roles/spec.md`

## Summary

Registration now creates one **account** with **two usernames** — an admin username
(full capabilities) and a normal username (view/reveal/copy only) — sharing a single
password, plus a **security question** (one of 5 fixed, in a dropdown) and answer used
to reset a forgotten password. Sign-in works with either username; the session carries
the role of the username used, and the server refuses every vault mutation under a
normal-role session. The reset flow (admin username → question → correct answer →
reset dialog) must preserve vault readability (FR-011), which — given feature 010's
end-to-end encryption — is achieved by wrapping the **same vault key a second time**
under a key derived from the security answer (`vaultKeyWrappedRecovery`). Everything
stays Web Crypto + existing stack: **zero new dependencies**. Existing accounts are
dropped, not migrated (per spec Assumptions).

## Technical Context

**Language/Version**: TypeScript 5.x everywhere (strict mode; npm workspaces monorepo)

**Primary Dependencies**: Backend: Hono on Cloudflare Workers (`nodejs_compat`), official `mongodb` driver v6, Zod. Frontend: React 18 + Vite + React Router 6, Bootstrap 5 (CSS only). Crypto: Web Crypto API only (PBKDF2/HKDF/AES-256-GCM — same primitives as feature 010). **No new dependencies.**

**Storage**: MongoDB Atlas, db `vii_pass` / `vii_pass_preview`. Collections: `users` (reshaped: embedded `logins` array + security-question fields + recovery wrap), `sessions` (gains `role`), `resetAttempts` (NEW: reset throttling), `sections`/`chords` (unchanged shape; access now role-gated).

**Testing**: No unit tests (Constitution Principle II). Manual verification of the critical flows via quickstart.md; gates = `npm run typecheck` + `npm run lint` + `npm run build --workspaces --if-present`.

**Target Platform**: Cloudflare Workers (single-origin Worker serves SPA + `/api/*`); modern evergreen browsers (Web Crypto + IndexedDB required, unchanged from 010).

**Project Type**: Web application (backend + frontend + shared workspaces).

**Performance Goals**: Login/register p95 unchanged from feature 010 (~1 extra client-side PBKDF2 derivation at register only). Reset flow end-to-end < 2 min user time (SC-004); each reset step is 1 round-trip + client KDF (~200–400ms). Role check adds ~0 ms (in-memory on session context).

**Constraints**: Workers PBKDF2 cap (100k) irrelevant — all 600k derivations are client-side. Workers have no cross-request memory → reset-attempt throttling must be DB-backed. Password policy stays 3–10 chars; username rules stay 3–30 alnum. Zero-knowledge stance: the server must never hold material sufficient to decrypt the vault.

**Scale/Scope**: Single-digit users (personal/household password manager). ~6 backend files touched + 1 new middleware, ~8 frontend files touched + 2 new (reset page, security-question constants), shared types extended.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Verdict | Notes |
|---|-----------|---------|-------|
| I | Code Quality | PASS | Mirrors existing router→service→schema layering; new `requireAdmin` middleware is single-purpose; TSDoc on all exports; no dead code left (old single-username register path replaced, not kept). |
| II | Testing Standards | PASS | No unit tests. Critical security flows (role enforcement, reset, recovery wrap round-trip) verified manually via quickstart walkthrough + direct-request mutation checks (SC-003). |
| III | UX Consistency | PASS | Register form and reset flow reuse existing Bootstrap card/form patterns, design tokens, inline validation with `aria-invalid`/`aria-describedby`; read-only vault hides controls (no dead buttons); responsive/mobile-first verified per story at 320px/tablet/desktop. |
| IV | Performance | PASS | Budgets stated in Technical Context; no server-side KDF added; role gate is an in-memory comparison; reset adds bounded client KDF work only. |
| V | Scalability & Maintainability | PASS | Stateless Workers preserved — throttling and reset tokens are DB-backed, not in-memory; config via existing env bindings (no new secrets); YAGNI: no generic RBAC framework, just two roles on the session. |

**Security notes (Constitution Quality Gates + copilot-instructions Security)** — deviations documented in Complexity Tracking:

- Security-question recovery is inherently weaker than the password factor; mitigations: client-side PBKDF2 600k over the normalized answer, server-side verifier re-hash (same scheme as `authHash`), DB-backed attempt throttling, non-enumerable decoy question/salt.
- The server still never sees the password, the answer, the vault key, or any plaintext chord value.

## Project Structure

### Documentation (this feature)

```text
specs/011-dual-user-roles/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── auth-api.md      # Register/login/salt/reset endpoint contracts
│   └── vault-authz.md   # Role-gating contract for sections/chords routes + UI
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
shared/
└── types/
    └── index.ts                    # EDIT: PublicUser.role, register/login/reset payloads,
                                    #       SECURITY_QUESTIONS const (first runtime export)

backend/
└── src/
    ├── middleware/
    │   └── requireAdmin.ts         # NEW: 403 role_forbidden gate for mutating routes
    ├── routes/
    │   ├── auth.ts                 # EDIT: register payload, reset endpoints (question/verify/complete)
    │   ├── sections.ts             # EDIT: requireAdmin on POST//reorder/PATCH/DELETE
    │   └── chords.ts               # EDIT: requireAdmin on POST/reorder/PATCH/DELETE
    ├── schemas/
    │   └── auth.schema.ts          # EDIT: registerSchema (2 usernames + question + answer material),
    │                               #       reset schemas
    └── services/
        ├── users.service.ts        # EDIT: UserDoc reshape (logins[], security question, recovery wrap),
        │                           #       resolve-by-either-username, reset verify/complete
        └── sessions.service.ts     # EDIT: SessionDoc.role, createSession(role),
                                    #       validateSession→{userId,role}, revokeAllForUser

frontend/
└── src/
    ├── auth/
    │   └── AuthContext.tsx         # EDIT: role on user, register() new signature w/ recovery wrap
    ├── components/
    │   ├── SectionTabs.tsx         # EDIT: hide add/move/edit controls when read-only
    │   ├── ChordGrid.tsx           # EDIT: hide add tile + disable DnD when read-only
    │   └── ChordCard.tsx           # EDIT: hide edit/move buttons when read-only
    ├── pages/
    │   ├── RegisterPage.tsx        # EDIT: Admin Username, Username, Display Name, Password,
    │   │                           #       question dropdown, answer
    │   ├── LoginPage.tsx           # EDIT: "Forgot password?" link
    │   └── ResetPasswordPage.tsx   # NEW: 3-step reset flow (username → question/answer → new password)
    ├── vault/
    │   └── crypto.ts               # EDIT: deriveRecoveryKeys(answer, salt) helper (same KDF pipeline)
    ├── App.tsx                     # EDIT: /reset public route
    └── styles/tokens.css           # EDIT (if needed): reset-flow step styles via tokens
```

**Structure Decision**: Existing three-workspace monorepo retained. Backend keeps the
router→service→schema layering; the only structurally new backend artifact is the
`requireAdmin` middleware (mirrors `requireSession`). Frontend adds one page
(`ResetPasswordPage`) and threads a derived `readOnly` flag from `useAuth()` into the
three vault components that render mutation controls.

## Complexity Tracking

> Documented deviations (Constitution security gate / product security posture):

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Recovery factor (security answer) is weaker than the password factor and is guessable by someone who knows the user | Explicit product requirement: forgotten password must be recoverable via admin username + security answer (FR-008), removing 010's "vault unrecoverable" limitation | Keeping zero-recovery (010 status quo) rejected by the feature description itself; email-based recovery rejected — email is not part of the identity model (feature 004 removed it) |
| Security answer becomes vault-decryption-capable material (`vaultKeyWrappedRecovery`) | FR-011 requires stored values to remain READABLE after reset; with E2E encryption the only way is a second wrap of the vault key under answer-derived material — a server-side reset alone would orphan the vault | Rejecting FR-011 (wipe vault on reset) defeats the purpose of a password manager; escrowing the vault key server-side breaks zero-knowledge entirely |
| Roles are advisory between two identities that share ONE password — the "normal" user knows the password and could re-register or use the admin name if they learn it | The feature explicitly models a trusted-household convenience boundary (safe read-only identity), not a hostile-user security boundary | A true multi-user model (separate passwords/accounts + sharing grants) is a far larger feature and contradicts "for both usernames, password should be same" |
| New `resetAttempts` collection (throttling state) | Workers isolates hold no cross-request memory; FR-010 requires wrong-answer throttling that is indistinguishable for known vs unknown names → must key attempts by *requested name string*, incl. names that match no account | Per-account counters only (like login lockout) leak account existence: unknown names could never hit 429 |
