---
description: "Task list for Username-Based Login Validation"
---

# Tasks: Username-Based Login Validation

**Input**: Design documents from `/specs/004-username-login-validation/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml), [quickstart.md](./quickstart.md)

**Tests**: Per the project Constitution (Principle II) and project instructions, **no unit-test tasks** are generated. Verification is TypeScript strict + ESLint/Prettier + the manual quickstart walkthrough (this is a critical auth flow, so verification tasks are included but not automated).

**Organization**: Tasks are grouped by user story. This is an **in-place modification** of the feature-002 auth slice (email → username, password 12-min → 3–10); no new dependencies, endpoints, collections, or config.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1, US2, US3 (maps to the user stories in spec.md)
- Every task includes an exact file path

## Path Conventions

Web-app monorepo: `backend/src/`, `frontend/src/`, `shared/types/` at the repository root (per plan.md Structure Decision).

---

## Phase 1: Setup (Shared Prerequisites)

**Purpose**: Confirm a clean starting point and prepare the dev database. No scaffolding — this feature edits an existing project.

- [X] T001 [P] Confirm a green baseline by running `npm run typecheck` and `npm run lint` from the repository root; note any pre-existing issues before editing.
- [ ] T002 Dev database prep (development only): in the `vii_pass` database, drop the legacy unique index `email_1` and remove stale email-based users (e.g. `db.users.drop()` in mongosh), per [quickstart.md](./quickstart.md) §2. **Why it blocks testing**: the old unique `email_1` index makes every new username-only account have a missing (null) `email`, so the 2nd registration would fail with a duplicate-key error until the index is dropped.

**Checkpoint**: Baseline is green and the dev DB will accept the new `username` unique index.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared identity contract and data layer that every user story compiles and depends on. These are compile-critical and cannot be partially applied.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Update the shared public contract in shared/types/index.ts: rename `PublicUser.email` to `username` and update its doc-comment to describe the alphanumeric, unique, lowercased login identifier (replaces the email field). This cascades to both the API and SPA (single source of truth). [data-model.md](./data-model.md) "Shared type changes".
- [X] T004 Rewrite the data layer in backend/src/services/users.service.ts to be username-based (depends on T003): rename `UserDoc.email` → `username`; swap the unique index in `getUsers` from `{ email: 1 }` to `{ username: 1 }`; update `toPublicUser` to project `username`; update `createUser` (input `{ username, displayName, password }`, stored `doc.username`, inline return, and the duplicate-key error to `409` code `username_taken` with message "This username is already taken."); update `verifyCredentials` (parameter + `findOne({ username })`); refresh the TSDoc comments (FR-005, FR-006, FR-011). This single file is shared by registration, login, and the session/me path, so it is edited as one coherent, compiling unit.

**Checkpoint**: Shared type + persistence layer speak "username". User story work can now begin.

---

## Phase 3: User Story 1 - Register with a username instead of an email (Priority: P1) 🎯 MVP

**Goal**: A visitor creates an account with a **username** (alphanumeric, ≥3 chars) and a **3–10 character** password — no email anywhere — and is signed in and taken to the home page, where the corner menu shows their username.

**Independent Test**: On the registration page, submit a unique alphanumeric username and a 3–10 char password; confirm the account is created (password hashed only), no email was requested, the user reaches the home page, and the user menu shows the username.

### Implementation for User Story 1

- [X] T005 [P] [US1] Replace the email rule with a username rule in backend/src/schemas/auth.schema.ts: define a `usernameField` (`z.string().trim()` → `.min(3)` → `.max(30)` → `.regex(/^[A-Za-z0-9]+$/, 'Username must use letters and numbers only.')` → `.toLowerCase()`), use it in `registerSchema`, and change the `password` rule from `min(12)`/`max(200)` to `min(3, 'Password must be at least 3 characters.')`/`max(10, 'Password must be 10 characters or fewer.')`; update the file header comment (FR-003, FR-004, FR-007). [research.md](./research.md) Decisions 2 & 3.
- [X] T006 [P] [US1] Rename the CSS selector `.user-menu__email` to `.user-menu__username` in frontend/src/styles/tokens.css (cosmetic; keep the same declarations).
- [X] T007 [P] [US1] Update the identity line in frontend/src/components/UserMenu.tsx to render `user.username` with className `user-menu__username` (was `user.email` / `user-menu__email`) (FR-013).
- [X] T008 [US1] Update `register` in frontend/src/auth/AuthContext.tsx: rename the first parameter `email` → `username`, send `{ username, displayName, password }` in the `POST /api/auth/register` body, and update the JSDoc (the `login` change is handled in US2).
- [X] T009 [US1] Convert the Email field to a Username field in frontend/src/pages/RegisterPage.tsx (depends on T008): replace the `email` state with `username`; change the input to `type="text"`, `autoComplete="username"`, `id="register-username"`, label "Username"; pass `username` to `register(...)`; change the password constant/guard/hint from a 12-char minimum to the 3–10 range (hint "Use 3 to 10 characters."); update the component TSDoc (still US2→US1 reference fix). (FR-008)

**Checkpoint**: Registration works end-to-end with a username and a 3–10 password; the home page and user menu show the account with no email present. MVP is demonstrable.

---

## Phase 4: User Story 2 - Sign in with a username (Priority: P2)

**Goal**: An existing user signs in with their **username** (not email) and password; wrong credentials return a single generic, non-enumerating error.

**Independent Test**: With an account created under US1, sign in with the correct username + password and reach the home page; submit an unknown username or wrong password and confirm the same generic "Incorrect username or password." error with no session created.

### Implementation for User Story 2

- [X] T010 [US2] Add the login username rule to backend/src/schemas/auth.schema.ts (depends on T005): change `loginSchema.email` to `username` using a lenient rule (`z.string().trim().min(1, 'Username is required.').toLowerCase()`) — deliberately **no** format/length check so bad usernames fail as generic invalid credentials; update the login comment (FR-012). [research.md](./research.md) Decision 3.
- [X] T011 [US2] Update the login route in backend/src/routes/auth.ts (depends on T004, T010): destructure `{ username, password }` from the parsed body, call `verifyCredentials(c.env, username, password)`, and change the invalid-credentials message to "Incorrect username or password."; also fix the stale "Duplicate emails…" TSDoc on the register handler to say "usernames" (FR-012).
- [X] T012 [US2] Update `login` in frontend/src/auth/AuthContext.tsx (same file as T008, sequential): rename the first parameter `email` → `username`, send `{ username, password }` in the `POST /api/auth/login` body, and update the JSDoc.
- [X] T013 [US2] Convert the Email field to a Username field in frontend/src/pages/LoginPage.tsx (depends on T012): replace the `email` state with `username`; change the input to `type="text"`, `autoComplete="username"`, `id="login-username"`, label "Username"; pass `username` to `login(...)`; update the component TSDoc.

**Checkpoint**: Both registration (US1) and sign-in (US2) work independently with usernames; login failures stay generic.

---

## Phase 5: User Story 3 - Guided validation and rejection of invalid input (Priority: P3)

**Goal**: Invalid registration input is rejected with clear, accessible, inline feedback and never creates an invalid or duplicate account — usernames too short, containing special characters, or already taken; passwords too short or too long.

**Independent Test**: On the registration page, submit each invalid class (username <3, username with a special char, an already-registered username incl. a case variant, password <3, password >10) and confirm each is rejected with a specific accessible message and no account is created; confirm the server also rejects them (400 / 409).

### Implementation for User Story 3

- [X] T014 [US3] Add accessible inline validation to frontend/src/pages/RegisterPage.tsx (same file as T009, sequential): validate the username as it changes — non-empty, length ≥3, and `/^[A-Za-z0-9]+$/` — surfacing specific messages ("Username must be at least 3 characters.", "Use letters and numbers only.") via a hint element with `aria-describedby` and `aria-invalid`; extend the existing password handling to message both too-short (<3) and too-long (>10); block submission and show the message when any rule fails so no request is sent for invalid input (FR-009, FR-010). Mirrors the server rules from T005.
- [ ] T015 [US3] Verify server-side enforcement (no code; validation task) against [quickstart.md](./quickstart.md) §4.2–4.3 and [contracts/openapi.yaml](./contracts/openapi.yaml): registration with a too-short/non-alphanumeric username or an out-of-range password returns `400`; a duplicate username (including a case-only variant such as `Alice01` vs `alice01`) returns `409 username_taken`; no account is created in any case (FR-004, FR-005, FR-006, FR-007, FR-010).

**Checkpoint**: All three stories are independently functional; invalid input is both blocked in the UI and rejected by the API with correct, non-leaky messages.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and the release quality gate across all stories.

- [ ] T016 [P] Run the full [quickstart.md](./quickstart.md) §4 walkthrough (register → username/password validation → sign in → user menu shows username → reload persists session) and confirm every "Expected" holds.
- [X] T017 [P] SC-004 residual-email check: search backend/src, frontend/src, and shared/types for any remaining `email` reference in the auth flow and confirm none remain in the registration or sign-in experience (email fully removed from the login identity).
- [X] T018 Release gate: run `npm run typecheck`, `npm run lint`, and `npm run build` from the repository root and confirm all pass clean (Constitution Quality Gates; no lint errors, strict TypeScript green, SPA builds).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T002 must be done before any manual registration test in a dev DB that already has the `email_1` index.
- **Foundational (Phase 2)**: T003 → T004. Depends on Setup. **BLOCKS all user stories.**
- **User Stories (Phases 3–5)**: All depend on Foundational (T003, T004). US1 (P1) is the MVP; US2 and US3 build on US1's shared files (auth.schema.ts, AuthContext.tsx, RegisterPage.tsx) and are sequenced accordingly below.
- **Polish (Phase 6)**: Depends on all targeted user stories being complete.

### Key Cross-Story File Couplings (why some tasks are sequential, not parallel)

- backend/src/schemas/auth.schema.ts: T005 (US1 register) → T010 (US2 login).
- frontend/src/auth/AuthContext.tsx: T008 (US1 register) → T012 (US2 login).
- frontend/src/pages/RegisterPage.tsx: T009 (US1 field/password) → T014 (US3 inline validation).
- backend/src/services/users.service.ts: fully handled in T004 (foundational); not touched again by stories.

### Within Each User Story

- Models/contracts before services before endpoints before UI.
- US1: T005/T006/T007 [P] → T008 → T009.
- US2: T010 → T011 (backend) and T012 → T013 (frontend).
- US3: T014 (UI) then T015 (verification).

### Parallel Opportunities

- Setup: T001 [P] (T002 is a DB action, run any time before testing).
- US1: T005 (backend schema), T006 (CSS), T007 (UserMenu) are all [P] — different files with no interdependencies; then T008 → T009.
- Polish: T016 and T017 are [P]; T018 is the final gate.
- US1 backend (T005) and US2 backend (T010, T011) cannot both start in parallel because they share auth.schema.ts — complete US1's schema edit first.

---

## Parallel Example: User Story 1

```text
# After Foundational (T003, T004), launch these US1 tasks together (different files):
Task T005: "Replace email rule with username rule in backend/src/schemas/auth.schema.ts"
Task T006: "Rename .user-menu__email → .user-menu__username in frontend/src/styles/tokens.css"
Task T007: "Render user.username in frontend/src/components/UserMenu.tsx"

