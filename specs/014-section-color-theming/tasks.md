# Tasks: Section Color Theming for Chords & Unified Buttons

**Input**: Design documents from `/specs/014-section-color-theming/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (chord-card-theming.md, buttons-ui.md), quickstart.md

**Tests**: Per the project Constitution (Principle II), NO unit-test tasks. Verification = a computational contrast audit plus manual quickstart checks (this feature touches no security flow, so no integration tests either).

**Organization**: Tasks are grouped by user story. Feature is FRONTEND-ONLY (2 components + tokens.css); backend/ and shared/ must remain untouched.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 (card gradients), US2 (unified buttons), US3 (live correctness)

## Path Conventions

Web app monorepo — all paths in the frontend workspace: `frontend/src/`. The single design-system file is `frontend/src/styles/tokens.css`; edits to it are strictly sequential (same-file chain noted per task).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bring in the feature 013 theme system this feature's dark rules build on

- [X] T001 Merge branch `topic/vii-1014-theme-support` (feature 013 — theme support) into `topic/vii-1015-section-color-theming`; resolve any conflicts (expected: `.github/copilot-instructions.md` SPECKIT block, `.specify/feature.json` — keep this feature's values; `frontend/src/styles/tokens.css` — keep both). Verify `frontend/src/theme/ThemeContext.tsx` exists, `frontend/index.html` has the no-flash script, and gates pass (`npm run typecheck`, `npm run lint`, `npm run build --workspaces --if-present`)

**Checkpoint**: `data-bs-theme` attribute + dark token block available — user story work can begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None — no shared infrastructure beyond the Phase 1 merge

No foundational tasks: the color plumbing serves only US1 (US2 is pure CSS on existing selectors), so it lives in Phase 3. Proceed directly.

---

## Phase 3: User Story 1 - Chord cards carry their section's color (Priority: P1) 🎯 MVP

**Goal**: Every chord card's header shows a linear gradient of the section color blended toward white (light theme) / black (dark theme), and its body a light-tint / dark-shade gradient of the same color — readable for any pickable color (contracts/chord-card-theming.md).

**Independent Test**: Two sections with different colors, one chord each; each card's header and body gradients reflect its own section color in both themes; all card text, icons, and controls stay readable (quickstart §1–§2).

### Implementation for User Story 1

- [X] T002 [P] [US1] Add optional `sectionColor?: string` prop to `ChordGridProps` in frontend/src/components/ChordGrid.tsx and set it inline on the `.chord-grid` container: `style={{ '--section-color': sectionColor }}` (cast key as string, same pattern as SectionTabs.tsx line 71); omit the style when the prop is undefined. TSDoc the prop (decorative only, FR-010)
- [X] T003 [US1] In frontend/src/pages/HomePage.tsx derive the selected section's color from the vault context (`sections.find((s) => s.id === selectedId)?.color` — pull `sections` + `selectedId` from the existing `useVault()` call) and pass it as `sectionColor` to `<ChordGrid>` (depends on T002)
- [X] T004 [P] [US1] In frontend/src/styles/tokens.css add light-theme ramp variables on `.chord-card` — `--section-color: var(--color-primary)` fallback, `--chord-header-top`/`--chord-header-bottom` = `color-mix(in srgb, var(--section-color) 25%/45%, #ffffff)`, `--chord-body-top`/`--chord-body-bottom` = `color-mix(in srgb, var(--section-color) 10%/18%, #ffffff)`, `--chord-header-fg: var(--color-text)` — then paint `.chord-card__header` and `.chord-card__body` with `linear-gradient(to bottom, …)` from those vars, and replace every hardcoded header foreground with the var: header `color: var(--chord-header-fg)`, `.chord-card__title--link:focus-visible` outline `var(--chord-header-fg)` (was `#ffffff`), `.chord-card__icon-btn` hover wash `color-mix(in srgb, var(--chord-header-fg) 16%, transparent)` (was `rgba(255,255,255,.16)`)
- [X] T005 [US1] In frontend/src/styles/tokens.css add the dark-theme override block `[data-bs-theme='dark'] .chord-card` — header stops `color-mix(in srgb, var(--section-color) 45%/30%, #000000)`, body stops `color-mix(in srgb, var(--section-color) 22%/14%, #101214)`, `--chord-header-fg: #ffffff` — and REMOVE feature 013's superseded flat pin `[data-bs-theme='dark'] .chord-card__header { background: #1f2327 }` (same file: after T004; needs T001's merged dark block)
- [X] T006 [US1] In frontend/src/styles/tokens.css add degradation guards for the card gradients mirroring the `.page-bg` precedent: `@media (forced-colors: active)` — header/body backgrounds yield to the forced palette with system foregrounds; `@media print` — gradients removed, dark text (FR-011) (same file: after T005)
- [X] T007 [US1] Contrast audit (SC-005, contract "Contrast guarantees" table): computationally verify (script or manual relative-luminance math, method of feature 013 T014) all pairs — header fg vs header stops, body/muted/danger text vs body stops, focus outline vs backgrounds — at section colors `#000000`, `#ffffff`, `#ff0000`, `#00ff00`, `#ffff00` in BOTH themes; if any pair < 4.5:1 (3:1 non-text) tighten the blend bands in frontend/src/styles/tokens.css and record the final percentages in specs/014-section-color-theming/contracts/chord-card-theming.md (after T005)
- [X] T008 [US1] Verify US1 in the browser per quickstart §1–§2 (`npm run dev:node`): two differently colored sections + Mine, both themes, extreme colors, section switching with no stale color, card functionality unchanged (reveal/copy/edit/drag) (depends on T003, T006, T007)

