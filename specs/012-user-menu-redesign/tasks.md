# Tasks: User Menu Redesign

**Input**: Design documents from `/specs/012-user-menu-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/user-menu-panel.md, quickstart.md

**Tests**: Per the project Constitution (Principle II), NO unit tests are generated. Logout is the only security-adjacent flow and its logic is unchanged — a manual verification step is included instead.

**Organization**: Tasks are grouped by user story. This is a small frontend-only restyle touching exactly two files (`frontend/src/components/UserMenu.tsx`, `frontend/src/styles/tokens.css`), so stories share files and most tasks are sequential rather than parallel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Web app — only `frontend/src/` is touched. Backend, shared types, and routes are unchanged (see plan.md Structure Decision).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No project initialization is needed — the workspace, lint tooling, and dev servers already exist. This phase only confirms a clean starting point.

- [X] T001 Verify dev environment runs: from repo root run `npm run dev` and confirm the app serves at http://localhost:5173 with a signed-in session available for menu testing

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared building blocks both story phases depend on — the local icon helpers in the component and the panel-layout CSS primitives.

**⚠️ CRITICAL**: Complete before any user story work.

- [X] T002 Add local inline Bootstrap-Icons SVG constants (`palette`, `box-arrow-right`) with a tiny shared `svg()` render helper (16×16 viewBox, `fill="currentColor"`, `aria-hidden="true"`, `focusable="false"`) at the top of frontend/src/components/UserMenu.tsx — local to this file per research Decision 1; do NOT touch frontend/src/components/chordFieldTypes.tsx
- [X] T003 [P] Add new panel CSS primitives to the existing `.user-menu__*` block in frontend/src/styles/tokens.css: `.user-menu__header` (flex row, `--space-3` padding, `border-bottom: 1px solid var(--color-border)`), `.user-menu__badge` (40px circle, `--color-primary` bg, white bold initial), `.user-menu__name` (~1.05rem, weight 700), `.user-menu__id` (small, `--color-text-muted`, `overflow-wrap: anywhere`), `.user-menu__item` (flex, `gap: var(--space-2)`, `min-height: 40px`, `--space-2` vertical padding) — design tokens only, no hardcoded colors (contract "Visual contract" section)

**Checkpoint**: Icon constants and CSS classes exist — story phases can now consume them.

---

## Phase 3: User Story 1 - Roomier, clearer account menu (Priority: P1) 🎯 MVP

**Goal**: Replace the congested panel header with the redesigned identity header: circular initial badge (no photo), large bold display name, smaller muted username below, divider, generous spacing.

**Independent Test**: Sign in, open the user menu, and visually verify the identity header (initial badge, big bold display name, smaller username below) and comfortable spacing; long names wrap without breaking the panel.

### Implementation for User Story 1

- [X] T004 [US1] Rebuild the panel identity header in frontend/src/components/UserMenu.tsx: replace the current `px-3 py-2 border-bottom` block with `.user-menu__header` containing a `.user-menu__badge` span (reusing the existing `initial` derivation, `aria-hidden="true"` since the name follows as text) beside a text column of `.user-menu__name` (displayName) over `.user-menu__id` (username); keep `role="menu"` / `aria-label="Account"` on the panel and update the component TSDoc comment
- [X] T005 [US1] Verify header layout and overflow behavior per quickstart.md steps 2, 7, 8: badge+typography hierarchy correct; no clipping or horizontal viewport overflow at 320px, 768px, and 1280px; a long displayName/username wraps inside the panel's `max-width` clamp (FR-008, FR-009, SC-001, SC-004)

**Checkpoint**: Identity header redesigned and responsive — MVP delivered (menu still has the existing plain Logout row).

---

## Phase 4: User Story 2 - Log out with a recognizable icon (Priority: P2)

**Goal**: Restyle the existing Logout action as an icon-led row without changing any sign-out logic.

**Independent Test**: Open the menu, confirm the Log out row shows the box-arrow-right icon + label, click it, and verify busy state ("Signing out…") then redirect to `/login`.

### Implementation for User Story 2

- [X] T006 [US2] Restyle the Logout button in frontend/src/components/UserMenu.tsx: add `user-menu__item` class alongside `dropdown-item`, prepend the `box-arrow-right` icon constant before the label, and preserve ALL existing behavior — `role="menuitem"`, `onClick={() => void handleLogout()}`, `disabled={busy}`, `aria-busy={busy}`, "Signing out…" busy label, redirect to `/login` (FR-004)
- [X] T007 [US2] Manually verify the logout flow end-to-end per quickstart.md step 5 (critical auth-adjacent flow): click Log out → busy state shows → session ends → redirected to /login; also verify keyboard activation (Tab to row, Enter) still works (SC-003, SC-005)

**Checkpoint**: Logout row matches the icon-led design with zero behavioral regression.

---

## Phase 5: User Story 3 - Theme option placeholder (Priority: P3)

**Goal**: Add a visible, focusable "Change theme" row (palette icon) above Log out that intentionally does nothing when activated.

**Independent Test**: Open the menu, confirm the "Change theme" row with palette icon appears above Log out; clicking or pressing Enter on it changes nothing and raises no error.

### Implementation for User Story 3

- [X] T008 [US3] Add the "Change theme" row in frontend/src/components/UserMenu.tsx above the Logout row: `<button type="button" role="menuitem" className="dropdown-item user-menu__item">` with the `palette` icon constant + "Change theme" label and an intentionally empty click handler carrying a brief comment referencing FR-006 (placeholder until theme switching ships); NOT `disabled`, does not close the menu or navigate (research Decision 3)
- [X] T009 [US3] Verify placeholder semantics per quickstart.md step 4: mouse click and keyboard Enter/Space on "Change theme" produce no theme change, no navigation, no console error, and the menu stays open; row order is Change theme above Log out (FR-005, FR-006)

**Checkpoint**: All three menu elements (header, Change theme, Log out) match the contract in contracts/user-menu-panel.md.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final quality gates spanning all stories.

- [X] T010 Full keyboard + a11y walkthrough per quickstart.md step 6 and contract "Behavioral contract": Enter/Space opens the trigger, Tab traverses both rows, Escape and outside-click close the panel, icons are `aria-hidden`, trigger keeps `aria-haspopup`/`aria-expanded`/`aria-label` (FR-007, SC-005); confirm menu content is identical when signed in as an admin-role and a normal-role user
- [X] T011 Final responsive sweep of the complete panel at 320px, 768px, and 1280px (all rows ≥40px touch targets, consistent icon alignment per SC-002/SC-004) and run `npm run lint` from repo root — zero errors, no suppressions added

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Setup: T001)
   └─→ Phase 2 (Foundational: T002 component icons, T003 CSS — parallel)
          └─→ Phase 3 (US1: T004 → T005)   🎯 MVP
                 └─→ Phase 4 (US2: T006 → T007)
                        └─→ Phase 5 (US3: T008 → T009)
                               └─→ Phase 6 (Polish: T010 → T011)
```

