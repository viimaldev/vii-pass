---
description: "Task list for User Authentication & Session Management"
---

# Tasks: User Authentication & Session Management

**Input**: Design documents from `specs/002-user-auth-session/`
**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml)

**Tests**: Per the project Constitution (Principle II) and project instructions, **unit tests are NOT generated**. Authentication is a critical security flow, so ONE optional, non-blocking integration check is included in Polish. It is never a prerequisite for "done".

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and delivered independently.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story a task serves (US1–US4). Setup/Foundational/Polish tasks have no story label.
- Every task includes an exact file path.

## Path Conventions

Web-app monorepo (from [plan.md](./plan.md)): `backend/src/`, `frontend/src/`, `shared/types/`. Paths below are repository-relative.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuration for the new auth model and removal of the demonstration use cases (FR-012).

- [X] T001 [P] Add non-secret session/hash config vars (`SESSION_IDLE_TTL_SECONDS=1800`, `SESSION_ABSOLUTE_TTL_SECONDS=86400`, `PBKDF2_ITERATIONS=600000`, and an unset-by-default `COOKIE_DOMAIN`) to `backend/wrangler.toml` `[vars]`, and document `MONGODB_URI` + these in `backend/.dev.vars.example`
- [X] T002 [P] Extend the typed `Bindings`/env accessors in `backend/src/env.ts` with the new session, cookie-domain, and PBKDF2 config (no secrets hardcoded)
- [X] T003 Remove demo backend modules: delete `backend/src/routes/records.ts`, `backend/src/routes/files.ts`, `backend/src/services/records.service.ts`, `backend/src/services/files.service.ts`, `backend/src/schemas/record.schema.ts`, `backend/src/schemas/file.schema.ts`, and `backend/src/lib/r2.ts` (`backend/src/index.ts` is rewired in T016)
- [X] T004 [P] Remove demo frontend modules: delete `frontend/src/pages/HealthPage.tsx`, `frontend/src/pages/RecordsPage.tsx`, `frontend/src/pages/FilesPage.tsx`, `frontend/src/components/RecordForm.tsx`, and `frontend/src/components/FileUpload.tsx` (`frontend/src/App.tsx` is rewired in T020)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared authentication backbone (types, hashing, sessions, middleware, routing shell) that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Update shared contract types in `shared/types/index.ts`: add `PublicUser { id, email, displayName }` and `AuthResponse { user }`; trim `HealthReport` to `{ status, components: { api, database }, timestamp }`; remove `StoredRecord`, `RecordListResponse`, `FileAssetMeta`
- [X] T006 [P] Implement PBKDF2-HMAC-SHA-256 password hashing/verification via Web Crypto (encoded `pbkdf2$sha256$<iter>$<salt>$<hash>`, per-user 16-byte salt, iterations from env) in `backend/src/lib/password.ts`
- [X] T007 [P] Implement session-token utilities (32-byte high-entropy random token generator + SHA-256 hashing) in `backend/src/lib/tokens.ts`
- [X] T008 [P] Create auth request schemas (Zod) in `backend/src/schemas/auth.schema.ts`: `registerSchema` (email, displayName 1–100, password min 12/max 200) and `loginSchema` (email, password), normalizing email to lowercase
- [X] T009 Update health schema + service to report `api` + `database` only (drop `storage`) in `backend/src/schemas/health.schema.ts` and `backend/src/services/health.service.ts`
- [X] T010 [P] Implement users service in `backend/src/services/users.service.ts`: `createUser` (hashes password), `findByEmail`, `verifyCredentials`, `failedLoginCount`/`lockedUntil` handling, and ensure the unique index on `users.email` (depends on T005, T006)
- [X] T011 [P] Implement sessions service in `backend/src/services/sessions.service.ts`: `createSession`, `validateSession` (sliding idle + absolute expiry, touch `lastActivityAt`), `revokeSession`, and `setSessionCookie`/`clearSessionCookie` helpers (HttpOnly+Secure+SameSite=Lax+domain+max-age); ensure unique index on `sessions.tokenHash`, index on `userId`, and TTL index on `expiresAt` (depends on T005, T007)
- [X] T012 Implement `requireSession` middleware in `backend/src/middleware/requireSession.ts`: read the session cookie, validate via the sessions service, attach the `PublicUser` to context, and respond `401` (generic no-session / `session_expired`) otherwise (depends on T011)
- [X] T013 [P] Update CORS middleware to allow credentials and the configured origins in `backend/src/middleware/cors.ts`
- [X] T014 [P] Update the central error handler to map failures to `400/401/403/409/429` with generic, non-leaky `ApiError` bodies in `backend/src/middleware/error.ts`
- [X] T015 Create the auth router with `GET /api/auth/me` (behind `requireSession`, returns `{ user }`) in `backend/src/routes/auth.ts` (depends on T012)
- [X] T016 Rework `backend/src/index.ts`: mount the auth router, apply `requireSession` to all protected routes, keep unauthenticated `/api/health`, and drop the removed records/files routers (depends on T003, T015)
- [X] T017 [P] Update the API client in `frontend/src/services/apiClient.ts`: base URL, `credentials: 'include'`, JSON handling, and central `401` handling (clear auth + redirect to `/login`)
- [X] T018 Create `AuthContext`/`AuthProvider` in `frontend/src/auth/AuthContext.tsx`: current-user state, bootstrap via `GET /api/auth/me` on load, `setUser`/`refresh`, and a loading state (depends on T017)
- [X] T019 Create `ProtectedRoute` in `frontend/src/components/ProtectedRoute.tsx`: redirect unauthenticated users to `/login`, render children when authenticated, handle the bootstrap loading state (depends on T018)
- [X] T020 Rework the routing shell: wrap the app in `AuthProvider` in `frontend/src/main.tsx` and define public `/login`, `/register` and protected `/` routes (removing demo routes) in `frontend/src/App.tsx` (depends on T018, T019)

