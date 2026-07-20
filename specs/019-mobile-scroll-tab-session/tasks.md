# Tasks: Mobile Single-Scroll Layout & Tab-Scoped Sessions

**Input**: Design documents from `specs/019-mobile-scroll-tab-session/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (session-lifecycle.md, mobile-layout.md), quickstart.md

**Tests**: Per the project Constitution (Principle II), NO unit-test tasks. Session lifecycle is a critical auth flow, so each story ends with a manual browser-verification task tied to the quickstart — allowed, never blocking CI.

**Organization**: Tasks are grouped by user story. US1 (CSS layout) is fully independent. US2 (session ends on last-tab close) is independently testable because without the US3 responder every probe times out — the fail-safe path. US3 layers tab adoption on top of US2's plumbing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1, US2, US3 (spec.md priorities P1, P2, P3)

## Path Conventions

Web-app monorepo (plan.md): `backend/src/`, `frontend/src/`, `shared/` (UNTOUCHED this feature).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization

*(none — existing workspaces, zero new dependencies, no env/schema changes)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

*(none — US1 is pure CSS; US2/US3 prerequisites are story-scoped and live in their phases)*

**Checkpoint**: User story implementation can begin immediately.

---

## Phase 3: User Story 1 - Single scroll region on mobile (Priority: P1) 🎯 MVP

**Goal**: On mobile, only the chord container scrolls — no second page-level scrollbar, no white band below the app content. Desktop/tablet and auth-page behavior unchanged.

**Independent Test**: Open the vault at 320–575px wide with more entries than fit; confirm only `.chord-scroll` scrolls, `document.scrollingElement` has no overflow, and no white area appears at any scroll position (contracts/mobile-layout.md verification matrix).

### Implementation for User Story 1

- [X] T001 [US1] In frontend/src/styles/tokens.css, fix the `.app-shell` viewport sizing: keep `height: 100vh;` and add `height: 100dvh;` immediately after it (fallback pattern, research Decision 1), and add an `overscroll-behavior-y: none` guard on the shell so mobile rubber-banding cannot chain to the page (contracts/mobile-layout.md CSS requirements)
- [X] T002 [US1] In frontend/src/styles/tokens.css, lock the page scroller on the vault surface ONLY: give `.app-main` `overflow: hidden` when it hosts the vault page (preferred: `.app-main:has(.vault-page)`; alternative: a modifier class added in frontend/src/components/Layout.tsx or frontend/src/pages/HomePage.tsx — behavior is the contract). Auth pages MUST keep the existing `.app-main { overflow-y: auto }` page-scroll fallback. Update the adjacent CSS comment block to describe the new rules (research Decision 2)
- [X] T003 [US1] Browser-verify the full matrix from contracts/mobile-layout.md and quickstart.md §2: 320×568 portrait (many + few entries, `scrollHeight === clientHeight` on `document.scrollingElement`, scroll to end shows no white band), 568×320 landscape, keyboard-open dialog focus, 768/1280 regression vs main, login page 320×480 still page-scrolls (exemption), dark theme shows dark background at every edge

**Checkpoint**: US1 fully functional — mobile vault has exactly one scroll region; deliverable as MVP.

---

## Phase 4: User Story 2 - Session ends when the tab is closed (Priority: P2)

**Goal**: Closing the last app tab without signing out kills the session: the next visit shows sign-in, the stale server session record is revoked, and the persisted vault key is cleared. Refresh/in-tab navigation never ends the session.

**Independent Test**: Sign in, refresh (still signed in), close the tab, reopen the app → sign-in page, `POST /api/auth/logout` fired during bootstrap, `session` cookie gone, IndexedDB vault-key record cleared (quickstart.md §3). Independently testable WITHOUT US3: no responder exists yet, so every probe times out — the fail-safe path (every new tab requires sign-in) is US2's own guarantee.

### Implementation for User Story 2

- [X] T004 [P] [US2] In backend/src/services/sessions.service.ts, change `setSessionCookie` to OMIT `maxAge` (browser-session cookie — dies with the browser; contracts/session-lifecycle.md §A). Keep HttpOnly/Secure/SameSite=Lax/path/domain unchanged; remove the now-unused `parsePositiveInt` maxAge computation from this function; update the TSDoc to explain the browser-session choice and that server-side idle/absolute TTLs still bound validity. This is the ONLY backend change of the feature
- [X] T005 [P] [US2] Create frontend/src/auth/tabLease.ts implementing the contract module surface (contracts/session-lifecycle.md §B): `hasLease()`, `grantLease()`, `releaseLease()` over `sessionStorage` key `vii-pass:tab-lease` = `'1'` (all try/catch — blocked storage degrades to "no lease", fails safe); `probeForLiveTab()` posting `{type:'who-is-alive'}` on `BroadcastChannel` `'vii-pass:tabs'` and resolving true on the first `{type:'alive'}` or false at the 200ms deadline / when BroadcastChannel is unavailable (always closes its channel); `startLeaseResponder(predicate)` answering `alive` to probes only while `predicate()` is true, returning a stop/cleanup function. No secrets ever stored or broadcast; full TSDoc
- [X] T006 [US2] In frontend/src/auth/AuthContext.tsx, run the bootstrap decision table BEFORE `GET /api/auth/me` (contracts/session-lifecycle.md §B, depends on T005): lease present → resume via `/me` as today (FR-007); no lease → `await probeForLiveTab()`; peer answered → `grantLease()` then resume (adoption branch — exercised once US3's responder ships); silence → fire-and-forget `POST /api/auth/logout` (errors ignored; harmless no-op on true first visits), `await clearVaultKey()`, and finish signed-out WITHOUT calling `/me` and without flashing protected UI (the existing `loading` state covers the ≤200ms handshake)
- [X] T007 [US2] In frontend/src/auth/AuthContext.tsx, add lease maintenance (same file — after T006): `grantLease()` on successful `login` and `register`; `releaseLease()` in `logout` and in the 401 unauthorized handler (alongside the existing `clearVaultKey()` calls)
- [X] T008 [US2] Browser-verify quickstart.md §3: sign in → F5 keeps session and unlocked vault; close tab → new tab shows sign-in with `POST /api/auth/logout` in Network, `session` cookie absent, IndexedDB `vii-pass-vault` record cleared; optional DB check that the old session document is deleted; full browser close → reopen requires sign-in (browser-session cookie died)

**Checkpoint**: US2 fully functional — abandoned sessions die on the next visit; refresh still resumes.

---

## Phase 5: User Story 3 - Additional tabs share the active session (Priority: P3)

**Goal**: While a signed-in tab is open, a second tab adopts the same session without re-authentication; closing one tab keeps the session alive in the other; sign-out in any tab ends it everywhere.

**Independent Test**: With US2 in place, sign in in tab A, open tab B → signed in immediately (no credential prompt, no `/logout` in Network); close A → B keeps working; close both → next visit requires sign-in (quickstart.md §4).

### Implementation for User Story 3

- [X] T009 [US3] In frontend/src/auth/AuthContext.tsx, wire `startLeaseResponder` (same file — after T007): start it in a provider effect with predicate "signed-in user present AND this tab holds the lease" (use the existing `userRef` pattern so the predicate is stable), and stop answering on sign-out/401/unmount via the returned cleanup. This activates T006's adoption branch: probes from new tabs now get answered (FR-008, FR-009)
- [X] T010 [US3] Browser-verify quickstart.md §4 and §5: tab B beside live tab A signs in instantly (Network shows only `/me` + `/vault`, no `/logout`); close A → B navigates/reveals/copies fine; refresh B → still signed in; close both → sign-in required; sign-out in A → B's next action hits 401 and shows the session-expired path (FR-010); degradation: with `BroadcastChannel` deleted before load, a new tab beside a live one requires sign-in (fails safe); incognito behaves like a fresh browser

**Checkpoint**: All user stories complete — tab-scoped sessions with multi-tab sharing.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Gates, scope guards, and the end-to-end pass

- [X] T011 Run quality gates and scope sweeps: `npm run typecheck` (3 workspaces) + `npm run lint` + `npm run build --workspaces --if-present` all green; `git diff shared/` is EMPTY; backend diff touches ONLY `setSessionCookie` in backend/src/services/sessions.service.ts (research Decision 5); grep frontend/src for `beforeunload|pagehide|sendBeacon` = 0 matches (rejected mechanisms stay out)
- [X] T012 Full quickstart.md walkthrough (§2–§6) end-to-end in one sitting, both themes, including the responsive matrix at 320/768/1280 and the multi-tab flows — final acceptance against spec.md SC-001…SC-006

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 & 2**: empty — start directly with any story.
- **US1 (Phase 3)**: independent of US2/US3 (different files: tokens.css ± a class hook).
- **US2 (Phase 4)**: independent of US1. T004 ∥ T005 (different tiers) → T006 → T007 (same file chain) → T008.
- **US3 (Phase 5)**: depends on US2 (T009 edits the same AuthContext.tsx after T007 and needs T005's responder API).
- **Polish (Phase 6)**: after all stories.

### Same-file chains (do NOT parallelize)

- frontend/src/styles/tokens.css: T001 → T002
- frontend/src/auth/AuthContext.tsx: T006 → T007 → T009

### Parallel opportunities

- **US1 and US2 can be implemented concurrently** (disjoint files).
- Within US2: T004 (backend cookie) ∥ T005 (tabLease.ts).
- Example: launch `T001+T002` (one dev, tokens.css) alongside `T004` and `T005` (backend + new module), then converge on T006.

---

## Implementation Strategy

### MVP first (US1 only)

1. T001 → T002 → T003: the visible mobile defect is fixed and shippable on its own (pure CSS, zero risk to sessions).

### Incremental delivery

1. **US1** — mobile single-scroll (MVP, CSS-only).
2. **US2** — browser-session cookie + lease + revoke-on-silence: the security guarantee lands and is independently testable (fail-safe: every new tab needs sign-in).
3. **US3** — responder wiring: multi-tab adoption switches on.
4. **Polish** — gates, scope sweeps, full quickstart.

Each checkpoint is a coherent, demonstrable increment; stopping after any story leaves the app consistent.