**Checkpoint**: Cards are section-colored and readable in both themes — MVP deliverable

---

## Phase 4: User Story 2 - One consistent button style everywhere (Priority: P2)

**Goal**: App-wide unified button language: no bold labels, variants by design/size, buttons never adopt the section color (contracts/buttons-ui.md).

**Independent Test**: Sweep every page/dialog; every button label is non-bold, variants distinguishable by design/size, no button styled from `--section-color` (quickstart §3).

### Implementation for User Story 2

- [X] T009 [US2] In frontend/src/styles/tokens.css add the unified-button block: low-specificity backstop `button, .btn { font-weight: 400; }`; DELETE `font-weight: 700` from `.section-tab.is-selected` (selection already conveyed by the full-strength ramp + aria-current) and from `.user-menu__avatar`; normalize `.user-menu__badge` to 400 for visual consistency; confirm no other button class declares a weight > 400 (grep `font-weight` in tokens.css). Buttons MUST NOT reference `--section-color` — the block is documented with a comment citing contracts/buttons-ui.md (same file: after T006 — tokens.css chain; story-independent otherwise)
- [X] T010 [US2] Full-app button sweep per contracts/buttons-ui.md "Verification": LoginPage, RegisterPage, ResetPasswordPage, HomePage (tabs, cards, add tile), SectionDialog, AddChordDialog, UserMenu (trigger, theme selector, logout), FieldInfo — computed `font-weight` = 400 on every `button`/`.btn`, variants distinguishable in both themes, zero section-colored buttons; check `<a class="btn">` on ResetPasswordPage (depends on T009)

**Checkpoint**: Unified button language holds app-wide in both themes

---

## Phase 5: User Story 3 - Colors stay correct through theme and section changes (Priority: P3)

**Goal**: Gradients re-blend instantly on theme switches (incl. Auto flips) and new sections/colors show correctly with no reload.

**Independent Test**: Toggle theme with cards visible — all re-blend at once; create a new section + chord — tinted correctly immediately (quickstart §4).

### Implementation for User Story 3

- [X] T011 [US3] Verify live correctness in the browser per quickstart §4: flip Light→Dark→Auto with cards visible (instant re-blend, no reload/flash), flip OS theme while in Auto (cards follow), create a new section with a new color and add a chord (correct tint immediately), edit a section's color (cards restyle). No code expected — this behavior falls out of CSS variable resolution (research Decision 1); if any check fails, fix in frontend/src/components/ChordGrid.tsx / frontend/src/styles/tokens.css and re-verify (depends on US1 complete)

**Checkpoint**: All three stories independently verified

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Degradation, responsiveness, gates, and the full walkthrough

- [X] T012 [P] Degradation + roles spot-check per quickstart §5: print preview legible, `forced-colors: active` emulation readable with visible focus, normal-role (read-only) session shows identical coloring, locked vault keeps gradients
- [X] T013 [P] Responsive spot-check per quickstart §6 (Constitution III): 320px / 768px / 1280px — gradients render, no horizontal overflow, ≥44px touch targets on coarse pointer, tab strip scrolls
- [X] T014 Gates + dead-rule sweep: `npm run typecheck` + `npm run lint` + `npm run build --workspaces --if-present` all green; `git diff --stat main -- backend/ shared/` empty (frontend-only); grep frontend/src/styles/tokens.css for the removed `#1f2327` pin (0 matches) and for `font-weight: 700` on button classes (0 matches); confirm frontend/src/components/ChordCard.tsx is unchanged
- [X] T015 Full quickstart walkthrough (specs/014-section-color-theming/quickstart.md §0–§7) end-to-end on a fresh session, both themes, admin + normal roles

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (T001)**: No dependencies — MUST complete first (dark rules target 013's merged tokens)
- **Phase 2**: Empty
- **Phase 3 (US1)**: After T001 — delivers the MVP
- **Phase 4 (US2)**: After T001; story-independent of US1, but T009 sits at the end of the tokens.css same-file chain (T004 → T005 → T006 → T009)
- **Phase 5 (US3)**: After US1 (verifies its live behavior)
- **Phase 6**: After all user stories

### Same-file chains (sequential)

- `frontend/src/styles/tokens.css`: T004 → T005 → T006 → T009
- `frontend/src/components/ChordGrid.tsx`: T002 → (referenced by T003, T011)

### Story dependency graph

```text
T001 (merge 013)
 ├─→ US1: T002 ∥ T004 → T003, T005 → T006 → T007 → T008
 │        └────────────────────────────────┬─────────┘
 ├─→ US2: T009 (after T006, tokens.css) → T010
 └─→ US3: T011 (after US1)
Polish: T012 ∥ T013 → T014 → T015
```

### Parallel opportunities

- **T002 ∥ T004**: different files (ChordGrid.tsx vs tokens.css)
- **T003** can proceed while T005–T007 continue (different files)
- **T012 ∥ T013**: independent manual checks
- US2's code task (T009) cannot truly parallelize with US1's CSS work (shared tokens.css), but T010's sweep can overlap with US3's T011 (both browser verification)

---

## Implementation Strategy

**MVP first**: T001 → US1 (T002–T008). That alone ships the requested visual: section-colored cards in both themes with audited contrast.

**Incremental delivery**:

1. T001 merge → gates green (checkpoint: theme system present)
2. US1 → MVP checkpoint (cards themed, contrast audited)
3. US2 → unified buttons (independent visual increment)
4. US3 → live-correctness verification
5. Polish → degradation, responsive, gates, full walkthrough

**Scope guard**: backend/, shared/, ChordCard.tsx, and all API payloads stay untouched (plan "Structure Decision", FR-010). Total code surface: 2 component files + tokens.css.
