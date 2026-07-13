# Tasks: Two-Level Credential Encryption

**Input**: Design documents from `/specs/010-credential-encryption/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (auth-api.md, chords-api.md), quickstart.md

**Tests**: Per Constitution Principle II, NO unit-test tasks. The critical security flow is verified via the manual quickstart walkthrough (network-panel + DB inspection), which is exactly the targeted verification the Constitution reserves effort for.

**Organization**: Tasks are grouped by user story. Note: the client key hierarchy and changed auth payloads are **foundational** (Phase 2) because US1's encryption cannot function without a vault key established at sign-in; US2 then owns the unlock *lifecycle* (memory-only, logout clearing, locked-vault refresh).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1, US2, US3 (user story phases only)

## Path Conventions

Web app monorepo: `shared/types/`, `backend/src/`, `frontend/src/` (plan.md structure).

---

## Phase 1: Setup (Environment & Data)

**Purpose**: Secrets/bindings and clean slate required by everything else

- [X] T001 Add Level-2 key material to local env: `VAULT_ENC_KEY="k1:<base64url-32-bytes>"` (generate real random value) and `SALT_DECOY_PEPPER="<random string>"` in `backend/.dev.vars`, placeholders + comments in `backend/.dev.vars.example`, documentation comment in `backend/wrangler.toml` (secrets set via `wrangler secret put`, never in `[vars]`), and add both binding types to `Bindings` in `backend/src/env.ts`
- [X] T002 Drop dev/preview data whose semantics change (`users`, `sessions`, `chords`) via an inline node `.mjs` script reading `backend/.dev.vars` (feature-009 precedent — no mongosh), verify drop output

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Key hierarchy, envelope crypto, and the changed auth flow — no story works without a vault key in the session

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Update shared contracts in `shared/types/index.ts`: add `EncryptedValue` alias + TSDoc, change `ChordField.value` and `Chord.url` to `EncryptedValue | null`, add `RegisterRequest` (`username`, `displayName`, `authHash`, `kdfSalt`, `vaultKeyWrapped`), `LoginRequest` (`username`, `authHash`), `SaltResponse` (`kdfSalt`), and extend `AuthResponse` with `vaultKeyWrapped: string | null` (data-model.md "Shared types")
- [X] T004 [P] Create client crypto module `frontend/src/vault/crypto.ts`: PBKDF2-HMAC-SHA-256 600k iterations over password+kdfSalt → masterKey; HKDF-SHA-256 split (`info="vii-pass/auth"` → authHash base64url 43 chars, `info="vii-pass/wrap"` → wrapKey); generate random 256-bit vault key + 16-byte kdfSalt; AES-256-GCM wrap/unwrap of vault key (`v1.wk.<iv>.<ct>`); AES-256-GCM encrypt/decrypt of values (`v1.l1.<iv>.<ct>`, random 12-byte IV per value); all via Web Crypto, TSDoc on every export (research Decisions 1–3, data-model key hierarchy)
- [X] T005 [P] Create server crypto module `backend/src/lib/vaultCrypto.ts`: parse `VAULT_ENC_KEY` (`k1:<b64url>`, support multiple comma-separated key-ids for rotation); derive per-user AES key via HKDF-SHA-256(key, salt=userId); wrap L1→L2 (`v1.l2.<keyId>.<iv>.<ct>`) on write and unwrap L2→L1 on read; on unwrap failure return the `"v1.err"` sentinel and log metadata only (never value content — FR-003); reuse `lib/encoding.ts` helpers (research Decisions 4–5, contracts/chords-api.md server table)
- [X] T006 Update `backend/src/schemas/auth.schema.ts`: `registerSchema` replaces `password` with `authHash` (base64url, exactly 43 chars), adds `kdfSalt` (base64url, exactly 22 chars) and `vaultKeyWrapped` (regex `^v1\.wk\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{1,128}$`); `loginSchema` replaces `password` with lenient `authHash` string (min 1 — bad formats fail as generic invalid credentials); remove the server-side password policy fields (policy now client-side only)
- [X] T007 Update `backend/src/services/users.service.ts`: `UserDoc` gains `kdfSalt` + `vaultKeyWrapped`; `createUser` accepts and stores them, hashing `authHash` through the existing `hashPassword` (unchanged `lib/password.ts`); `verifyCredentials(env, username, authHash)`; add `getSaltForUsername(env, username)` returning the real `kdfSalt` or the deterministic decoy (base64url of first 16 bytes of SHA-256(lowercased username + `SALT_DECOY_PEPPER`)) with identical shape/timing (contracts/auth-api.md); `toPublicUser` unchanged
- [X] T008 Update `backend/src/routes/auth.ts`: new public `GET /salt/:username` (200 always, decoy for unknown — no enumeration); `POST /register` accepts new payload and returns `{ user, vaultKeyWrapped }` 201; `POST /login` destructures `{ username, authHash }` and returns `{ user, vaultKeyWrapped }`; `GET /me` also returns `vaultKeyWrapped` (locked-vault re-unlock support); TSDoc updated; logout untouched
- [X] T009 Update `frontend/src/auth/AuthContext.tsx`: on register — generate kdfSalt + vault key, derive masterKey/authHash/wrapKey via `vault/crypto.ts`, wrap vault key, send new `RegisterRequest`; on login — fetch `GET /api/auth/salt/:username`, derive, send `authHash`, unwrap `vaultKeyWrapped` from response; hold the unwrapped vault key in a `useRef` (never state/storage) exposed via context; zero the ref on logout and in the central 401 handler (FR-006); client-side password policy check (3–10 chars) stays in the pages

**Checkpoint**: Register/login round-trips work end-to-end with `authHash` (no password on the wire) and a vault key present in memory — chord encryption can now build on it

---

## Phase 3: User Story 1 — Secrets unreadable in transit and at rest (Priority: P1) 🎯 MVP

**Goal**: Every chord field value + URL is an L1 envelope on the wire and an L2 envelope in the DB; reveal/copy round-trips losslessly; tamper → per-field error

**Independent Test**: quickstart §2–4 + §8–9 — save a chord, Ctrl+F the network payloads and DB documents for the plaintext (zero hits, two distinct envelope forms), reveal/copy returns the original, corrupted DB value shows a per-field read error

- [X] T010 [P] [US1] Rewrite `backend/src/schemas/chords.schema.ts`: `fields[].value` = null or L1-envelope regex `^v1\.l1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$` (≤1024 chars); `url` = null or same regex (≤4096 chars); DELETE the server-side URL normalization/allow-list transform (moves client-side); title rules unchanged; plaintext-looking values → 400 validation_error (FR-009 backstop)
- [X] T011 [US1] Update `backend/src/services/chords.service.ts`: on create/update wrap each non-null `url`/`fields[].value` L1→L2 via `vaultCrypto.ts`; on every read path unwrap L2→L1 before serialization, mapping failures to the `"v1.err"` sentinel per field (others unaffected); title/titleNormalized/uniqueness/reorder logic untouched; ensure no log statement can contain envelope contents (depends on T005, T010)
- [X] T012 [US1] Update `frontend/src/vault/VaultContext.tsx` as the single crypto boundary: decrypt all chord `url`/`fields[].value` on fetch using the vault key from AuthContext (map `"v1.err"` and any local decrypt failure to a per-field error sentinel value); encrypt on save before calling `vaultApi` (encryption failure aborts the save with a user-facing error, nothing transmitted — FR-009); components above receive/submit plaintext exactly as today (FR-004/FR-008)
- [X] T013 [P] [US1] Update `frontend/src/components/AddChordDialog.tsx`: enforce the plaintext rules client-side pre-encryption — value ≤200 chars, URL trim/`https://`-prepend/`http(s)`-only allow-list/≤2048 (the validation that left the server in T010); submit plaintext to VaultContext; form UX otherwise unchanged
- [X] T014 [US1] Update `frontend/src/components/ChordCard.tsx`: render the per-field error sentinel as "This value could not be read" with eye/copy disabled for that field only (FR-007); re-check the decrypted URL against the `http(s)` allow-list before using it as an `href` — failing URLs render as a read error, never a link (stored-XSS boundary at decrypt-render, research Decision 9); add minimal error-state styling to `frontend/src/styles/tokens.css` using existing tokens (depends on T012)
- [X] T015 [P] [US1] Update `frontend/src/services/vaultApi.ts`: types/TSDoc only — payloads now carry `EncryptedValue | null` envelopes; no behavioral change
- [X] T016 [US1] Verify US1 end-to-end (quickstart §2–4, §8–9): network payloads carry only `v1.l1.*` (plaintext Ctrl+F = zero hits), DB stores `v1.l2.k1.*` (different form), reveal/copy/edit round-trip lossless, tampered DB value → isolated per-field error, hand-crafted plaintext value → 400

