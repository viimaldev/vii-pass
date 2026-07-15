# Tasks: Button Style Unification & Section-Color Primary Actions

**Input**: Design documents from `/specs/017-button-style-unification/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/buttons-ui.md, quickstart.md

**Tests**: Per the project Constitution (Principle II), NO unit tests are generated. Verification is manual/browser-based per story + quickstart.md.

**Organization**: Tasks are grouped by user story. The feature is frontend-only (zero new deps, `backend/` and `shared/` untouched); most changes land in `frontend/src/styles/tokens.css`, which creates a same-file chain across stories: **T001 (US1) → T004 (US2) → T009 (US3)**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 (unified shape), US2 (section-colored primary), US3 (dark eye/copy hover)

## Path Conventions

Web-app monorepo: all source paths under `frontend/src/`; spec artifacts under `specs/`.

---

## Phase 1: Setup

**Purpose**: Project initialization — nothing required. No new dependencies, no environment changes, no data changes. The dev loop is the existing `npm run dev:node`.

*(No tasks.)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Blocking prerequisites — none. The design tokens, theme system (013), section-color plumbing (014), and spinner (016) this feature builds on are already on the branch. The one new module (`colorContrast.ts`) serves only US2 and lives there.

*(No tasks.)*

---

## Phase 3: User Story 1 - Unified button shape across the app (Priority: P1) 🎯 MVP

**Goal**: Every rectangular action button app-wide (sign in, register, reset steps, unlock, dialog footers, "+" add-entry tile, user-menu sign-out row) carries the section-tab silhouette — `border-radius: 0 20px 0 0`, only the upper-right corner rounded.

**Independent Test**: Visit login, register, reset, home vault, both dialogs, and the user menu; every button shows the tab corner treatment at unchanged height; circular avatar/badge/swatches and small icon-only controls are unchanged.

### Implementation for User Story 1

- [X] T001 [US1] In `frontend/src/styles/tokens.css`, extend the "Unified button language" block (feature 014): add `border-radius: 0 20px 0 0;` for `.btn`, `.chord-add`, and `.user-menu__item` (matching `.section-tab`'s declaration verbatim), and update the block comment to reference the successor contract `specs/017-button-style-unification/contracts/buttons-ui.md`. Do NOT touch circular controls (`.user-menu__avatar`, `.user-menu__badge`, `.color-swatch`) or small icon-only controls (`.chord-card__icon-btn`, `.chord-field__btn`, `.chord-form-row__reveal`, `.user-menu__theme-btn`, `.vault-modal__icon-btn`) — explicit non-goals per contract §1.
- [X] T002 [US1] Browser-verify the shape sweep per quickstart.md §2: /login "Sign in", /register "Create account", /reset all 3 step submits + "Back to sign in" link-button, unlock button, "+" add-entry tile, dialog footer buttons (entry + section + both delete-confirm variants), user-menu sign-out row hover highlight; confirm button heights unchanged (~38px) and full-width `w-100` submits keep the silhouette without distortion; confirm avatar stays circular and icon controls keep `var(--radius)`.

**Checkpoint**: One consistent button silhouette everywhere — independently shippable MVP.

---

## Phase 4: User Story 2 - Section-colored primary action in the entry dialog (Priority: P2)

**Goal**: The entry create/edit dialog's Save button fills with the active section's color (add → selected section, edit → the chord's own section) with a contrast-adaptive label; Cancel stays gray but goes solid; all translucent button fills become opaque; dialog footer button gap widens one spacing step.

**Independent Test**: Open the entry dialog from two differently-colored sections — Save matches each color with a readable label (≥4.5:1 even for near-white/near-black colors); Cancel is solid gray; no translucent fills anywhere; footer gap visibly wider; no wrap at 320px.

### Implementation for User Story 2

- [X] T003 [P] [US2] Create `frontend/src/components/colorContrast.ts`: export pure function `readableTextColor(hex: string): string` — parse `#rrggbb`, compute WCAG 2.1 relative luminance (sRGB linearization), return `'#ffffff'` or `'#1b1f24'`, whichever yields the higher contrast ratio against the input. TSDoc the algorithm and the ≥4.5:1 guarantee (contract §3); tolerate malformed input by returning `'#ffffff'`.
- [X] T004 [US2] In `frontend/src/styles/tokens.css` (after T001, same file): (a) add `.btn-section` — opaque `background: var(--section-color, var(--color-primary))`, `border-color` same, `color: var(--section-color-fg, var(--color-primary-contrast))`, hover `background: color-mix(in srgb, var(--section-color) 85%, #000000)`, active `70%` (contract §3); (b) convert translucent tints to opaque theme-tracking equivalents: `.section-tab--add` and `.chord-add` `rgba(var(--bs-primary-rgb), 0.2)` → `color-mix(in srgb, var(--color-primary) 20%, var(--color-bg))` and hover `0.4` → `40%`; `.user-menu__theme-btn[aria-checked='true']` `rgba(..., 0.18)` → `color-mix(in srgb, var(--color-primary) 18%, var(--color-bg))` (contract §2); (c) `.vault-modal__footer` `gap: var(--space-2)` → `var(--space-3)` (contract §5).
- [X] T005 [P] [US2] In `frontend/src/vault/VaultContext.tsx`, pass a new `sectionColor` prop to `<AddChordDialog>`: add mode → the selected section's `color` (from `sections` + `selectedId`); edit mode → the color of the section owning `chordDialog.chord.sectionId`; `undefined` if unresolvable.
- [X] T006 [US2] In `frontend/src/components/AddChordDialog.tsx` (after T003, T005): accept optional `sectionColor?: string` prop; on the primary submit button replace `btn btn-primary` with `btn btn-section` and set inline style `{ '--section-color': sectionColor, '--section-color-fg': readableTextColor(sectionColor) }` when the color is present (omit style when absent — CSS fallback renders brand primary); switch BOTH Cancel buttons (main footer + delete-confirm) from `btn-outline-secondary` to `btn-secondary`. Keep the delete-confirm's danger button and all busy/spinner markup unchanged (FR-010/FR-011).
- [X] T007 [P] [US2] In `frontend/src/components/SectionDialog.tsx`, switch both Cancel buttons (main footer + delete-confirm) from `btn-outline-secondary` to `btn-secondary`; primary stays `btn-primary` (section dialog is NOT section-colored, contract §3 scope).
- [X] T008 [US2] Browser-verify per quickstart.md §3: Save color follows the section (two sections, add + edit modes); extreme colors `#ffff66` / `#111111` flip the label between dark and white text (≥4.5:1); Cancel solid gray in both themes; no translucent button fills ("+"-tile and checked theme button now opaque, visually unchanged on default bg); footer gap one step wider with no wrap at 320px; busy Save shows spinner + "Saving…" at unchanged height.