**Checkpoint**: Auth backbone ready — user stories can now begin (in parallel if staffed).

---

## Phase 3: User Story 1 - Secure login (Priority: P1) 🎯 MVP

**Goal**: A registered user signs in against real accounts and reaches the home page; incorrect credentials are rejected with a single generic message and no session is created.

**Independent Test**: Seed a user in `users`; submit valid credentials on the login page → authenticated and on the home page; submit invalid credentials → generic error, no session created.

### Implementation for User Story 1

- [X] T021 [P] [US1] Add `POST /api/auth/login` to `backend/src/routes/auth.ts`: validate with `loginSchema`, verify credentials, refuse disabled accounts (`403`) and locked accounts (`429`), create a session, set the session cookie, return `200 { user }`; return a single generic `401` on any credential failure (depends on T010, T011, T014, T015)
- [X] T022 [US1] Add `login()` to `frontend/src/auth/AuthContext.tsx` (calls `POST /api/auth/login`, sets the user on success, surfaces a generic error on failure)
- [X] T023 [US1] Create `frontend/src/pages/LoginPage.tsx`: accessible email+password form, inline validation, generic error + loading states, submit → `login()`, redirect to `/` on success (depends on T020, T022)
- [X] T024 [P] [US1] Add reusable accessible auth-form styles (labels, focus ring, contrast — WCAG 2.1 AA) in `frontend/src/styles/tokens.css`

**Checkpoint**: US1 is independently functional — login works end to end (MVP).

---

## Phase 4: User Story 2 - Self-service registration (Priority: P2)

**Goal**: A new visitor creates an account (password stored hashed), is auto-signed-in, and reaches the home page; duplicate emails and invalid input are rejected with clear, accessible guidance.

**Independent Test**: Submit valid new-user details → account persisted with a hashed password and the user reaches the home page; re-submit the same email → rejected with no duplicate created.

### Implementation for User Story 2