**Checkpoint**: US1 fully functional — the MVP security guarantee (SC-001/SC-002/SC-004/SC-006) holds

---

## Phase 4: User Story 2 — Vault unlock tied to sign-in (Priority: P2)

**Goal**: Unlock happens inside normal sign-in with no extra prompt; nothing unlockable survives logout; refresh yields a clean locked-vault → unlock flow

**Independent Test**: quickstart §1 + §5–7 — register/login with network panel open (no password field anywhere), inspect browser storage (no key material), logout and confirm nothing remains, refresh and unlock with the password

- [X] T017 [US2] Extend `frontend/src/auth/AuthContext.tsx` with the locked-vault lifecycle: derive a `vaultLocked` status (session user present but vault key absent — e.g. after refresh, where `GET /me` returns `vaultKeyWrapped` but memory is empty); add `unlockVault(password)` that re-derives via salt fetch + PBKDF2 + HKDF and unwraps `vaultKeyWrapped` from `/me`, with a clear error on wrong password (stays locked); ensure the 401 handler and logout also reset `vaultLocked` state coherently (depends on T009; same file — sequential after Phase 2)
- [X] T018 [US2] Add the locked-vault UI on the vault surface (`frontend/src/pages/HomePage.tsx` + `frontend/src/vault/VaultContext.tsx` wiring): while locked, chord titles/sections may list (plaintext) but all values render masked placeholders and reveal/copy are disabled; show an inline Unlock password form styled with existing Bootstrap form classes + tokens (label, `form-control`, `btn btn-primary`, accessible error via existing alert pattern); on success VaultContext decrypts and the vault behaves normally; responsive at 320px+ (depends on T012, T017)
- [X] T019 [P] [US2] Add the one-line unrecoverable-vault notice to `frontend/src/pages/RegisterPage.tsx` using the existing `form-text` styling: forgotten password = vault contents cannot be recovered (spec assumption / clarification Q2)
- [X] T020 [US2] Verify US2 end-to-end (quickstart §1, §5–7): register/login request bodies contain `authHash`/`kdfSalt`/`vaultKeyWrapped` and never a password; salt endpoint returns identically-shaped decoys for unknown usernames; browser Local/Session Storage + IndexedDB contain no key material; logout → sign back in cleanly; refresh → locked state → unlock with correct password works, wrong password errors and stays locked

