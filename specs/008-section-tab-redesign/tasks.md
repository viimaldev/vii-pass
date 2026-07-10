---
description: "Task list for Section Tab Visual Redesign"
---

# Tasks: Section Tab Visual Redesign

**Input**: Design documents from `/specs/008-section-tab-redesign/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/section-tab-ui.md](contracts/section-tab-ui.md)

**Tests**: Per the project Constitution (Principle II), unit tests are NOT generated. This is a presentation-only, non-security UI change; verification is manual/visual per [quickstart.md](quickstart.md).

**Organization**: Tasks are grouped by user story. This is a CSS/presentation-only feature; most work lands in one stylesheet block plus a minimal component tweak.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Web app: `frontend/src/` (this feature touches only the frontend presentation layer)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the working surfaces before styling

- [X] T001 Review current tab markup in [frontend/src/components/SectionTabs.tsx](../../frontend/src/components/SectionTabs.tsx) and the `.section-tabs` / `.section-tab*` rule block in [frontend/src/styles/tokens.css](../../frontend/src/styles/tokens.css); confirm classes/attributes match the DOM contract in [contracts/section-tab-ui.md](contracts/section-tab-ui.md)
- [X] T002 Open `specs/designs/tab.png` and note the target overlap direction, top-right corner rounding, and right-edge shadow to reproduce

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Prepare the stacking mechanism all visual tasks depend on

**⚠️ CRITICAL**: The base stacking order must exist before overlap can look correct

- [X] T003 In [frontend/src/components/SectionTabs.tsx](../../frontend/src/components/SectionTabs.tsx), pass a per-tab base stacking custom property (e.g. `style={{ ['--tab-z']: sections.length - index }}`) using the existing `sections.map` index, merged with the current `--section-color` inline style; no behavior change

**Checkpoint**: Component now supplies base stacking order → visual styling can begin

---

## Phase 3: User Story 1 - Overlapping tab visual style (Priority: P1) 🎯 MVP

**Goal**: Render tabs as overlapping angled panels matching `specs/designs/tab.png` — each tab behind the one to its right, top-right corner rounded only, right-edge shadow.

**Independent Test**: With 3+ sections, confirm overlap, top-right-only rounding, and right-edge shadow match the reference image.

- [X] T004 [US1] In [frontend/src/styles/tokens.css](../../frontend/src/styles/tokens.css) `.section-tab`, change `border-radius` to top-right only (`border-radius: 0 var(--radius) 0 0`)
- [X] T005 [US1] In [frontend/src/styles/tokens.css](../../frontend/src/styles/tokens.css) `.section-tab`, add overlap via negative left margin on tabs after the first (e.g. `.section-tab + .section-tab { margin-left: calc(-1 * var(--space-4)); }`) so each tab tucks behind its right-hand neighbor
- [X] T006 [US1] In [frontend/src/styles/tokens.css](../../frontend/src/styles/tokens.css) `.section-tab`, add a right-offset `box-shadow` (e.g. `4px 0 6px -2px rgba(0,0,0,0.25)`) so the shadow falls toward the right edge
- [X] T007 [US1] In [frontend/src/styles/tokens.css](../../frontend/src/styles/tokens.css) `.section-tab`, apply base `z-index: var(--tab-z)` (with `position: relative` if needed) so earlier tabs sit behind later ones; verify overlap direction against `specs/designs/tab.png`
- [X] T008 [US1] Ensure `.section-tab--add` in [frontend/src/styles/tokens.css](../../frontend/src/styles/tokens.css) stays visually consistent with the overlapping strip (corner shape / margin) and remains clearly the trailing add control
- [X] T009 [US1] Visually verify US1 acceptance (overlap, top-right rounding, right-edge shadow) side-by-side with `specs/designs/tab.png` per [quickstart.md](quickstart.md)

**Checkpoint**: Tab strip visually matches the reference layered look (MVP delivered)

---

## Phase 4: User Story 2 - Selected tab reads as "on top" (Priority: P2)

**Goal**: The selected tab layers in front of neighbors and stays fully legible.

**Independent Test**: Select each tab; the active one clearly rises in front regardless of position.

- [X] T010 [US2] In [frontend/src/styles/tokens.css](../../frontend/src/styles/tokens.css) `.section-tab.is-selected`, add an elevated fixed `z-index` (above all base `--tab-z` values) so the active tab sits in front; keep existing full-opacity + inset highlight
- [X] T011 [US2] Verify the selected tab's label and color remain distinguishable over every section color (contrast) and that selecting far-left and far-right tabs both layer correctly

---

## Phase 5: User Story 3 - Existing tab behaviors preserved (Priority: P2)

**Goal**: Confirm select, edit, reorder, add, and keyboard interactions still work after restyle.

**Independent Test**: Exercise each interaction and confirm no regression.

- [X] T012 [US3] In [frontend/src/components/SectionTabs.tsx](../../frontend/src/components/SectionTabs.tsx), confirm click/keyboard select, double-click edit, drag-reorder, and the "+" add control still function after the `--tab-z` change; adjust only if the overlap/z-index interferes with pointer hit-testing (e.g. ensure hovered/dragged tab raises above neighbors)
- [X] T013 [US3] In [frontend/src/styles/tokens.css](../../frontend/src/styles/tokens.css), ensure `.section-tab.is-dragging` (and optionally `:hover`) raises z-index so the dragged/hovered tab is fully clickable and no drop gap/artifact remains after reorder

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Responsiveness, accessibility, and lint

- [X] T014 [P] Verify responsive/mobile-first behavior at ~320px, tablet, and desktop widths: strip stays horizontally scrollable, labels truncate with ellipsis, and the overlap layout holds (FR-007) — [frontend/src/styles/tokens.css](../../frontend/src/styles/tokens.css)
- [X] T015 [P] Verify accessibility retained: tablist/tab roles, keyboard operability, `title` tooltip for truncated names, and legible label contrast over shadows/overlaps (FR-008)
- [X] T016 Run `npm run lint` in `frontend` and fix any issues so the change is lint-clean

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** must complete first (T003 provides `--tab-z`).
- **US1 (Phase 3)** is the MVP and depends on Phase 2.
- **US2 (Phase 4)** depends on US1 base stacking (T007).
- **US3 (Phase 5)** depends on US1/US2 z-index rules being in place.
- **Polish (Phase 6)** runs last; T014 and T015 are parallelizable.

### Story completion order

1. US1 (P1) — overlapping visual style (MVP)
2. US2 (P2) — selected on top
3. US3 (P2) — behaviors preserved

## Parallel Execution Examples

- Within Phase 3, T004/T005/T006 edit the same rule block sequentially (same file) — not parallel; T007 depends on T003.
- In Phase 6, T014 and T015 (both verification) can be done in parallel: `[P]`.

## Implementation Strategy

- **MVP** = Phase 1 → Phase 2 → Phase 3 (US1). This alone delivers the requested reference look.
- Then layer US2 (selected-on-top) and US3 (behavior verification), finishing with responsive/a11y/lint polish.

## Task Summary

- **Total tasks**: 16
- **US1 (P1, MVP)**: 6 tasks (T004–T009)
- **US2 (P2)**: 2 tasks (T010–T011)
- **US3 (P2)**: 2 tasks (T012–T013)
- **Setup/Foundational**: 3 tasks (T001–T003)
- **Polish**: 3 tasks (T014–T016)
- **Parallel opportunities**: T014, T015
- **Suggested MVP scope**: User Story 1 (Phases 1–3)

