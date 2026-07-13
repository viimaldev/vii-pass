# Implementation Plan: Two-Level Credential Encryption

**Branch**: `topic/vii-1011-credential-encryption` | **Date**: 2026-07-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-credential-encryption/spec.md`

## Summary

Chord secret values (all three field values + URL) become **end-to-end encrypted**:

- **Level 1 (browser)**: AES-256-GCM encryption in the browser via Web Crypto, keyed by a
  **vault key** wrapped by a key derived from the login password (PBKDF2). The vault key
  lives only in React memory for the session. Plaintext secrets never leave the device —
  the API payloads carry only ciphertext envelopes (`v1.l1.<ivB64url>.<ctB64url>`).
- **Level 2 (server)**: the Worker wraps the received Level-1 ciphertext in a second
  AES-256-GCM layer keyed by a deployment secret (`VAULT_ENC_KEY`, per-environment
  Cloudflare Worker secret with a key-id for rotation) before persisting, and unwraps it
  on read. The DB stores `v1.l2.<keyId>.<ivB64url>.<ctB64url>` — neither the DB alone nor
  the network payload alone yields plaintext.
- **Auth flow change (forced by "no password in network payload")**: the login password
  itself no longer travels to the server. The client derives an **auth hash** from the
  password (PBKDF2, client-side) and sends that instead; the server re-hashes it with its
  existing PBKDF2 storage scheme. Registration also uploads a **wrapped vault key** so
  the vault opens on any device and a future password change only re-wraps one key
  (never re-encrypts data — FR-010).

Titles stay plaintext (listing/uniqueness, FR-011). Existing chords are dropped, not
migrated. Existing users are dropped too (their stored verifier is keyed to the old
scheme — see research Decision 6).

## Technical Context

**Language/Version**: TypeScript 5.x everywhere (strict). Node 22 for tooling/deploy.

**Primary Dependencies**: Hono (Workers-native router), official `mongodb` driver v6,
Zod (API validation), React 18 + Vite + React Router 6, Bootstrap 5 (CSS only).
**Crypto: Web Crypto API only** (`crypto.subtle` — AES-GCM, PBKDF2, HKDF) — available
natively in both browsers and Cloudflare Workers. **Zero new npm dependencies.**

**Storage**: MongoDB Atlas (db `vii_pass` / `vii_pass_preview`). `chords` collection
stores Level-2 envelopes for `url` + `fields[].value`; `users` collection gains
`vaultKeyWrapped` + `kdfSalt`; existing PBKDF2 password storage format reused unchanged
(input becomes the client auth-hash instead of the raw password).

**Testing**: No unit tests (Constitution II). Manual quickstart verification of the
critical security flow (network-panel + DB inspection walkthrough), consistent with the
constitution's allowance for manual checks on security-critical paths.

**Target Platform**: Cloudflare Workers (backend, `nodejs_compat`), evergreen browsers
(frontend). PBKDF2 on Workers hard-capped at 100k iterations (known constraint);
client-side PBKDF2 in browsers has no such cap.

**Project Type**: Web application (frontend + backend + shared workspaces).

**Performance Goals**: Vault load/save within ~1s perceived (SC-003). Client KDF at
sign-in ≤ ~300ms on mid-range hardware (one-time per session). Per-value AES-GCM is
sub-millisecond; a 50-chord section adds < 50ms crypto overhead total.

**Constraints**: No plaintext secrets in request/response bodies, DB, or logs. No new
dependencies. Unlock material memory-only, cleared at logout. Workers per-request Mongo
connection pattern unchanged. Level-2 key must be rotatable (key-id in envelope).

**Scale/Scope**: Single-user vaults, tens-to-hundreds of chords per user. Touches: shared
types, backend (auth schema/service, chords schema/service, new crypto lib, wrangler
secrets), frontend (new crypto lib, AuthContext, vault key context, AddChordDialog,
ChordCard, vaultApi), registration/login pages (crypto call only, no UI change).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Code Quality | New crypto code isolated in single-responsibility modules (`frontend/src/vault/crypto.ts`, `backend/src/lib/vaultCrypto.ts`) mirroring the existing `lib/password.ts` pattern; TSDoc on all exported functions; lint/typecheck gates unchanged. | PASS |
| II. Testing Standards | No unit tests added. Critical security flow verified via the manual quickstart walkthrough (network panel + DB inspection), exactly the kind of targeted verification Principle II reserves effort for. | PASS |
| III. UX Consistency | No new UI surfaces; existing dialogs/cards keep their exact look and behavior (masked values, eye toggle, copy). Per-field decrypt-failure state reuses the existing error-presentation patterns. Responsive behavior unchanged because layout is unchanged. Registration page gains one static warning line (forgotten password = unrecoverable vault) using existing `form-text` styling. | PASS |
| IV. Performance | Budgets defined above (KDF ≤ 300ms once per sign-in; < 50ms crypto per vault load; SC-003 ~1s end-to-end). AES-GCM and PBKDF2 measured characteristics are well known; quickstart includes a perceived-latency check. | PASS |
| V. Scalability & Maintainability | Stateless request handling preserved (Level-2 key from env secret, no server session state added). Envelope format is versioned (`v1`) with a key-id → rotation and future algorithm changes are extension points, not rewrites. No speculative features (no recovery, no re-encryption machinery). | PASS |

**Security note (documented deviation carried from spec)**: Level-1 key strength is
bounded by the 3–10 char password policy (feature 004's deliberate relaxation, reaffirmed
in this feature's clarification Q1). See Complexity Tracking.

**Post-design re-check (after Phase 1)**: PASS — design artifacts introduce no new
violations; the only deviation remains the pre-existing password policy, logged below.

## Project Structure

### Documentation (this feature)

```text
specs/010-credential-encryption/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── auth-api.md      # Changed register/login payloads (auth hash + wrapped key)
│   └── chords-api.md    # Changed chord payloads (ciphertext envelopes)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
shared/
└── types/index.ts                      # EDIT: EncryptedValue alias; Chord.url/fields value types;
                                        #       Register/Login request types; AuthResponse + wrapped key