**Checkpoint**: Entry dialog primary reflects section context; all fills opaque; spacing updated.

---

## Phase 5: User Story 3 - Brighter eye/copy hover feedback in dark theme (Priority: P3)

**Goal**: In dark theme, the eye (reveal) and copy controls on chord-card values show the same hover wash as the edit icon; light theme is byte-for-byte unchanged.

**Independent Test**: In dark theme, hover eye, copy, and edit on a chord card — identical wash on all three; keyboard focus at least as visible as hover; switch to light theme — hover appearance identical to pre-change.

### Implementation for User Story 3

- [X] T009 [US3] In `frontend/src/styles/tokens.css` (after T004, same file): add `[data-bs-theme='dark'] .chord-field__btn:hover, [data-bs-theme='dark'] .chord-field__btn:focus-visible { background: color-mix(in srgb, var(--color-text) 16%, transparent); }` near the dark-theme block, with a comment noting it mirrors `.chord-card__icon-btn`'s wash (both resolve to the pinned `#1b1f24` inside `.chord-card`, contract §4). Do NOT modify the existing light-theme `.chord-field__btn:hover/:focus-visible` rule (FR-008).
- [X] T010 [US3] Browser-verify per quickstart.md §4: dark theme — eye/copy/edit hover washes visually identical; Tab focus shows the wash + global focus outline (FR-009); light theme — eye/copy hover shows the original `--color-surface` block, unchanged.

