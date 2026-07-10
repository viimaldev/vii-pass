# Tasks: UI Fixes & Polish

**Input**: Design documents from `/specs/007-ui-fixes-polish/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Per Constitution Principle II, no unit tests. Changes are presentation + one
non-crypto validation, so no integration tests are added. Verification is via
[quickstart.md](quickstart.md) at mobile (~320px) / tablet / desktop widths.

**Organization**: Tasks are grouped by user story (US1–US7 from spec.md) so each can be
implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

Web-app monorepo: `frontend/src/`, `backend/src/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the working tree and gates before edits.

- [X] T001 Confirm on branch `topic/vii-1008-ui-fixes-polish` and that `npm run lint` + typecheck pass baseline (repo root)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: One shared enabler used by multiple UI stories — the `VaultModal` header-action slot.

**⚠️ CRITICAL**: T002 blocks US5 (header delete). Other stories do not depend on it.

- [X] T002 Add an optional header-action slot to `VaultModal` (render an optional `headerActions` node in `.vault-modal__header`, right-aligned next to the title) in frontend/src/components/VaultModal.tsx

**Checkpoint**: Foundation ready — user stories can proceed.

---

## Phase 3: User Story 1 - Consistent branded page title (Priority: P1) 🎯 MVP

**Goal**: Every browser tab/window shows "Vii Pass".

**Independent Test**: Open login, signup, and home; tab title reads "Vii Pass" on each.

- [X] T003 [US1] Change `<title>` to `Vii Pass` (and align the `<meta name="description">` brand casing) in frontend/index.html

**Checkpoint**: US1 independently verifiable (quickstart §1).

---

## Phase 4: User Story 2 - Clean, branded authentication screens (Priority: P1)

**Goal**: No header on login/signup; a "Vii Pass" brand line atop each auth card.

**Independent Test**: Signed out, /login and /register show no header and a "Vii Pass" brand
line above the form (quickstart §2).

- [X] T004 [P] [US2] Add a "Vii Pass" brand line as the first element inside the auth card, above the "Sign in" heading, in frontend/src/pages/LoginPage.tsx
- [X] T005 [P] [US2] Add a "Vii Pass" brand line as the first element inside the auth card, above the "Sign up" heading, in frontend/src/pages/RegisterPage.tsx
- [X] T006 [US2] Verify no app header/navbar renders on the auth routes (confirm `Layout` is not applied to `/login` or `/register`; remove any header chrome if present) in frontend/src/App.tsx and frontend/src/pages/LoginPage.tsx, frontend/src/pages/RegisterPage.tsx
- [X] T007 [P] [US2] Add a `.auth-brand` style block (brand typography, spacing) using design tokens in frontend/src/styles/tokens.css

**Checkpoint**: US2 independently verifiable at ~320px / desktop (quickstart §2).

---

## Phase 5: User Story 3 - Translucent branded chrome over the background (Priority: P2)

**Goal**: Decorative background visible behind a ~40% translucent header; Add/Edit Chord
dialog uses a white ~40% translucent surface — foreground stays fully legible.

**Independent Test**: Signed in, background shows behind the translucent header; the chord
dialog surface is translucent while content is legible (quickstart §3).

- [X] T008 [US3] Apply the decorative `page-bg` behind the header and make the navbar surface ~40% translucent (background-color rgba/`color-mix`, keep text/controls opaque) in frontend/src/components/Layout.tsx
- [X] T009 [US3] Add token-driven CSS for the translucent header surface and the white ~40% translucent `.vault-modal` surface (surface fill only, content opaque; preserve WCAG AA) in frontend/src/styles/tokens.css

**Checkpoint**: US3 verifiable; confirm header/dialog text contrast remains AA (quickstart §3).

---

## Phase 6: User Story 4 - Fluid, space-filling chord layout (Priority: P2)

**Goal**: Chord cards min 350px, stretch to fill the row, no trailing empty space, no
fixed 450px.

**Independent Test**: Resize across widths; cards ≥350px, fill the row, wrap on mobile with
no horizontal scroll (quickstart §4).

- [X] T010 [US4] Replace the fixed-width branch with `grid-template-columns: repeat(auto-fill, minmax(min(350px, 100%), 1fr))` and remove the `min-width: 350px` media-query cap (450px) in the `.chord-grid` rules in frontend/src/styles/tokens.css

**Checkpoint**: US4 verifiable at ~320px / tablet / desktop (quickstart §4).

---