backend/
├── wrangler.toml                       # EDIT: document VAULT_ENC_KEY secret (set via wrangler secret put)
├── .dev.vars(.example)                 # EDIT: add VAULT_ENC_KEY for local dev
└── src/
    ├── env.ts                          # EDIT: add VAULT_ENC_KEY binding type
    ├── lib/
    │   ├── password.ts                 # UNCHANGED (now hashes the client auth-hash string)
    │   └── vaultCrypto.ts              # NEW: Level-2 AES-GCM wrap/unwrap + envelope parse/format
    ├── schemas/
    │   ├── auth.schema.ts              # EDIT: authHash + kdfSalt + vaultKeyWrapped fields
    │   └── chords.schema.ts            # EDIT: value/url become L1-envelope strings (format-validated)
    ├── services/
    │   ├── users.service.ts            # EDIT: store kdfSalt + vaultKeyWrapped; salt endpoint support
    │   └── chords.service.ts           # EDIT: L2-wrap on write, L2-unwrap on read
    └── routes/
        └── auth.ts                     # EDIT: register/login payloads; GET /api/auth/salt/:username

frontend/
└── src/
    ├── auth/
    │   └── AuthContext.tsx             # EDIT: derive keys at login/register; hold vault key; clear on logout
    ├── vault/
    │   ├── crypto.ts                   # NEW: Level-1 KDF, wrap/unwrap vault key, encrypt/decrypt values
    │   └── VaultContext.tsx            # EDIT: decrypt-on-fetch / encrypt-on-save orchestration
    ├── components/
    │   ├── AddChordDialog.tsx          # EDIT: submit plaintext → context encrypts (minor)
    │   └── ChordCard.tsx               # EDIT: per-field decrypt-error state
    ├── pages/
    │   └── RegisterPage.tsx            # EDIT: one-line unrecoverable-vault notice
    └── services/
        └── vaultApi.ts                 # EDIT: types only (payloads now envelopes)
```

**Structure Decision**: Existing three-workspace monorepo (shared / backend / frontend)
is retained. Crypto logic gets exactly two new single-purpose modules — one per side —
mirroring where `password.ts` already lives on the backend; everything else is edits to
existing files.

## Complexity Tracking

> Deviations that a security review would flag, accepted deliberately:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Level-1 KDF input is a 3–10 char password (weak against offline brute force if DB + server secrets leak) | User decision (spec clarification Q1): zero-friction unlock via existing login password; policy continuity with feature 004 | Separate strong vault passphrase or ≥12-char policy rejected by user; Level 2 (server-side AES-GCM under a 256-bit deployment secret) is the compensating control, so a DB-only leak still yields nothing |
| No recovery path — forgotten password permanently loses the vault | User decision (spec clarification Q2): defer recovery to a future feature; true zero-knowledge for now | Server-escrowed key rejected (breaks SC-005 — operator could read vaults); recovery-key UX deferred; wrapped-vault-key design keeps the door open without shipping it |
| Login flow gains one extra round-trip (`GET /api/auth/salt/:username`) before `POST /login` | Client must derive keys from a per-user salt *before* it can produce the auth hash | Deterministic salt (e.g. hash of username) rejected: enables precomputed rainbow tables per username; embedding salt fetch in login POST rejected: server can't identify the user until it has the username anyway, and a combined endpoint would leak timing differences |
