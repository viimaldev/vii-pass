---
description: "Task list for SVG background placeholders"
---

# Tasks: SVG Background Placeholders

**Input**: Design documents from `/specs/005-svg-backgrounds/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/background-assets.md](./contracts/background-assets.md), [quickstart.md](./quickstart.md)

**Tests**: Per the project Constitution (Principle II) no unit tests are generated. This feature has
**no security-critical flow** (no auth/crypto/vault), so no integration/e2e tests are added either.
Verification is TypeScript strict + ESLint/Prettier + `vite build` + the manual
[quickstart.md](./quickstart.md) walkthrough.

**Organization**: Tasks are grouped by user story. This is a **CSS-only, frontend-only** feature; all
paths are under `frontend/`.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 (Setup, Foundational, and Polish tasks carry no story label)

## ⚠️ Shared-file coupling (read before parallelizing)

The reusable mechanism lives entirely in **one file**, `frontend/src/styles/tokens.css`, which is
edited by Foundational (T002), US1 (T006, T007), US2 (T011, T012), and US3 (T013). Tasks that edit
`tokens.css` are therefore **never `[P]` with each other** and must be serialized even across
stories. Each user story is still independently **testable** (it adds a verifiable visual increment),
but the `tokens.css` edits cannot be applied simultaneously. New SVG files and the two page
components are independent and safely parallel.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the single, well-known asset location.

- [X] T001 Create the `frontend/public/backgrounds/` directory as the single home for all decorative
  background assets (FR-004). No Vite config change is required — `public/` is served verbatim at the
  site root, giving assets stable, unhashed `/backgrounds/*` URLs (research Decision 1).

**Checkpoint**: Asset folder exists and is ready to receive SVG placeholders + README.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared `.page-bg` mechanism and full-height shell — required before ANY background
can render. **⚠️ No user story work can begin until this phase is complete.**

- [X] T002 Add the reusable `.page-bg` base class to `frontend/src/styles/tokens.css` with:
  `background-color: var(--page-bg-fallback, var(--color-surface))` (FR-011 load-failure fallback),
  `background-image: var(--page-bg-image, none)`, `background-repeat: no-repeat`,
  `background-position: center top`, `background-size: cover` (contracts §B.1; research Decision 2).
- [X] T003 [P] Update `<main>` in `frontend/src/components/Layout.tsx` to add Bootstrap
  `d-flex flex-column` so a `flex-grow-1` `.page-bg` wrapper fills the remaining viewport height
  below the header (research Decision 7).

**Checkpoint**: The `.page-bg` base rule exists and the shell can host a full-height background
wrapper. User stories can now begin (serializing `tokens.css` edits).

---

## Phase 3: User Story 1 - Branded backgrounds on the login and home pages (Priority: P1) 🎯 MVP

**Goal**: A decorative background appears behind the login and home page content on desktop/tablet,
without reducing legibility or interfering with interaction.

**Independent Test**: Load `/login` and the home page — each shows a background behind its card; all
text, fields, and buttons remain readable and usable; the background never intercepts clicks or focus.

### Implementation for User Story 1

- [X] T004 [P] [US1] Create placeholder `frontend/public/backgrounds/login-desktop.svg` — landscape
  `viewBox="0 0 1600 1000"`, subtle abstract shapes in the brand palette (primary `#0b5cad` +
  light `#f4f6f8` tints), low visual weight, static (no `<script>`/`<animate>`), self-contained,
  a few KB (contracts §A.3; research Decision 6).
- [X] T005 [P] [US1] Create placeholder `frontend/public/backgrounds/home-desktop.svg` — landscape
  `viewBox="0 0 1600 1000"`, same brand palette and low visual weight, static and self-contained
  (contracts §A.3; research Decision 6).
- [X] T006 [US1] Add the `.page-bg--login` modifier to `frontend/src/styles/tokens.css` setting
  `--page-bg-image: url('/backgrounds/login-desktop.svg')` (desktop variable only in this story)
  (contracts §B.3). Edits `tokens.css` — serialize after T002.
- [X] T007 [US1] Add the `.page-bg--home` modifier to `frontend/src/styles/tokens.css` setting
  `--page-bg-image: url('/backgrounds/home-desktop.svg')` (contracts §B.3). Edits `tokens.css` —
  serialize after T006.
- [X] T008 [P] [US1] Wrap the existing `.container` in `frontend/src/pages/LoginPage.tsx` with
  `<div className="page-bg page-bg--login flex-grow-1"> … </div>` (contracts §B.4).
- [X] T009 [P] [US1] Wrap the existing `.container` in `frontend/src/pages/HomePage.tsx` with
  `<div className="page-bg page-bg--home flex-grow-1"> … </div>` (contracts §B.4).

**Checkpoint**: Backgrounds are visible behind login and home at desktop/tablet widths; content is
legible and fully interactive. MVP deliverable — demoable on its own.

---

## Phase 4: User Story 2 - Backgrounds adapt to mobile screens (Priority: P2)

**Goal**: On phones the background is appropriately sized — login swaps to a dedicated mobile SVG,
home cover-crops its desktop SVG — with no distortion and no horizontal scrolling.

**Independent Test**: View login and home at ~320px, tablet, and desktop. Each renders correctly with
no distortion, no clipping of content, and no horizontal scrollbar. At ≤575px login requests
`login-mobile.svg`; home requests only `home-desktop.svg` (cropped).

### Implementation for User Story 2

- [X] T010 [P] [US2] Create placeholder `frontend/public/backgrounds/login-mobile.svg` — portrait
  `viewBox="0 0 720 1280"`, brand palette, low visual weight, static and self-contained
  (alternate-file mobile strategy; contracts §A.3; research Decision 3).
- [X] T011 [US2] Add the phone media query to `frontend/src/styles/tokens.css`:
  `@media (max-width: 575.98px) { .page-bg { background-image: var(--page-bg-image-mobile, var(--page-bg-image, none)); } }`
  (Bootstrap `sm` boundary; contracts §B.1; research Decision 3). Edits `tokens.css` — serialize
  after T007.
- [X] T012 [US2] Extend the `.page-bg--login` rule in `frontend/src/styles/tokens.css` to also set
  `--page-bg-image-mobile: url('/backgrounds/login-mobile.svg')`; deliberately leave `.page-bg--home`
  with **no** mobile variable so it cover-crops the desktop SVG on phones (contracts §B.3; research
  Decision 3). Edits `tokens.css` — serialize after T011.

**Checkpoint**: Login shows the mobile SVG ≤575px; home gracefully cover-crops its desktop SVG; no
distortion or horizontal scroll from ~320px through desktop. US1 + US2 both work independently.

---

## Phase 5: User Story 3 - Reusable, easily replaceable placeholders (Priority: P3)

**Goal**: Placeholders swap out via a single file with zero code change, the treatment is reusable on
future containers through a documented mechanism, and backgrounds degrade gracefully.

**Independent Test**: Replace a placeholder file (same filename) → the page updates with no code or
layout change. Apply `page-bg`/`page-bg--*` to a new sample container → it gets a background using
only the documented mechanism. Print preview and forced-colors mode drop the decorative art.

### Implementation for User Story 3

- [X] T013 [US3] Add graceful-degradation rules to `frontend/src/styles/tokens.css`:
  `@media print { .page-bg { background-image: none; } }` and
  `@media (forced-colors: active) { .page-bg { background-image: none; } }` (decorative-only;
  contracts §B.1; research Decision 5). Edits `tokens.css` — serialize after T012.
- [X] T014 [P] [US3] Create `frontend/public/backgrounds/README.md` documenting: the single-folder
  convention (FR-004), the `<surface>-<variant>.svg` naming, the SVG content requirements
  (static/self-contained/brand palette/size budget), how to **replace** placeholder art (overwrite
  the same filename → zero code change, FR-003), and the three ways to **reuse** the treatment on a
  new container (reuse a modifier, add a `.page-bg--<name>`, or set `--page-bg-image` inline)
  (contracts §A and §B.5).

**Checkpoint**: File swap updates the page with no code change; a new container can reuse the
mechanism from the documented classes; print/forced-colors drop the art; the load-failure fallback
color (from T002) is confirmed. All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the whole feature against the quality gates and success criteria.

- [X] T015 [P] Run the quality gates from the repo root — `npm run typecheck`, `npm run lint`, and
  `npm run build --workspaces --if-present` — and confirm all pass and the frontend build copies
  `dist/backgrounds/*` (plan Testing; quickstart §7).
- [ ] T016 Execute the manual walkthrough in [quickstart.md](./quickstart.md) at ~320px, tablet, and
  desktop widths — verify backgrounds (US1), responsiveness + both mobile strategies (US2), drop-in
  replacement + new-container reuse (US3), graceful degradation (load-failure fallback, print,
  forced-colors), and accessibility (no extra focus stops, not present in the accessibility tree)
  (SC-001 … SC-007).
  - **Verified (automated / browser, against `vite preview`):** login desktop background renders
    subtly with the card fully legible (US1); at 360px the background swaps to `login-mobile.svg`
    with `background-size: cover` and **no horizontal scroll** (US2, SC-001); the background is
    **not** present in the accessibility tree (decorative-only, FR-009); the built
    `dist/backgrounds/*` assets keep stable unhashed URLs, confirming drop-in replacement (US3).
  - **Remaining developer spot-check (needs a running backend / manual browser tooling):**
    authenticated **home** page visual, deliberate **load-failure** fallback colour, **print**
    preview, and **forced-colors** (high-contrast) rendering.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks all user stories.**
- **User Stories (Phase 3–5)**: All depend on Foundational. Recommended **sequentially by priority
  (P1 → P2 → P3)** for this feature because they share `tokens.css` (see coupling note).
- **Polish (Phase 6)**: Depends on all targeted user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational. No dependency on US2/US3.
- **US2 (P2)**: Depends on Foundational; its `tokens.css` edits (T011, T012) build on US1's
  `.page-bg--login` rule (T006), so US2 follows US1 on that file. Independently testable.
- **US3 (P3)**: Depends on Foundational; its `tokens.css` edit (T013) serializes after US2's edits.
  README (T014) is fully independent. Independently testable.

### Critical shared-file chain (must be serialized, in order)

`tokens.css`: **T002 → T006 → T007 → T011 → T012 → T013**

### Within Each User Story

- New SVG assets (different files) are parallel; `tokens.css` edits are sequential.
- Page wrappers (`LoginPage.tsx`, `HomePage.tsx`) are parallel with each other and with SVG creation.

### Parallel Opportunities

- **Foundational**: T003 (Layout.tsx) runs parallel to T002 (tokens.css).
- **US1**: T004, T005 (SVGs) and T008, T009 (pages) can all run in parallel; T006 then T007 are the
  serialized `tokens.css` edits.
- **US2**: T010 (mobile SVG) runs parallel to everything; T011 then T012 serialize on `tokens.css`.
- **US3**: T014 (README) runs parallel to T013 (`tokens.css`).
- **Polish**: T015 (gates) can run while preparing the T016 manual pass.

---

## Parallel Example: User Story 1

```bash
# The independent files for US1 can be created together:
Task: "Create frontend/public/backgrounds/login-desktop.svg"     # T004
Task: "Create frontend/public/backgrounds/home-desktop.svg"       # T005
Task: "Wrap .container in frontend/src/pages/LoginPage.tsx"        # T008
Task: "Wrap .container in frontend/src/pages/HomePage.tsx"         # T009

# Then serialize the two tokens.css modifier edits:
Task: "Add .page-bg--login to frontend/src/styles/tokens.css"     # T006
Task: "Add .page-bg--home to frontend/src/styles/tokens.css"      # T007 (after T006)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001).
2. Complete Phase 2: Foundational (T002, T003) — CRITICAL, blocks all stories.
3. Complete Phase 3: User Story 1 (T004–T009).
4. **STOP and VALIDATE**: backgrounds visible and legible on login + home at desktop/tablet.
5. Deploy/demo if ready — this is a complete, shippable increment.

### Incremental Delivery

1. Setup + Foundational → mechanism ready.
2. US1 → backgrounds on login + home (MVP) → demo.
3. US2 → mobile responsiveness (mobile SVG + cover-crop) → demo.
4. US3 → replaceability + reuse docs + degradation → demo.
5. Polish → gates green + manual quickstart pass.

### Notes

- [P] = different files, no dependencies. `tokens.css` tasks are intentionally never [P].
- Story labels map each task to its user story for traceability.
- This feature adds **no dependencies, no backend/shared changes, and no security surface**.
- Commit after each task or logical group.
