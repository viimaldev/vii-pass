# Tasks: Dual Usernames with Roles & Security-Question Password Reset

**Input**: Design documents from `/specs/011-dual-user-roles/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-api.md, contracts/vault-authz.md, quickstart.md

**Tests**: Per the project Constitution (Principle II) no unit tests are generated. Each story ends with a manual verification task for its critical security flow (role enforcement, reset crypto round-trip), per quickstart.md.

**Organization**: Tasks are grouped by user story. US1 (registration) is the MVP; US2 (roles) and US3 (reset) build on the account shape but are independently verifiable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (user story phases only)

## Path Conventions

Web app (npm workspaces monorepo): `backend/src/`, `frontend/src/`, `shared/types/` — per plan.md Project Structure.

---

## Phase 1: Setup

**Purpose**: Clear legacy-shape data so the new account schema can't collide with old indexes/documents (research Decision 8; identity shape changed — no migration).

- [X] T001 Drop the dev/preview database collections `users`, `sessions`, `sections`, `chords` (and `resetAttempts` if present) in `vii_pass_preview` via an inline node `.mjs` script that reads `backend/.dev.vars` (same technique as features 004/010; no mongosh available). The old unique index `{username: 1}` dies with the collection — required before the new multikey index can be ensured.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contracts, crypto helpers, and the account/session reshape that every story sits on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Extend `shared/types/index.ts` per data-model.md "Shared types" deltas: add `UserRole` (`'admin' | 'normal'`), add `role: UserRole` to `PublicUser` (TSDoc: username = the name used for THIS session), add the `SECURITY_QUESTIONS` readonly const (5 fixed questions from research Decision 6 — first runtime export, id = array index), reshape `RegisterRequest` (adds `adminUsername`, `securityQuestionId`, `answerHash`, `recoverySalt`, `vaultKeyWrappedRecovery`), and add `ResetQuestionRequest/Response`, `ResetVerifyRequest/Response`, `ResetCompleteRequest`. `LoginRequest`/`AuthResponse`/`SaltResponse` shapes unchanged.
- [X] T003 [P] Add recovery-key derivation to `frontend/src/vault/crypto.ts` per contracts/auth-api.md "Client crypto contract": `normalizeSecurityAnswer(raw)` (trim → toLowerCase → collapse internal whitespace runs to single spaces) and `deriveRecoveryKeys(answerNormalized, recoverySaltB64)` reusing the existing PBKDF2-600k → HKDF pipeline with new info strings `vii-pass/recovery-auth` (→ `answerHash` b64url) and `vii-pass/recovery-wrap` (→ non-exported AES-256-GCM `recoveryWrapKey`). Reuse `wrapVaultKey`/`unwrapVaultKey` verbatim for the recovery envelope. TSDoc the FR-009 rationale (normalization pre-KDF = case/whitespace-insensitive comparison).
- [X] T004 Reshape the account document in `backend/src/services/users.service.ts` per data-model.md `users` table: `UserDoc` gains `logins: {username, role}[]`, `securityQuestionId`, `recoverySalt`, `securityAnswerVerifier`, `vaultKeyWrappedRecovery`, `resetTokenHash`, `resetTokenExpiresAt` and DROPS top-level `username`. Replace the `{username: 1}` index with the **unique multikey** `{'logins.username': 1}` (research Decision 1). Update helpers: `toPublicUser(doc, role)` resolves the session's username from `logins`, `findActivePublicUserById(env, id, role)`, `getSaltForUsername` queries `{'logins.username': u}` (decoy path unchanged), `getVaultKeyWrappedById` unchanged. Leave `createUser`/`verifyCredentials` compiling but story tasks (T008/T013) rework them.
- [X] T005 [P] Add role support to `backend/src/services/sessions.service.ts` per data-model.md sessions table: `SessionDoc.role`, `createSession(env, userId, role)`, `validateSession` returns `{ userId, role } | null`, and new `revokeAllSessionsForUser(env, userId)` (`deleteMany({userId})`, FR-012 — existing `{userId: 1}` index covers it).
- [X] T006 Update `backend/src/middleware/requireSession.ts` to consume `validateSession`'s `{userId, role}` and pass the role into `findActivePublicUserById(env, userId, role)` so `c.get('user')` carries the session role + session username (depends on T004, T005).

**Checkpoint**: Types + crypto + account/session plumbing compile; story implementation can begin.

---

## Phase 3: User Story 1 — Register an account with two usernames and a security question (Priority: P1) 🎯 MVP

**Goal**: Registration collects Admin Username, Username, Display Name, Password, security question (dropdown of 5) + answer; creates ONE account with two identities sharing one credential + recovery wrap; signs the user in as admin.

**Independent Test**: quickstart.md §3 — register with all six inputs, land signed-in with the vault visible; negative checks: identical usernames → 400, taken username (either role) → 409, missing question/answer → inline errors, network payload never contains the password or answer text.

### Implementation for User Story 1

- [X] T007 [US1] Rework `registerSchema` in `backend/src/schemas/auth.schema.ts` per data-model.md validation rules: `adminUsername` + `username` (existing `usernameField` rules), cross-field refine `adminUsername !== username` after normalization → 400 `usernames_identical` ("Admin username and username must be different."), `securityQuestionId` int 0–4, `answerHash` (b64url 43, same rule as `authHash`), `recoverySalt` (b64url 22), `vaultKeyWrappedRecovery` (`^v1\.wk\.` envelope regex, same as `vaultKeyWrapped`).
- [X] T008 [US1] Rework `createUser` in `backend/src/services/users.service.ts` (after T004): input = full new register payload; build `logins: [{username: adminUsername, role: 'admin'}, {username, role: 'normal'}]`; store one `passwordHash` (re-hash of `authHash`, unchanged pipeline) + `securityAnswerVerifier` (re-hash of `answerHash` via the same `hashPassword`); store `securityQuestionId`, `recoverySalt`, `vaultKeyWrapped`, `vaultKeyWrappedRecovery`, `resetTokenHash: null`, `resetTokenExpiresAt: null`. Duplicate-key (multikey) → 409 `username_taken` "This username is already taken." (never disclosing which name/role/account). Return `PublicUser` with `role: 'admin'`.
- [X] T009 [US1] Update `POST /api/auth/register` in `backend/src/routes/auth.ts`: parse the new schema, call the reworked `createUser`, create the session with `createSession(c.env, user.id, 'admin')`, respond 201 `{user (role admin), vaultKeyWrapped}` per contracts/auth-api.md.
- [X] T010 [US1] Update `register()` in `frontend/src/auth/AuthContext.tsx`: new signature `(adminUsername, username, displayName, password, securityQuestionId, securityAnswer)`; generate `kdfSalt` + vault key + password wrap as today, THEN `normalizeSecurityAnswer` + generate `recoverySalt` + `deriveRecoveryKeys` + second `wrapVaultKey` under the recovery wrap key; POST the full new payload; state handling unchanged (signed in as admin, vault key saved to IndexedDB).
- [X] T011 [US1] Rebuild the form in `frontend/src/pages/RegisterPage.tsx`: fields Admin Username, Username, Display Name, Password (existing 3–10 + username 3–30 alnum inline validation reused for BOTH username fields), `<select>` over `SECURITY_QUESTIONS` (required, placeholder option) and required Answer input; client-side check that the two usernames differ (case-insensitive) with an inline error; keep Bootstrap card/form pattern, `aria-invalid`/`aria-describedby` hints, and the existing unrecoverable-password notice updated to mention the security-question recovery. Verify layout at 320px (six fields + dropdown, touch-friendly).
- [X] T012 [US1] Verify US1 per quickstart.md §3 (browser against `npm run dev:node`): happy path signs in as admin with vault visible; identical usernames → inline + 400; second account reusing either name in either role → 409; missing question/answer blocked inline; register request body carries `authHash/kdfSalt/vaultKeyWrapped/securityQuestionId/answerHash/recoverySalt/vaultKeyWrappedRecovery` and never the password/answer; DB doc shows `logins` array + verifier fields (inline node .mjs inspect).

**Checkpoint**: US1 fully functional — dual-username accounts can be created and used (as admin).

---

## Phase 4: User Story 2 — Sign in with either username; normal role is view/copy-only (Priority: P2)

**Goal**: Login works with either username + shared password; the session carries the matched role; every mutating sections/chords route 403s for normal-role sessions; the UI omits mutation controls when read-only.

**Independent Test**: quickstart.md §4 — create data as admin, sign in as the normal username: same vault, reveal/copy work, zero mutation controls; every mutating route returns `403 role_forbidden` when hit directly with the normal-role cookie.

### Implementation for User Story 2

- [X] T013 [US2] Rework `verifyCredentials` in `backend/src/services/users.service.ts` (after T008): look up `{'logins.username': username}`, verify the single account `passwordHash`, and on success return `PublicUser` built with the MATCHED login's role + username (lockout/disabled handling unchanged, generic `invalid` for unknown name or wrong hash).
- [X] T014 [US2] Update `POST /api/auth/login` + `GET /api/auth/me` in `backend/src/routes/auth.ts` (after T009): login passes the matched role to `createSession(c.env, user.id, role)`; `me` already returns the role via the session-aware `requireSession` user — confirm both responses match contracts/auth-api.md.
- [X] T015 [P] [US2] Create `backend/src/middleware/requireAdmin.ts` (implemented as `requireAdmin` export co-located in `backend/src/middleware/requireSession.ts` — same contract): middleware that reads `c.get('user')` and throws `AppError(403, 'role_forbidden', "Your sign-in doesn't allow changes. Sign in with the admin username to make changes.")` unless `role === 'admin'`; TSDoc the FR-007 contract (runs after `requireSession`, before any body parsing).
- [X] T016 [US2] Mount `requireAdmin` on the mutating sections routes in `backend/src/routes/sections.ts` per the contracts/vault-authz.md matrix: `POST /`, `POST /reorder`, `PATCH /:sectionId`, `DELETE /:sectionId` — GET stays role-agnostic (the lazy "Mine" provisioning inside GET is exempt and MUST keep working for a normal-role first sign-in).
- [X] T017 [P] [US2] Mount `requireAdmin` on the mutating chord routes in `backend/src/routes/chords.ts`: `POST /:sectionId/chords`, `POST /:sectionId/chords/reorder` (sectionChordsRouter) and `PATCH /:chordId`, `DELETE /:chordId` (chordsRouter) — the two GETs stay role-agnostic.
- [X] T018 [P] [US2] Add read-only mode to `frontend/src/components/SectionTabs.tsx`: derive `readOnly = user.role !== 'admin'` from `useAuth()` (or accept it as a prop from HomePage — pick one pattern and use it for T019/T020 too); when read-only OMIT the trailing `+` add tab, the `‹›` move buttons, and any edit/delete affordances, and do not set `draggable`/DnD handlers. Tab selection keeps working. No layout gaps at 320px.
- [X] T019 [P] [US2] Add read-only mode to `frontend/src/components/ChordGrid.tsx`: when read-only OMIT the trailing add tile and do not attach DnD handlers; grid renders cards only.
- [X] T020 [P] [US2] Add read-only mode to `frontend/src/components/ChordCard.tsx`: when read-only OMIT the edit button and the `↑↓` move buttons; copy-link, reveal (eye), and copy-value stay identical to admin (US2 scenario 5). Header layout must not leave a dangling gap.
- [X] T021 [US2] Verify US2 per quickstart.md §4 + contracts/vault-authz.md verification: sign in with each username (same password) → identical vault content; normal session UI has zero mutation affordances (DOM-absent, not disabled); hit ALL 8 mutating routes directly with the normal-role cookie (HttpClient with `UseCookies=$false` + `TryAddWithoutValidation('Cookie',...)` — `Invoke-WebRequest -Headers` drops Cookie) → `403 role_forbidden` each, DB unchanged; admin session still succeeds on all of them (SC-002, SC-003).

**Checkpoint**: US1 + US2 — dual sign-in with enforced role split works end to end.

---

## Phase 5: User Story 3 — Reset a forgotten password via the security question (Priority: P3)

**Goal**: Admin username → question → correct answer → reset dialog → new password applies to both usernames, all sessions revoked, vault stays readable (same vault key, re-wrapped).

**Independent Test**: quickstart.md §5 — full reset round-trip with changed answer casing; old password dead for both names, new works for both, pre-reset chord still decrypts; normal/unknown names get indistinguishable decoys; 5 wrong answers → 429.

### Implementation for User Story 3

- [X] T022 [US3] Add the reset service layer in `backend/src/services/users.service.ts` (after T013), per research Decision 5 and data-model.md: (a) `resetAttempts` collection accessor with unique `{usernameKey: 1}` + TTL `{expiresAt: 1}` indexes; (b) `getResetQuestion(env, username)` → real `{questionId, recoverySalt}` for an active account's ADMIN login, else deterministic decoy (`firstByte(SHA-256(username + '\u0000q' + SALT_DECOY_PEPPER)) % 5` + domain-separated decoy salt reusing the existing decoy construction); (c) `verifyResetAnswer(env, username, answerHash)` → throttle check FIRST (5 fails → `lockedUntil` 15 min → 429 `too_many_attempts`, keyed by the TYPED lowercased name so unknown names throttle identically), verify against `securityAnswerVerifier` only for admin logins, on failure increment attempts + generic 401 `invalid_reset` ("That didn't match our records."), on success clear the attempts row, generate a one-time token via the existing `lib/tokens` helpers, store `resetTokenHash` + `resetTokenExpiresAt` (now + 10 min), and return `{resetToken, vaultKeyWrappedRecovery}`; (d) `completeReset(env, username, resetToken, newAuthHash, newKdfSalt, newVaultKeyWrapped)` → validate token hash + expiry (single-use), ATOMIC single `updateOne` replacing `passwordHash` (re-hash) + `kdfSalt` + `vaultKeyWrapped` + burning `resetTokenHash`/`resetTokenExpiresAt` — `vaultKeyWrappedRecovery` untouched (FR-011); generic 401 `invalid_reset` on any mismatch.
- [X] T023 [US3] Add reset schemas to `backend/src/schemas/auth.schema.ts` (after T007): `resetQuestionSchema` `{username}` (lenient like `loginSchema`), `resetVerifySchema` `{username, answerHash}`, `resetCompleteSchema` `{username, resetToken, newAuthHash, newKdfSalt, newVaultKeyWrapped}` — field rules per contracts/auth-api.md.
- [X] T024 [US3] Add the three public reset routes to `backend/src/routes/auth.ts` (after T014): `POST /reset/question` (always 200 after body validation), `POST /reset/verify` (200 token+blob / 401 / 429), `POST /reset/complete` (204, then `revokeAllSessionsForUser` — FR-012; no cookie set). Error precedence and response shapes exactly per contracts/auth-api.md.
- [X] T025 [US3] Create `frontend/src/pages/ResetPasswordPage.tsx`: 3-step flow — (1) admin username input → fetch question, render the `SECURITY_QUESTIONS[questionId]` text; (2) answer input → `normalizeSecurityAnswer` + `deriveRecoveryKeys(answer, recoverySalt)` → POST verify with `answerHash`; on success unwrap the vault key from `vaultKeyWrappedRecovery` locally; (3) reset dialog (existing VaultModal pattern or inline card step): new password (3–10, existing validation pattern) → generate fresh `kdfSalt`, `deriveKeys(newPassword, kdfSalt)`, re-wrap the SAME vault key, POST complete → success message → link to sign-in. Generic error message for 401s, distinct message for 429; focus moves to each step's first field; Bootstrap card pattern + tokens, works at 320px.
- [X] T026 [US3] Wire the entry point: add the public `/reset` route in `frontend/src/App.tsx` and a "Forgot password?" link on `frontend/src/pages/LoginPage.tsx` (near the register link, consistent `.auth-alt` pattern).
- [X] T027 [US3] Verify US3 per quickstart.md §5 (browser + direct requests): full happy path with different answer casing/whitespace → reset succeeds; old password 401 for BOTH usernames, new password works for BOTH; pre-reset chord reveals its original value (FR-011); active sessions elsewhere are dead (FR-012); normal username + unknown name at `/reset` → indistinguishable decoy question and generic verify failure (SC-005); 5 wrong answers (real AND unknown name) → 429; second `verify` invalidates the first token; expired/reused token → 401.

**Checkpoint**: All three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T028 Dead-code and consistency sweep: grep `backend/src` + `frontend/src` + `shared` for the old single-username register shape (no lingering `RegisterRequest` call sites without `adminUsername`, no top-level `UserDoc.username` references); confirm TSDoc on all new exports; then run the gates — `npm run typecheck`, `npm run lint`, `npm run build --workspaces --if-present` — all green.
- [ ] T029 Full quickstart.md walkthrough (§3–§6) against `npm run dev:node`, including the responsive/a11y spot-check at 320px/768px/desktop (register form, reset steps, read-only vault) — developer-manual.
- [ ] T030 PROD/preview ship (DESTRUCTIVE — developer-run, per quickstart.md §8): drop `users`, `sessions`, `sections`, `chords`, `resetAttempts` in each environment's DB, deploy (push to `main` / `workflow_dispatch` preview), re-register and smoke-test the three walkthroughs against the deployed URL.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: no dependencies — do first (old index/doc shapes block T004's new index).
- **Phase 2 (Foundational)**: T002 first (types gate everything); then T003/T004/T005 in parallel; T006 after T004+T005.
- **Phase 3 (US1)**: after Phase 2. Chain: T007 → (T008 after T004) → T009 → T010 → T011 → T012.
- **Phase 4 (US2)**: after US1's T008/T009 (same-file chains). T013 → T14; T015 anytime after T006; T016/T017 after T015; T018/T019/T020 parallel after T002; T021 last.
- **Phase 5 (US3)**: T022 after T013 (users.service chain); T023 after T007 (auth.schema chain); T024 after T014+T022+T023 (auth.ts chain); T025 after T003+T022–T024; T026 after T025; T027 last.
- **Phase 6 (Polish)**: after all stories; T030 strictly last.

### Same-file chains (never parallelize)

- `backend/src/services/users.service.ts`: T004 → T008 → T013 → T022
- `backend/src/routes/auth.ts`: T009 → T014 → T024
- `backend/src/schemas/auth.schema.ts`: T007 → T023
- `backend/src/services/sessions.service.ts`: T005 only
- `frontend/src/auth/AuthContext.tsx`: T010 only

### Parallel opportunities

- Foundational: T003 ∥ T004 ∥ T005 (three different files, after T002)
- US2: T015 ∥ (T018, T019, T020) — middleware and the three read-only components are all independent files; then T016 ∥ T017
- US3: T023 can run parallel with T022 (different files)

## Implementation Strategy

**MVP first**: Phases 1–3 (T001–T012) deliver a working dual-username registration signed in as admin — a complete, testable increment even before roles are enforced.

**Incremental delivery**: US2 next (the core behavioral value — enforced role split), then US3 (recovery). Each checkpoint leaves the app fully functional; stop after any phase and the branch is shippable (US3-less shipping keeps 010's "unrecoverable" caveat).

**Format validation**: ✅ All 30 tasks use `- [ ] T0NN [P?] [Story?] description + exact file path(s)`; story labels only in Phases 3–5; Setup/Foundational/Polish carry none.
