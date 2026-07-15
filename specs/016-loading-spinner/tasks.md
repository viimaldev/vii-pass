# Tasks: Loading Spinner Indicator

**Input**: Design documents from `/specs/016-loading-spinner/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/spinner-ui.md, quickstart.md

**Tests**: Per the project Constitution (Principle II), NO unit-test tasks. Verification is manual per quickstart.md.

**Organization**: Tasks are grouped by user story. FRONTEND-ONLY feature — `backend/` and `shared/` MUST remain untouched throughout.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Web app monorepo: all work under `frontend/src/` (see plan.md Project Structure).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: None required — no new dependencies, no project scaffolding, no data changes. The existing frontend workspace is the complete environment.

*(No tasks.)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The reusable spinner component + its CSS — every user story consumes these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 Create the reusable `Spinner` component in `frontend/src/components/Spinner.tsx`: inline SVG ring of 10 round dots on a circle with graduated per-dot opacity (1.0 at head → ~0.15 at tail), `fill="currentColor"`, `aria-hidden="true"`, `focusable="false"`; prop `size?: 'page' | 'button'` (default `'button'`) mapping to CSS classes `spinner spinner--page` / `spinner spinner--button`; stateless with TSDoc (contract §1–2, research Decision 1/3).
- [X] T002 Add the spinner CSS block to `frontend/src/styles/tokens.css` (end of file, near the `.page-bg` guards): one `@keyframes spinner-rotate` full-turn rotation applied to `.spinner` (pick `steps(10, end)` for the discrete-tick feel per research Decision 2); `.spinner--page` ≈ 48px square; `.spinner--button` = `1em` square, `vertical-align: -0.125em`, margin-right ≈ 0.5em (spinner sits BEFORE the label); `.page-spinner` flex wrapper class (flex-grow, centers both axes for viewport centering); `@media (prefers-reduced-motion: reduce)` → `animation: none`; `@media print` → `display: none` (contract §2/§4/§6, research Decision 2/5).

**Checkpoint**: `Spinner` renders in isolation; user stories can start.

---

## Phase 3: User Story 1 - See a spinner while a page is loading (Priority: P1) 🎯 MVP

**Goal**: Both page-level waits show the dotted spinner centered in the visible viewport; visible loading text is gone but stays announced to assistive tech.

**Independent Test**: On a throttled network, refresh while signed in — the session-bootstrap wait and the vault-load wait each show the spinner centered both axes, with no visible "Loading…" text and no horizontal scroll (quickstart §1–2).

### Implementation for User Story 1

- [X] T003 [P] [US1] Replace the session-bootstrap loading text in `frontend/src/components/ProtectedRoute.tsx`: render a `.page-spinner` wrapper containing the existing `role="status" aria-live="polite"` element with `<Spinner size="page" />` and the "Loading…" text moved into a `<span className="visually-hidden">` (contract §3/§5). Keep the redirect/children logic untouched.
- [X] T004 [P] [US1] Replace the vault-load text in `frontend/src/pages/HomePage.tsx`: the `loading` branch renders a `.page-spinner` wrapper (filling the page's flex column so the spinner centers in the visible window) with `role="status"`, `<Spinner size="page" />`, and visually-hidden "Loading your sections…" text; REMOVE the dead `chordsLoading` ternary (hardcoded `false` since feature 015) so "Loading entries…" text is gone — `ChordGrid` renders directly when not loading (contract §3, research Decision 4). Keep error banner and unlock form rendering above/independent of the spinner.
- [X] T005 [US1] Verify US1 in the browser per quickstart §1–2 + §6: throttled refresh shows the centered spinner for session bootstrap then vault load; spinner centered at 320/768/1280px with no horizontal scroll; `role="status"` + visually-hidden text present in DevTools; no layout jump when content renders.

**Checkpoint**: All page-level waits use the centered spinner — MVP delivered.

---

## Phase 4: User Story 2 - See a spinner inside busy buttons (Priority: P2)

**Goal**: Every busy-capable button shows the small spinner immediately before its existing progress text, with unchanged button height and disabled behavior.

**Independent Test**: On a throttled network, trigger each busy button and see `⟳ <busy text>`, disabled state, unchanged height, spinner gone on completion/error (quickstart §3).

### Implementation for User Story 2

- [X] T006 [P] [US2] Prepend `<Spinner />` to the busy label in `frontend/src/pages/LoginPage.tsx` (`{submitting ? <><Spinner /> Signing in…</> : 'Sign in'}` pattern).
- [X] T007 [P] [US2] Prepend `<Spinner />` to the busy label in `frontend/src/pages/RegisterPage.tsx` ("Creating account…").
- [X] T008 [P] [US2] Prepend `<Spinner />` to the unlock busy label in `frontend/src/pages/HomePage.tsx` UnlockVaultForm ("Unlocking…") — coordinate with T004 (same file; do T004 first if run within one story-at-a-time flow, otherwise sequence within this phase).
- [X] T009 [P] [US2] Prepend `<Spinner />` to BOTH busy labels in `frontend/src/components/AddChordDialog.tsx` ("Saving…" and "Deleting…").
- [X] T010 [P] [US2] Prepend `<Spinner />` to BOTH busy labels in `frontend/src/components/SectionDialog.tsx` ("Saving…" and "Deleting…").
- [X] T011 [P] [US2] Prepend `<Spinner />` to ALL THREE step busy labels in `frontend/src/pages/ResetPasswordPage.tsx` ("Checking…", "Verifying…", "Resetting…").
- [X] T012 [P] [US2] Prepend `<Spinner />` to the sign-out busy label in `frontend/src/components/UserMenu.tsx` ("Signing out…").
- [X] T013 [US2] Verify US2 in the browser per quickstart §3: each of the 7 surfaces shows spinner + busy text while pending, button stays disabled, height identical to idle state, error path (wrong login password) clears the spinner and shows the normal error; at 320px no busy label wraps to a second line.

**Checkpoint**: All button busy states carry the spinner; US1 unaffected.

---

## Phase 5: User Story 3 - Loading feedback stays accessible and comfortable (Priority: P3)

**Goal**: Confirm (and fix if needed) that the spinner upgrade preserves accessibility and comfort guarantees: announcements, reduced motion, theme visibility, degradation.

**Independent Test**: Screen-reader announcement still fires on page waits; reduced-motion emulation stops rotation but keeps the ring visible; spinner visible in both themes and forced-colors (quickstart §5).

### Implementation for User Story 3

- [X] T014 [US3] Audit + verify accessibility and degradation per quickstart §5: (a) every former announcement surface still announces (page waits via `role="status"` + visually-hidden text; buttons keep visible text/disabled/`aria-busy` where it existed); (b) SVG is `aria-hidden` + `focusable="false"` everywhere; (c) DevTools emulation `prefers-reduced-motion: reduce` → no rotation, static graduated ring visible; (d) light + dark themes → spinner clearly visible (currentColor); (e) `forced-colors: active` → spinner perceivable; (f) print preview → spinner hidden. Fix any gaps in `frontend/src/components/Spinner.tsx` / `frontend/src/styles/tokens.css` only.

**Checkpoint**: All three stories complete and independently verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Consistency sweep, dead-code cleanup, quality gates, full walkthrough.

- [X] T015 [P] Dead-style sweep in `frontend/src/styles/tokens.css`: if `.route-status` is now unused after T003 (grep `route-status` across `frontend/src`), remove the rule; confirm no other orphaned loading-text styles remain; confirm `loading.svg` is NOT referenced by any runtime code (reference-only per plan).
- [X] T016 Run quality gates from repo root: `npm run typecheck` (3 workspaces) + `npm run lint` + `npm run build --workspaces --if-present` all green; verify `git diff --stat backend/ shared/` is EMPTY (frontend-only feature, plan Constraints).
- [X] T017 Full quickstart walkthrough (`specs/016-loading-spinner/quickstart.md` §1–§7): both page waits, all 7 button surfaces, side-by-side motif consistency (SC-003), themes/reduced-motion/forced-colors/print, 320/768/1280 responsive, normal-role identical rendering.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (Foundational)**: No prerequisites — start immediately. BLOCKS all user stories.
- **US1 (Phase 3)**: Depends on T001+T002 only.
- **US2 (Phase 4)**: Depends on T001+T002 only — independent of US1 EXCEPT T008 shares `HomePage.tsx` with T004 (sequence those two edits).
- **US3 (Phase 5)**: Verification/audit over the output of US1+US2 — run after both.
- **Polish (Phase 6)**: After all user stories.

### Same-file chains (order within the file)

- `frontend/src/styles/tokens.css`: T002 → T015
- `frontend/src/pages/HomePage.tsx`: T004 (US1) → T008 (US2)
- `frontend/src/components/Spinner.tsx`: T001 → (T014 fixes if any)

### Parallel opportunities

- T003 ∥ T004 (different files) once Phase 2 is done.
- T006, T007, T009, T010, T011, T012 all ∥ (six different files); T008 joins after T004.
- T015 ∥ T014.

```text
Phase 2:  T001 → T002
             │
   ┌─────────┴──────────┐
US1: T003 ∥ T004 → T005  │
US2: T006 ∥ T007 ∥ T009 ∥ T010 ∥ T011 ∥ T012 (+T008 after T004) → T013
   └─────────┬──────────┘
US3: T014
Polish: T015 ∥ (after T014) → T016 → T017
```

## Implementation Strategy

**MVP first (US1 only)**: T001 → T002 → T003 ∥ T004 → T005 delivers the visible headline change (centered page spinner) as a shippable increment.

**Incremental delivery**: Add US2 (seven mechanical one-line-per-label edits, mostly parallel) → US3 audit → polish gates. Each story checkpoint is independently testable per its quickstart sections.