**Checkpoint**: All three card controls give consistent dark-theme hover feedback.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Contract supersession, quality gates, full-surface regression sweep.

- [X] T011 [P] Annotate `specs/014-section-color-theming/contracts/buttons-ui.md` with a supersession note at the top: the "buttons MUST NOT reference `--section-color`" rule now has exactly one sanctioned exception (`.btn-section` on the entry dialog primary); successor contract = `specs/017-button-style-unification/contracts/buttons-ui.md` (research Decision 6).
- [X] T012 Run quality gates from repo root: `npm run typecheck` (3 workspaces), `npm run lint`, `npm run build --workspaces --if-present`; confirm `git diff --stat backend/ shared/` is EMPTY (plan constraint); grep `frontend/src` for leftover `btn-outline-secondary` (expect 0 in the two dialogs) and `rgba(var(--bs-primary-rgb)` in tokens.css button rules (expect 0).
- [X] T013 Full quickstart.md walkthrough (§2–§5): both themes; 320/768/1280px no overflow or wrapped action rows; forced-colors emulation keeps buttons usable; print preview sane; normal-role login (`themeuser`) — every visible button carries the unified style (no mutation controls, per feature 011).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: empty
- **Phase 2 (Foundational)**: empty
- **US1 (Phase 3)**: no prerequisites — start immediately
- **US2 (Phase 4)**: T004 depends on T001 (same file: tokens.css); T003/T005/T007 are independent
- **US3 (Phase 5)**: T009 depends on T004 (same file: tokens.css)
- **Polish (Phase 6)**: T011 anytime; T012/T013 after all stories

### Task-Level Graph

```text
T001 (tokens.css shape) ──► T002 (US1 verify) ──► MVP ✅
  │
  └──► T004 (tokens.css .btn-section/opaque/gap) ──► T009 (tokens.css dark hover) ──► T010 (US3 verify)
                 │
T003 (colorContrast.ts) ──┐
T005 (VaultContext prop) ─┴──► T006 (AddChordDialog) ──► T008 (US2 verify)
T007 (SectionDialog)  ────────────────────────────────►

T011 (014 contract note)  — parallel anytime
T012 (gates) ──► T013 (full quickstart)  — after T002/T008/T010
```

### Parallel Opportunities

- **Within US2**: T003, T005, T007 all touch different files — run in parallel (T004 must wait for T001).
- **Cross-story**: T003/T005/T007 may start while US1's T002 verification is in progress.
- **Polish**: T011 can run in parallel with any story.

---

## Implementation Strategy

### MVP First (US1 only)

1. T001 — one CSS rule in the unified button block.
2. T002 — shape sweep. **Stop and ship if desired**: the app already reads as one consistent design.

### Incremental Delivery

1. US1 (T001–T002) → unified silhouette everywhere → shippable MVP.
2. US2 (T003–T008) → section-colored primary + opaque fills + wider gap → shippable.
3. US3 (T009–T010) → dark-theme hover parity → shippable.
4. Polish (T011–T013) → contract hygiene + gates + full regression sweep.

### Notes

- tokens.css is the shared file — respect the T001 → T004 → T009 chain to avoid conflicts.
- No data/API/permission changes anywhere (FR-011); if a change seems to need one, stop and re-check the plan.
- Total: **13 tasks** (US1: 2, US2: 6, US3: 2, Polish: 3).