**Checkpoint**: Unlock lifecycle complete — FR-005/FR-006 and SC-005's client-side half verified

---

## Phase 5: User Story 3 — Password change keeps the vault readable (Priority: P3)

**Goal**: No change-password UI ships, but the architecture guarantees a future change is a re-wrap of one key, never a re-encryption of data (FR-010)

**Independent Test**: Code/design review — confirm a single atomic `users` update (`passwordHash` + `kdfSalt` + `vaultKeyWrapped`) suffices for a password change and that no code path derives chord encryption from the password directly

- [X] T021 [US3] Encode the FR-010 guarantee in `backend/src/services/users.service.ts`: TSDoc on `UserDoc.vaultKeyWrapped`/`kdfSalt` documenting the re-wrap-only password-change contract (replace all three fields in one `updateOne` — atomic, vault data untouched) and confirm by inspection that chord values are encrypted only under the vault key (VaultContext uses VK, never masterKey) — add a matching TSDoc note in `frontend/src/vault/crypto.ts` (depends on T007, T012)

**Checkpoint**: All user stories complete

---

## Phase 6: Polish & Ship

**Purpose**: Cross-cutting sweeps, quality gates, deployment secrets

- [X] T022 [P] Security sweep: grep `backend/src` + `frontend/src` + `shared` for any remaining `password` field in network payload types/bodies (only client-side page state and TSDoc references may remain); verify no `console.*`/log statement in backend can emit envelope or plaintext value content; delete any now-dead server-side URL-normalization code left from feature 009
- [X] T023 Run quality gates from repo root: `npm run typecheck` (3 workspaces) + `npm run lint` + `npm run build --workspaces --if-present` — all green (quickstart §11)
- [ ] T024 Full manual quickstart walkthrough (quickstart §0–§10) including perceived-performance checks (sign-in KDF < ~1s extra, vault load/save no perceptible change — SC-003) and a responsive spot-check of login/register/home + unlock form at 360px/768px/1280px
- [ ] T025 Ship step (production): set `VAULT_ENC_KEY` and `SALT_DECOY_PEPPER` via `wrangler secret put` for prod AND `--env preview`; drop `users`, `sessions`, `chords` in the production database (verifier semantics changed — research Decision 6); confirm deployed register→save→reveal round-trip

