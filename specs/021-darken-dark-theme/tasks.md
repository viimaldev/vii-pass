# Tasks: Darker, Less Colorful Dark Theme

**Input**: Design documents from `/specs/021-darken-dark-theme/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dark-theme-ui.md, quickstart.md

**Tests**: Per the project Constitution (Principle II), NO unit tests. Verification is the manual quickstart.md walkthrough; theming is not a security-critical flow, so no integration tests either.

**Organization**: Tasks are grouped by user story. Note: this feature edits exactly ONE file (`frontend/src/styles/tokens.css`), so tasks within and across stories are inherently sequential — there are no meaningful `[P]` opportunities in implementation (only in verification).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Web app monorepo (`frontend/`, `backend/`, `shared/`). This feature touches only `frontend/src/styles/tokens.css`. `backend/` and `shared/` MUST remain untouched (plan.md Structure Decision, contract C7).

---

## Phase 1: Setup

**Purpose**: Baseline reference for before/after comparison (SC-001) and light-theme regression (SC-003)

- [X] T001 Capture "before" reference screenshots on the current build in Dark theme (sign-in page, vault with several vivid section colors, open user menu, open entry dialog) and in Light theme (same surfaces), per quickstart.md §1. Store them outside the repo (do not commit).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Locate and fence the change surface so all story edits land in the right blocks

- [X] T002 Review the existing dark-theme override region in frontend/src/styles/tokens.css (the `[data-bs-theme='dark']` token block ~line 1303 and all `[data-bs-theme='dark'] …` component rules below it, plus the light-theme derived-ramp rules for `.section-tab` ~lines 500–561, `.btn-section` ~lines 450–480, and `.chord-card` pinned tokens ~line 802) and confirm no component sets palette hexes outside tokens.css. Do not edit yet — this establishes exactly which rules stories US1/US2 will modify and confirms light-theme rules that must NOT be touched.

**Checkpoint**: Change surface identified — story implementation can begin

---

## Phase 3: User Story 1 - Darker overall surfaces in dark theme (Priority: P1) 🎯 MVP

**Goal**: Every base surface (page bg, cards/panels, header, tab bar shell, menus, dialogs, form fields) renders on a deep dark-gray palette instead of the current medium gray — dark theme only.

**Independent Test**: Switch to Dark theme; sign-in and vault pages show visibly darker surfaces than the T001 reference while all text stays readable; Light theme unchanged (quickstart.md §2).

### Implementation for User Story 1

- [X] T003 [US1] Re-point the palette tokens in the `[data-bs-theme='dark']` block of frontend/src/styles/tokens.css from the medium-gray values to the deep dark-gray palette per research.md Decision 1 (`--color-bg` #3a3f44→≈#26292d, `--color-surface` #2f3439→≈#1e2226, `--color-border`→≈#484f56, `--color-text-muted`→≈#aab3bb, `--color-primary`→≈#7fa9d2, `--color-primary-contrast` re-checked, `--color-danger`→≈#ef9a91, `--color-success`→≈#5cb97a, `--color-focus`→≈#93b6d8; `--color-text` stays #f0f2f4). Tune final hexes so every pair in contract C2 measures ≥4.5:1; never near-black (contract C1).
- [X] T004 [US1] Update the Bootstrap remaps in the same block of frontend/src/styles/tokens.css to match the new palette: `--bs-primary-rgb`, `--bs-link-color-rgb` (both = new `--color-primary` RGB), `--bs-link-hover-color`, and `--bs-danger-rgb` (= new `--color-danger` RGB).
- [X] T005 [US1] Retune the dark `.btn-primary` override in frontend/src/styles/tokens.css (`[data-bs-theme='dark'] .btn-primary`): hover/active fills (#7fbcf3/#4f9fe8) re-derived from the new muted primary, label contrast ≥4.5:1 on all states (contracts C2/C6).
- [X] T006 [US1] Retune the dark alert tints in frontend/src/styles/tokens.css (`[data-bs-theme='dark'] .alert--error` #46231f and `.alert--success` #1d3a27) so the new muted danger/success text keeps ≥4.5:1 on them and the tints sit harmoniously on the darker surfaces (contract C2, FR-006).
- [X] T007 [US1] Verify overlaid-surface separation on the new palette in dark theme: user menu panel, entry/section dialogs, and form fields remain visually distinct from the page behind them (luminance step and/or border), the dialog's white-glow shadow (`[data-bs-theme='dark'] .vault-modal`) still lifts it off the darker page, and the #000 dialog header/footer lattice bands remain the darkest element (contract C1). Adjust `--color-border`/surface values in frontend/src/styles/tokens.css if separation is lost. Check the feature-018 logo `brightness(1.8)` filter is still legible on the darker header (research.md Decision 5).

**Checkpoint**: Dark theme is visibly darker everywhere; text readable; Light theme untouched — MVP deliverable

---

## Phase 4: User Story 2 - Reduced color intensity in dark theme (Priority: P2)

**Goal**: Section-colored elements (tabs, chord cards, `.btn-section`), primary accents, and decorative artwork render muted/dimmed in dark theme only.

**Independent Test**: In Dark theme with vivid section colors, tabs/cards/Save button are visibly less saturated than the T001 reference and the page artwork recedes; the same elements in Light theme are unchanged (quickstart.md §3).

### Implementation for User Story 2

- [X] T008 [US2] Add the dark-only muted section-color variable in frontend/src/styles/tokens.css: a rule declaring `--section-color-muted: color-mix(in srgb, var(--section-color) 70%, #3a4046)` on `[data-bs-theme='dark'] .section-tab`, `[data-bs-theme='dark'] .chord-card`, and `[data-bs-theme='dark'] .btn-section` (research.md Decision 2, contract C3). Components' inline `--section-color` MUST NOT be touched.
- [X] T009 [US2] Add dark-theme overrides for the section-tab ramps in frontend/src/styles/tokens.css: re-declare `--tab-top`/`--tab-bottom` for unselected (~lines 521–522 light math), selected (~547–548), hover (~555–556), and selected-hover (~560–561) states under `[data-bs-theme='dark']`, consuming `--section-color-muted` in place of `--section-color`. Verify selected vs. unselected stays distinguishable for vivid (pure red/lime) AND near-black section colors (contract C3, spec edge case).
- [X] T010 [US2] Update the existing `[data-bs-theme='dark'] .chord-card` ramp override in frontend/src/styles/tokens.css (~line 1366) to rebuild `--chord-header-top/bottom` and `--chord-body-top/bottom` from `--section-color-muted` mixed toward off-white #e9eaec instead of #ffffff, keeping mix percentages that preserve the AA contrast band for the worst case (near-black section color → pinned #1b1f24 interior text ≥4.5:1 on the deepest band). Pinned interior tokens and `--chord-header-fg` unchanged (contract C4, FR-009).
- [X] T011 [US2] Add dark-theme `.btn-section` fill overrides in frontend/src/styles/tokens.css: `--bs-btn-bg`/`--bs-btn-border-color` and the color-mix hover (85% toward #000) / active (70% toward #000) / disabled fills re-derived from `--section-color-muted`; label stays white per feature-017 decision — verify it still reads on the muted fill for light section colors (contracts C3/C6).
- [X] T012 [US2] Deepen the artwork dimming in frontend/src/styles/tokens.css: raise the `[data-bs-theme='dark'] .page-bg` overlay from rgba(20,22,25,0.55) to ≈rgba(16,18,20,0.72) and update `--page-bg-fallback` to suit the darker palette; add a ≈rgba(16,18,20,0.45) gradient overlay to `[data-bs-theme='dark'] .page-bg--home` (currently overlay-free). Artwork files in frontend/public/backgrounds/ untouched (research.md Decision 4, contract C5, FR-003).

**Checkpoint**: Dark theme is darker AND less colorful; section identity and selected states preserved

---

## Phase 5: User Story 3 - Readability and states preserved (Priority: P3)

**Goal**: Prove nothing became invisible or ambiguous — all text meets AA, all interactive states stay distinct, guards intact.

**Independent Test**: Full dark-theme walkthrough per quickstart.md §4–§6 with measured contrast checks.

### Implementation for User Story 3

- [X] T013 [US3] Measure and record WCAG AA contrast for every changed pair (quickstart.md §4.1): body/muted/link text on new bg/surface, error+success text on new tints, `.btn-primary` and `.btn-section` labels on their fills, focus ring on all surfaces (≥3:1), chord-card worst-case band text. Fix any failing hex in frontend/src/styles/tokens.css until all pass (FR-006, SC-002, contract C2).
- [X] T014 [US3] Update the dark-theme block comment in frontend/src/styles/tokens.css (~lines 1288–1302) to document the new palette rationale (deep dark-gray, muted accents, `--section-color-muted` mechanism) and the measured contrast ratios from T013, replacing the stale medium-gray figures (contract C2 documentation convention; feature-013 precedent).
- [X] T015 [US3] Walk all interactive states in dark theme (quickstart.md §4.2–4.3): hover/focus-visible/active/selected/disabled/busy on `.btn` variants, `.btn-section`, section tabs, `.chord-add`, user-menu rows, theme radios, form controls, in-card eye/copy/edit buttons (incl. the feature-017 16% wash on `[data-bs-theme='dark'] .chord-field__btn`). Adjust dark-theme values in frontend/src/styles/tokens.css where any state is ambiguous (FR-007, contract C6).
- [X] T016 [US3] Verify unchanged guards & mechanism (quickstart.md §6): Auto mode flips to the NEW dark palette live (OS scheme change + refresh, no flash of old palette); forced-colors mode, print preview, and reduced-motion behave exactly as before (FR-005, FR-008, contract C7). No file edits expected — regression confirmation only.

**Checkpoint**: All three stories verified independently — dark theme darker, muted, and fully legible

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Regression safety and release gates

- [X] T017 Light-theme regression pass (quickstart.md §5): walk sign-in/register/reset/vault/menus/dialogs in Light theme and compare against T001 reference screenshots — must be pixel-identical (FR-004, SC-003). Confirm `git diff` touches ONLY `[data-bs-theme='dark']` rules in frontend/src/styles/tokens.css.
- [X] T018 Responsive sweep in dark theme (quickstart.md §7): complete sign-in → vault → switch sections → add/edit/delete entry → user menu → sign-out at 320px, ~768px, and desktop widths; no state or control invisible/ambiguous (SC-004, Constitution III).
- [X] T019 Run release gates from repo root: `npm run lint`, `npm run typecheck` (or workspace equivalents) and the frontend build — zero errors, no TS/TSX diffs, CSS delta <1KB gzip (plan.md Performance Goals).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — do first (screenshots must predate any edit)
- **Phase 2 (Foundational)**: After Phase 1
- **Phase 3 (US1)**: After Phase 2 — establishes the new base palette
- **Phase 4 (US2)**: After US1 (muted mixes are tuned against the new darker surfaces; the neutral mix gray #3a4046 relates to the new palette)
- **Phase 5 (US3)**: After US1 + US2 (verifies their combined output)
- **Phase 6 (Polish)**: After all stories

### Story Dependency Note

US2 *builds visually* on US1 (mute targets are judged against the darker surfaces), but US1 alone is a complete, shippable MVP. US3 is a verification story over US1+US2 output. All tasks edit the same single file, so execute strictly in ID order — **no parallel implementation tasks exist in this feature**.

### Parallel Opportunities

Only in verification: T017 and T018 (different concerns, no file edits) may run in parallel by two reviewers once T013–T016 are done. Everything else is sequential by design (single-file feature).

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. T001–T002 (baseline + fence)
2. T003–T007 → **STOP and validate**: dark theme visibly darker, AA holds, light theme untouched
3. Ship-ready increment if needed

### Incremental Delivery

1. US1 → darker surfaces (MVP)
2. US2 → muted section colors + dimmed artwork
3. US3 → measured AA + state walkthrough + doc comment
4. Polish → light regression, responsive sweep, gates

---

## Summary

- **Total tasks**: 19
- **Per story**: Setup 1, Foundational 1, US1 5 (T003–T007), US2 5 (T008–T012), US3 4 (T013–T016), Polish 3 (T017–T019)
- **Parallel opportunities**: none in implementation (single-file feature); T017/T018 parallelizable in verification
- **Independent test criteria**: US1 = quickstart §2 (darker surfaces vs. reference), US2 = quickstart §3 (muted colors, dimmer art), US3 = quickstart §4–6 (measured AA + states + guards)
- **Suggested MVP**: Phase 1–3 (through T007)
- **Format validation**: ✅ all tasks use `- [ ] T### [P?] [Story?] description + exact file path`