# Then, sequentially (shared file / dependency):
Task T008: "Update register() in frontend/src/auth/AuthContext.tsx"
Task T009: "Convert Email field to Username field in frontend/src/pages/RegisterPage.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup (T001–T002).
2. Complete Phase 2: Foundational (T003–T004) — **blocks everything**.
3. Complete Phase 3: User Story 1 (T005–T009).
4. **STOP and VALIDATE**: register with a username + 3–10 password, land on home, see username in the menu.
5. Demo the MVP.

### Incremental Delivery

1. Setup + Foundational → identity layer is username-based.
2. Add US1 → test → demo (register with username — MVP!).
3. Add US2 → test → demo (sign in with username).
4. Add US3 → test → demo (invalid input is guided and rejected).
5. Polish → run quickstart + release gate.

### Story Independence

- US1 is fully testable alone (registration + authenticated home + menu).
- US2 adds sign-in; testable with an account from US1.
- US3 hardens the register form's validation UX and verifies server rejection; testable against the US1 form.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- [Story] label maps each task to its user story for traceability.
- No unit-test tasks (Constitution Principle II); T015–T018 are manual/gate verifications for this critical auth flow.
- **Documented security deviation**: the 3–10 password policy is weaker than the prior 12-char minimum and below OWASP guidance for a password manager — implemented as explicitly requested and recorded in [plan.md](./plan.md) Complexity Tracking and [research.md](./research.md) Decision 3.
- Commit after each task or logical group; keep the codebase compiling between phases.