### Story Dependencies

- **US1 (P1)**: Depends only on Foundational. Independently testable — header redesign stands alone.
- **US2 (P2)**: Depends on Foundational (icon constant + `.user-menu__item`). Does not require US1, but both edit `UserMenu.tsx`, so sequential execution avoids conflicts.
- **US3 (P3)**: Depends on Foundational; positioned relative to the Logout row, so most naturally done after US2 (order requirement FR-005).

### Parallel Opportunities

- **T002 ∥ T003** — different files (component vs stylesheet), no dependency.
- Everything else is sequential: all remaining implementation tasks edit the same file (`UserMenu.tsx`), and verification tasks follow their implementation tasks.

---

## Implementation Strategy

### MVP First (US1 only)

1. T001 → T002 + T003 (parallel) → T004 → T005.
2. **STOP and demo**: the congestion problem is solved — identity header redesigned, existing logout still works (just unstyled).

### Incremental Delivery

1. Add US2 (T006–T007): icon-led Logout — visual parity with the reference for existing functionality.
2. Add US3 (T008–T009): Change theme placeholder row.
3. Polish (T010–T011): a11y walkthrough, responsive sweep, lint gate.

Each checkpoint leaves the app fully functional and shippable.

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 11 |
| Setup / Foundational | 1 / 2 |
| US1 (P1) | 2 (T004–T005) |
| US2 (P2) | 2 (T006–T007) |
| US3 (P3) | 2 (T008–T009) |
| Polish | 2 (T010–T011) |
| Parallel opportunities | 1 (T002 ∥ T003) |
| Unit-test tasks | 0 (per constitution) |
| Suggested MVP | Phase 1–3 (through T005) |