## Phase 7: User Story 5 - Inline delete with confirmation (Priority: P2)

**Goal**: Icon-only delete in the edit dialog header; deletion requires confirmation.

**Depends on**: T002 (VaultModal header-action slot).

**Independent Test**: Edit dialog shows a header icon-only delete; activating prompts a
confirmation; cancel keeps the chord, confirm deletes it (quickstart §5).

- [X] T011 [US5] Move the delete action from the footer to an icon-only button (with `aria-label`/`title`) passed into the `VaultModal` header slot, gating `onDelete` behind a confirmation step; keep it edit-mode only, in frontend/src/components/AddChordDialog.tsx
- [X] T012 [P] [US5] Add `.vault-modal__header` action + icon-button styles (touch target, focus-visible, hover) using design tokens in frontend/src/styles/tokens.css

**Checkpoint**: US5 verifiable incl. keyboard reachability (quickstart §5).

---

## Phase 8: User Story 6 - Bounded section titles with overflow handling (Priority: P3)

**Goal**: Section tabs 100–150px wide; overflow ellipsis + full-name tooltip.

**Independent Test**: Short and long section names render tabs between 100–150px; long names
truncate with ellipsis and show a tooltip on hover/focus (quickstart §6).

- [X] T013 [P] [US6] Add `min-width: 100px; max-width: 150px` plus `overflow/text-overflow: ellipsis` to the section tab label in the `.section-tab` rules in frontend/src/styles/tokens.css
- [X] T014 [US6] Set the native `title` attribute to the full section name on each tab (tooltip for truncated labels) in frontend/src/components/SectionTabs.tsx

**Checkpoint**: US6 verifiable (quickstart §6).

---

## Phase 9: User Story 7 - Prevent duplicate sections (Priority: P3)

**Goal**: Reject creating a section whose name duplicates an existing one (case-insensitive,
trimmed) with a clear message; no duplicate created.

**Independent Test**: Creating a second "Work" (or "work" / " Work ") is rejected with the
message and adds no tab (quickstart §7).

- [X] T015 [US7] In `createSection`, trim the name and reject when an existing section for the same `userId` matches case-insensitively — throw `AppError(409, 'section_exists', 'A section with that name already exists.')` before insert — in backend/src/services/sections.service.ts
- [X] T016 [US7] Surface the `409 section_exists` message inline in the create-section dialog, keeping it open with the entered value and adding no tab, in frontend/src/components/SectionDialog.tsx

**Checkpoint**: US7 verifiable against the contract (contracts/sections-create.md, quickstart §7).

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T017 Run `npm run lint` and typecheck; fix any errors (repo root)
- [X] T018 Execute the full [quickstart.md](quickstart.md) walkthrough at mobile (~320px), tablet, and desktop widths; confirm no console errors and AA contrast on translucent surfaces

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories.
- **T002 (foundational)** blocks **US5 (T011)** only.
- User stories are otherwise **independent** and can be done in any order:
  - US1 (T003), US2 (T004–T007), US3 (T008–T009), US4 (T010), US6 (T013–T014),
    US7 (T015–T016) have no cross-story dependencies.
- **Note**: Many tasks edit `frontend/src/styles/tokens.css` (T007, T009, T010, T012, T013).
  These are **not** `[P]` relative to each other — apply them sequentially to avoid conflicts,
  even though they belong to different stories. Tasks marked `[P]` touch distinct files.
- **Polish (Phase 10)** runs last.

## Parallel Execution Examples

- After Phase 2, start P1 stories together: **T003** (index.html) and **T004/T005**
  (Login/Register pages) are different files → parallelizable.
- US6 CSS (T013) and US6 component (T014) touch different files; T013 shares tokens.css with
  other CSS tasks so serialize the CSS edits, but T014 can run in parallel with any non-CSS task.
- US7 backend (T015) and frontend (T016) are different files → parallelizable.

## Implementation Strategy

- **MVP**: US1 + US2 (both P1) — brand the title and clean up the auth screens.
- **Increment 2 (P2)**: US3, US4, US5 — translucency, fluid grid, safe inline delete.
- **Increment 3 (P3)**: US6, US7 — section tab bounds and duplicate prevention.
- Verify each story against its quickstart section before moving on.

## Task Count Summary

- Total: **18 tasks**
- Setup: 1 · Foundational: 1 · US1: 1 · US2: 4 · US3: 2 · US4: 1 · US5: 2 · US6: 2 ·
  US7: 2 · Polish: 2