- [X] T025 [P] [US2] Add `POST /api/auth/register` to `backend/src/routes/auth.ts`: validate with `registerSchema`, create the user (hashed password), map duplicate email to `409`, auto-create a session + set cookie, return `201 { user }` (depends on T010, T011, T015)
- [X] T026 [US2] Add `register()` to `frontend/src/auth/AuthContext.tsx` (calls `POST /api/auth/register`, sets the user, surfaces field-level and duplicate-email errors)
- [X] T027 [US2] Create `frontend/src/pages/RegisterPage.tsx`: accessible email + displayName + password form (min-length guidance), inline validation, duplicate/error states, submit → `register()`, redirect to `/` (depends on T020, T024, T026)
- [X] T028 [US2] Add navigation affordances between login and registration in `frontend/src/pages/LoginPage.tsx` and `frontend/src/pages/RegisterPage.tsx`

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Session-gated access with a welcome home page (Priority: P3)

**Goal**: The authenticated home page greets the user by name; every protected page/data request requires a valid session; a valid session survives reloads; an expired session routes the user back to login with a clear message.

**Independent Test**: While unauthenticated, open a protected page/request protected data directly → denied and redirected to login; while authenticated, the welcome page shows the correct name and a reload keeps the user signed in.

### Implementation for User Story 3

- [X] T029 [P] [US3] Create `frontend/src/pages/HomePage.tsx`: "Welcome, &lt;displayName&gt;" using the current user, with an accessible heading/landmark (depends on T020)
- [X] T030 [US3] Wire the protected `/` route to render `HomePage` inside `ProtectedRoute` in `frontend/src/App.tsx` (depends on T029)
- [X] T031 [US3] Implement session-expiry UX: on `401` from protected calls, redirect to `/login` with an accessible "session expired" message in `frontend/src/services/apiClient.ts` and `frontend/src/pages/LoginPage.tsx` (depends on T017, T023)
- [X] T032 [P] [US3] Confirm every non-public API route is behind `requireSession` (only `/api/health` and auth login/register are public) in `backend/src/index.ts` (depends on T016)

**Checkpoint**: All access is session-gated; the welcome home page is live and reload-persistent.

---

## Phase 6: User Story 4 - User menu and logout (Priority: P4)

**Goal**: An authenticated user sees a corner user menu showing who they are signed in as and a logout action; logging out ends the session so previously protected data can no longer be accessed.

**Independent Test**: While authenticated, open the corner user menu (shows identity + logout), choose logout → returned to login; attempt to reuse the prior session → denied.

### Implementation for User Story 4

- [X] T033 [P] [US4] Add `POST /api/auth/logout` to `backend/src/routes/auth.ts` (behind `requireSession`): revoke the server-side session, clear the cookie, return `204` (idempotent) (depends on T011, T015)
- [X] T034 [US4] Add `logout()` to `frontend/src/auth/AuthContext.tsx` (calls `POST /api/auth/logout`, clears the user, redirects to `/login`)
- [X] T035 [US4] Create `frontend/src/components/UserMenu.tsx`: corner menu showing the signed-in identity + a logout action, keyboard-accessible with focus management (depends on T034)
- [X] T036 [US4] Render `UserMenu` in the authenticated shell in `frontend/src/components/Layout.tsx` (depends on T035)
- [X] T037 [P] [US4] Add user-menu design-system styles (WCAG 2.1 AA) in `frontend/src/styles/tokens.css`

**Checkpoint**: The full authenticated experience is complete; logout invalidates the session.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Consistency, accessibility, and validation across all stories.