---

## Dependencies

```text
Phase 1 (T001–T002)
  └─► Phase 2 Foundational (T003 ─► T004,T005,T006 …)
        T003 (shared types) ─► T004,T005,T006,T007,T015
        T004 (client crypto) ─► T009, T012
        T005 (server crypto) ─► T011
        T006 ─► T007 ─► T008          (auth chain)
        T009 (AuthContext base)  ─► T012, T017
        └─► Phase 3 US1 (MVP): T010 ─► T011; T012 ─► T013,T014; T015; T016 last
        └─► Phase 4 US2: T017 ─► T018; T019 anytime; T020 last (needs US1's T012 for T018)
        └─► Phase 5 US3: T021 (after T007, T012)
              └─► Phase 6: T022,T023 ─► T024 ─► T025
```

- **Same-file chains (must be sequential)**: `AuthContext.tsx` T009 → T017; `VaultContext.tsx` T012 → T018 wiring; `users.service.ts` T007 → T021; `tokens.css` touched only by T014/T018 (coordinate if parallel).
- **US2 note**: T018's masked-while-locked display builds on T012's boundary, so finish US1's T012 before T018 (T017/T019 are independent of US1).

## Parallel Execution Examples

- **After T002**: T003 alone first (types gate everything), then **T004 ∥ T005 ∥ T006** (three different files).
- **Start of US1**: **T010 ∥ T013 ∥ T015** (schema, dialog, api types — different files), while T011 waits on T010 and T012 waits on T009.
- **US2**: **T019 ∥ T017** (different files).
- **Polish**: **T022 ∥ T023**.

## Implementation Strategy

1. **MVP = Phase 1 + Phase 2 + Phase 3 (US1)** — after T016 the core promise (no readable secrets on the wire or at rest) is demonstrably true, with unlock working implicitly via login.
2. **Increment 2 = US2** — hardens the unlock lifecycle (logout clearing, locked-vault refresh UX, no-enumeration salt flow verification).
3. **Increment 3 = US3** — one documentation/inspection task locking in the FR-010 guarantee.
4. **Ship** — gates, full walkthrough, secrets + data drop in production (T025 is the only destructive/production-touching task; do it last, deliberately).
