# Tasks: App Logo Branding

**Input**: Design documents from `/specs/018-logo-branding/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/logo-ui.md, quickstart.md

**Tests**: Per the project Constitution (Principle II), NO unit-test tasks are generated. Verification is manual via quickstart.md. This feature touches no security-critical flow, so no integration checks either.

**Organization**: Tasks are grouped by user story so each story is an independently testable increment. Feature is frontend-only; backend/ and shared/ are untouched.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Web app layout per plan.md — all changes under `frontend/`:
`frontend/index.html`, `frontend/src/pages/`, `frontend/src/components/`, `frontend/src/styles/tokens.css`, assets at `frontend/public/logo/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm assets and establish the shared logo styling both in-page stories depend on

- [X] T001 Verify logo assets exist and are the expected files: `frontend/public/logo/full_logo.png` (1468×372, wide mark + "PASS" wordmark) and `frontend/public/logo/logo.png` (497×538 square mark); confirm the Vite dev server serves them at `/logo/full_logo.png` and `/logo/logo.png` (files must NOT be modified — FR-008)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared CSS that both US1 and US2 consume; must land before the component swaps

- [X] T002 Add the shared logo styling block to `frontend/src/styles/tokens.css` (place it near the existing auth-screen styles): (a) `.auth-logo { display: block; width: min(220px, 60%); height: auto; margin: 0 0 var(--space-2); }` — width-capped, aspect-ratio preserving, keeping the retired `.auth-brand` bottom rhythm (contract C1.3); (b) header logo sizing `.app-navbar .navbar-brand img { height: 32px; width: auto; display: block; }` (contract C2.2); (c) dark-theme treatment `[data-bs-theme='dark'] .auth-logo, [data-bs-theme='dark'] .app-navbar .navbar-brand img { filter: invert(1) hue-rotate(180deg); }` (contract C5.1, research Decision 4). Do NOT remove `.auth-brand` yet (pages still render it until Phase 3)

**Checkpoint**: Shared classes exist — US1, US2, US3 can now proceed (in parallel if desired)

---

## Phase 3: User Story 1 - Full logo on the authentication pages (Priority: P1) 🎯 MVP

**Goal**: The Sign in, Create account, and Reset password cards show the full logo image in place of the plain-text "Vii Pass" brand line.

**Independent Test**: Open `/login`, `/register`, `/reset` signed out — each card top shows the identical full logo (no text brand), scaled correctly at 320px and desktop widths, with alt text "Vii Pass" (quickstart §1).

### Implementation for User Story 1

- [X] T003 [P] [US1] In `frontend/src/pages/LoginPage.tsx`, replace `<p className="auth-brand">Vii Pass</p>` with `<img className="auth-logo" src="/logo/full_logo.png" alt="Vii Pass" width={1468} height={372} />` (exact markup per contract C1.1; same slot above the `h1`)
- [X] T004 [P] [US1] In `frontend/src/pages/RegisterPage.tsx`, make the identical replacement of `<p className="auth-brand">Vii Pass</p>` with the same `<img className="auth-logo" …>` markup (contract C1.2 — byte-identical across pages)
- [X] T005 [P] [US1] In `frontend/src/pages/ResetPasswordPage.tsx`, make the identical replacement of `<p className="auth-brand">Vii Pass</p>` with the same `<img className="auth-logo" …>` markup (contract C1.2)
- [X] T006 [US1] Verify US1 per quickstart §1 and §4–5: logo identical on all three cards; 320px viewport — no overflow/distortion/horizontal scroll (C1.4); dark theme — logo legible via CSS filter; blocked image — alt text "Vii Pass" renders and layout holds; a11y pane shows accessible name "Vii Pass"

**Checkpoint**: US1 fully functional — auth pages branded; MVP deliverable

---

## Phase 4: User Story 2 - Full logo on the home page (Priority: P2)

**Goal**: The signed-in home header shows the full logo in the brand slot, preserving the existing brand-link behavior and header layout.

**Independent Test**: Sign in — header's left slot shows the logo (32px tall) instead of text; clicking it still navigates home and refreshes the vault; header layout unchanged at mobile and desktop widths (quickstart §2).

### Implementation for User Story 2