- [X] T038 [P] Ensure `backend/.dev.vars.example` and `frontend/.env.local.example` list every required variable and align references in `quickstart.md`
- [X] T039 [P] Accessibility pass across `frontend/src` (login, register, home, user menu): keyboard operability, focus order, contrast, and semantic labels to WCAG 2.1 AA (SC-008)
- [X] T040 [P] Verify consistent loading/empty/error states and generic, non-leaky messages across the auth flows in `frontend/src`
- [X] T041 Run `npm run lint`, `npm run typecheck`, and a Worker bundle check (`npx wrangler deploy --dry-run` in `backend/`); fix any issues across `backend/`, `frontend/`, and `shared/`
- [ ] T042 [P] (OPTIONAL, non-blocking) Add one lightweight integration check for the critical auth/session flow (register → login → `me` → logout → denied) per `specs/002-user-auth-session/quickstart.md`
- [ ] T043 Execute `specs/002-user-auth-session/quickstart.md` end to end (register → welcome home → reload persists → logout → post-logout denial; confirm demo routes return `404`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**.
- **User Stories (Phases 3–6)**: All depend on Foundational. Once it is done, stories can proceed in parallel or in priority order (P1 → P2 → P3 → P4).
- **Polish (Phase 7)**: Depends on the targeted user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Only Foundational. Delivers the MVP.
- **US2 (P2)**: Only Foundational. Independent of US1 (reuses auth-form styles from T024 if present, else self-contained).
- **US3 (P3)**: Only Foundational. The gating mechanism is foundational; this story delivers the gated home experience and expiry UX.
- **US4 (P4)**: Only Foundational. Independent; completes session control.

### Within Each User Story

- Backend route handler → AuthContext method → page/component → styles.
- Shared files edited by multiple stories (`backend/src/routes/auth.ts`, `frontend/src/auth/AuthContext.tsx`, `frontend/src/styles/tokens.css`) are edited sequentially across stories — do not run those specific tasks in parallel across stories.

### Parallel Opportunities

- Setup: T001, T002, T004 in parallel (T003 is independent backend cleanup).
- Foundational: T006, T007, T008 in parallel; then T010, T011 in parallel; T013, T014, T017 in parallel with the above.
- Once Foundational completes, the backend handler tasks (T021, T025, T033) and new-file UI tasks (T023, T027, T029, T035) can be parallelized across stories by different developers.

---

## Parallel Example: Foundational core libraries

```bash
# After T005 (shared types) lands, run the pure libraries together:
Task: "PBKDF2 hashing in backend/src/lib/password.ts"        # T006
Task: "Session-token utilities in backend/src/lib/tokens.ts"  # T007
Task: "Auth Zod schemas in backend/src/schemas/auth.schema.ts" # T008

# Then the two data services in parallel:
Task: "Users service in backend/src/services/users.service.ts"       # T010
Task: "Sessions service in backend/src/services/sessions.service.ts" # T011
```

## Parallel Example: Cross-story kickoff (after Foundational)

```bash
Developer A → US1: T021 (login route) + T023 (LoginPage)
Developer B → US2: T025 (register route) + T027 (RegisterPage)
Developer C → US3: T029 (HomePage) + T032 (route-gating check)
Developer D → US4: T033 (logout route) + T035 (UserMenu)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (**blocks all stories**).
3. Complete Phase 3: User Story 1 (login).
4. **STOP and VALIDATE**: seed a user, verify login → home and generic failure handling.
5. Deploy/demo the MVP.

### Incremental Delivery

1. Setup + Foundational → backbone ready.
2. US1 (login) → validate → demo (MVP).
3. US2 (registration) → validate → demo.
4. US3 (session-gated home) → validate → demo.
5. US4 (user menu + logout) → validate → demo.

Each story adds value without breaking the previous ones.

---

## Notes

- **No unit tests** (Constitution II). T042 is the only test-adjacent task and is optional/non-blocking.
- `[P]` = different files, no dependency on an incomplete task.
- `[Story]` labels map tasks to spec.md stories for traceability.
- Security invariants enforced throughout: passwords stored only as PBKDF2 hashes; sessions stored as `SHA-256(token)`; HttpOnly+Secure+SameSite=Lax cookies; generic login errors (no enumeration); throttling on repeated failures; secrets only in env.
- Commit after each task or logical group.