- [X] T007 [US2] In `frontend/src/components/Layout.tsx`, replace the text child "Vii Pass" of the `<Link to="/" className="navbar-brand fw-bold flex-shrink-0 me-0" onClick={refreshVault}>` with `<img src="/logo/full_logo.png" alt="Vii Pass" width={1468} height={372} />` — keep the Link's `to`, `onClick`, className, and position untouched (contract C2.1); the image is height-capped at 32px by the T002 CSS (C2.2)
- [X] T008 [US2] Verify US2 per quickstart §2 and §4–5: header height/tab row/account-menu alignment pixel-unchanged; logo click navigates home + refreshes vault; ~320–420px — no collision or header wrap (C2.3); dark theme legible; Link accessible name is "Vii Pass" via image alt (C4.3); keyboard focus order unchanged

**Checkpoint**: US2 fully functional — signed-in experience branded

---

## Phase 5: User Story 3 - Logo in the browser tab (Priority: P3)

**Goal**: Browser tabs and bookmarks show the Vii Pass mark as the favicon; title text unchanged.

**Independent Test**: Hard-reload any page — tab shows the "V" mark beside the title "Vii Pass"; bookmarking shows the same icon (quickstart §3).

### Implementation for User Story 3

- [X] T009 [US3] In `frontend/index.html` `<head>`, add exactly one line — `<link rel="icon" type="image/png" href="/logo/logo.png" />` — after the `<title>` element; `<title>Vii Pass</title>`, the meta tags, and the theme bootstrap script must remain byte-for-byte unchanged (contract C3)
- [X] T010 [US3] Verify US3 per quickstart §3: hard reload shows the mark in the tab next to the unchanged "Vii Pass" title; bookmark shows the icon; confirm `/logo/logo.png` returns 200 in the dev server

**Checkpoint**: All three user stories complete

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Dead-code removal and final regression sweep per contract C6 and quickstart §6

- [X] T011 Remove the now-dead `.auth-brand` CSS rule (and its comment) from `frontend/src/styles/tokens.css`, then grep `frontend/src` for `auth-brand` to confirm zero remaining references (contract C6.2, research Decision 6)
- [X] T012 Run `npm run lint` at the repo root (zero errors) and build the frontend (`npm run build` in `frontend/`) confirming `dist/logo/full_logo.png` and `dist/logo/logo.png` are emitted
- [X] T013 Full regression sweep per quickstart §6: sign in, create account, reset password, add/edit/delete a chord — all flows behave exactly as before (FR-010, SC-005); confirm `backend/` and `shared/` have zero diffs

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on T001 — blocks all user stories
- **Phase 3 (US1)**: Depends on Phase 2 (needs `.auth-logo` CSS)
- **Phase 4 (US2)**: Depends on Phase 2 (needs navbar img CSS) — independent of US1
- **Phase 5 (US3)**: Depends only on T001 (favicon needs no CSS) — independent of US1/US2
- **Phase 6 (Polish)**: T011 depends on US1 completion (last `.auth-brand` consumer removed); T012–T013 depend on all stories

### User Story Dependencies

- **US1 (P1)**: Foundation only — no other story
- **US2 (P2)**: Foundation only — independent of US1
- **US3 (P3)**: Setup only — independent of US1/US2

### Within Each User Story

- Component swaps before that story's verification task
- T003/T004/T005 are [P] — three different page files, no ordering

### Parallel Opportunities

```text
# After Phase 2, launch all three stories in parallel:
US1: T003 + T004 + T005 together (different files), then T006
US2: T007, then T008
US3: T009, then T010

# Within US1:
T003 (LoginPage.tsx) ║ T004 (RegisterPage.tsx) ║ T005 (ResetPasswordPage.tsx)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (T001) → Phase 2 (T002)
2. Phase 3: T003–T006 — auth pages branded
3. **STOP & VALIDATE**: quickstart §1 — deployable MVP (every visitor sees the logo at sign-in)

### Incremental Delivery

1. Setup + Foundational → US1 (auth pages) → validate → deliverable
2. US2 (home header) → validate → deliverable
3. US3 (favicon) → validate → deliverable
4. Polish (T011–T013) → dead CSS removed, lint/build/regression green

---

## Summary

- **Total tasks**: 13
- **Per story**: Setup 1 · Foundational 1 · US1 4 (T003–T006) · US2 2 (T007–T008) · US3 2 (T009–T010) · Polish 3
- **Parallel opportunities**: T003/T004/T005 within US1; US1 ∥ US2 ∥ US3 after Phase 2
- **Independent test criteria**: US1 = quickstart §1 (auth cards), US2 = quickstart §2 (header), US3 = quickstart §3 (favicon)
- **Suggested MVP scope**: Phases 1–3 (US1 only)
- **Format validation**: ✅ all tasks use `- [ ] Txxx [P?] [USx?] description + exact file path`; story labels only in US phases
