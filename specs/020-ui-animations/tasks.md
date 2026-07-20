# Tasks: UI Micro-Animations

**Input**: Design documents from `/specs/020-ui-animations/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/animations-ui.md, quickstart.md

**Tests**: Per the project Constitution (Principle II), NO unit tests. Verification is the
manual browser walkthrough in quickstart.md — each story carries its own verify task.

**Organization**: Tasks are grouped by user story so each animation ships as an
independently testable increment. Everything is FRONTEND-ONLY: one stylesheet
(`frontend/src/styles/tokens.css`) plus two components (`ChordGrid.tsx`, `HomePage.tsx`).
`backend/` and `shared/` MUST remain untouched.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)

**Same-file chain (tokens.css)**: T001 → T002 → T004 → T008 → T010 → T012 → T014 must be
applied in order — they all edit `frontend/src/styles/tokens.css`.

---

## Phase 1: Setup

*None — the project, tooling, and design-token stylesheet already exist. No new
dependencies are permitted (plan Technical Context).*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared motion-token vocabulary every story's CSS consumes.

- [X] T001 Add the "Motion & micro-animations" block scaffold at the end of `frontend/src/styles/tokens.css`: a `:root` group defining `--motion-sweep: 500ms`, `--motion-glow: 500ms`, `--motion-enter: 300ms`, `--motion-enter-step: 60ms`, `--motion-trace: 300ms`, `--motion-zoom: 200ms`, with an intent comment pointing at `specs/020-ui-animations/contracts/animations-ui.md`. No consumers yet.

**Checkpoint**: Tokens exist — user stories can begin (tokens.css stories in file order, component story in parallel).

---

## Phase 3: User Story 1 - Buttons respond with a sweeping hover effect (Priority: P1) 🎯 MVP

**Goal**: Every rectangular action button's hover background sweeps in right→left over
~500ms instead of snapping (FR-001..003; contract §1).

**Independent Test**: Hover Sign in on `/login` and dialog/vault buttons — fill travels
right→left over ~500ms, retracts smoothly on exit, never plays on disabled/busy buttons,
and never delays clicks (quickstart §2).

### Implementation for User Story 1

- [X] T002 [US1] Implement the hover sweep in `frontend/src/styles/tokens.css` (after T001): (a) shared rule for `.btn`, `.chord-add`, `.user-menu__item` — `background-image: linear-gradient(var(--btn-sweep-color), var(--btn-sweep-color))`, `background-repeat: no-repeat`, `background-position: right center`, `background-size: 0% 100%`, `transition: background-size var(--motion-sweep) linear`, and `background-size: 100% 100%` under `:hover:not(:disabled)` wrapped in `@media (hover: hover)`; (b) per-variant `--btn-sweep-color`: move `.btn-primary`'s hover color (#094a8f) into it and pin `--bs-btn-hover-bg` to the resting bg (repeat for its dark-theme override), same for `.btn-secondary` and `.btn-section` (sweep color = the existing color-mix 85%-to-black hover value), and convert `.chord-add:hover` / `.user-menu__item` hover washes to the sweep mechanism; (c) leave `--bs-btn-active-*` (pressed) instant; (d) start the single `@media (prefers-reduced-motion: reduce)` block: remove the sweep transition (hover color still changes instantly); (e) `@media (forced-colors: active)`: disable the sweep layer (`background-image: none`) so UA-native hover wins.
- [X] T003 [US1] Verify US1 in the browser per quickstart §2 + §7: sweep direction/duration on login, register, reset, unlock, dialog footer (Save/Cancel), add-entry tile, and user-menu sign-out row; mid-sweep exit retracts cleanly; click mid-sweep fires immediately; busy/disabled buttons show no sweep; 10× rapid hover = no flicker; reduced-motion emulation = instant hover change, no travel; both themes; touch emulation leaves no stuck hover.

**Checkpoint**: MVP — the app-wide sweep is fully functional and shippable on its own.

---

## Phase 4: User Story 2 - Credential cards glow on hover (Priority: P2)

**Goal**: Chord cards gain a soft section-colored glow that fades in/out slowly on hover,
with zero layout shift (FR-004..005; contract §2).

**Independent Test**: Hover a chord card in the vault — glow fades in over ~500ms and back
out on exit; neighbors don't move; legible in both themes and any section color
(quickstart §3).

### Implementation for User Story 2

- [X] T004 [US2] Implement the card glow in `frontend/src/styles/tokens.css` (after T002): add `transition: box-shadow var(--motion-glow) ease` to `.chord-card`, and under `@media (hover: hover)` a `.chord-card:hover` rule with `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35), 0 0 18px 2px color-mix(in srgb, var(--section-color) 55%, transparent)`; extend the reduced-motion block (remove the box-shadow transition — glow becomes an instant state change); suppress the glow shadow in the existing `@media print` and `@media (forced-colors: active)` guard sections.
- [X] T005 [US2] Verify US2 in the browser per quickstart §3 + §7: glow fade in/out timing; zero neighbor movement (compare bounding rects); section-color follow across sections; dark theme legibility; drag (`.is-dragging`) still works; reduced-motion = instant glow; touch tap leaves no stuck glow; print preview shows no glow.

**Checkpoint**: US1 + US2 both independently functional.

---

## Phase 5: User Story 3 - Credential cards appear one by one (Priority: P2)

**Goal**: Cards enter with a staggered rise-and-fade on initial load and section switch —
capped ≤1.5s, never replayed by single mutations (FR-006..007; contract §3).

**Independent Test**: Refresh the vault / switch sections with several entries — cards
enter sequentially (~60ms apart); first card interactive immediately; add animates only the
new card; edit/delete/reorder replay nothing (quickstart §4).

### Implementation for User Story 3

- [X] T006 [P] [US3] Edit `frontend/src/components/ChordGrid.tsx`: add optional `enterKey?: string` to `ChordGridProps` (TSDoc: remount key for the entrance animation, changes on section switch); apply `key={enterKey}` to the `.chord-grid` container; set inline `['--enter-index' as string]: index` on each card wrapper `div` (merge into the existing style-cast pattern). No behavior changes to DnD/read-only paths.
- [X] T007 [US3] Edit `frontend/src/pages/HomePage.tsx` (after T006): pass `enterKey={selectedId ?? undefined}` to `<ChordGrid>`.
- [X] T008 [US3] Implement the entrance animation in `frontend/src/styles/tokens.css` (after T004): `@keyframes chord-enter` (`from { opacity: 0; transform: translateY(8px); }` to neutral); on the chord card wrappers (`.chord-grid > div`, excluding the `.chord-add` tile) `animation: chord-enter var(--motion-enter) ease-out backwards` with `animation-delay: min(calc(var(--enter-index, 0) * var(--motion-enter-step)), 1100ms)`; extend the reduced-motion block (`animation: none` — cards appear instantly).
- [X] T009 [US3] Verify US3 in the browser per quickstart §4 + §7: stagger on refresh and on section switch; with ~10+ entries last card visible ≤1.5s and first card's copy button works while later cards enter; add animates one card only; edit/delete/drag-reorder = zero replay; empty section clean; reduced-motion = instant appearance.

**Checkpoint**: Grid entrance complete; mutations verified non-replaying.

---

## Phase 6: User Story 4 - Text boxes trace their outline on focus (Priority: P3)

**Goal**: Text inputs draw a 2px primary underline left→right on focus while the existing
instant focus ring stays untouched (FR-008..009; contract §4).

**Independent Test**: Click/Tab into any text input — line draws left→right over ~300ms;
focus indication is visible at every instant during fast tabbing; error state remains
distinguishable (quickstart §5).

### Implementation for User Story 4

- [X] T010 [US4] Implement the focus trace in `frontend/src/styles/tokens.css` (after T008): on `.form-control` add the underline layer at rest (`background-image: linear-gradient(var(--color-primary), var(--color-primary))`, `background-repeat: no-repeat`, `background-position: left bottom`, `background-size: 0% 2px`, `transition: background-size var(--motion-trace) linear`) and `background-size: 100% 2px` on `:focus` — do NOT modify the existing `.form-control:focus` border/box-shadow ring (FR-009); extend the reduced-motion block (remove the trace transition — line appears instantly); confirm `.is-invalid` danger border still reads alongside the trace; `@media (forced-colors: active)`: drop the trace layer.
- [X] T011 [US4] Verify US4 in the browser per quickstart §5 + §7: trace direction/duration on login/register/reset/unlock/dialog fields; rapid Tab traversal never shows a focus-less instant; invalid-field focus shows both cues; blur clears cleanly; both themes; reduced-motion = instant line; `.form-select` untouched.

**Checkpoint**: Focus embellishment live with keyboard a11y intact.

---

## Phase 7: User Story 5 - Dialogs zoom in when opened (Priority: P3)

**Goal**: Every VaultModal surface opens with a quick zoom-in + backdrop fade
(FR-010; contract §5).

**Independent Test**: Open the new-section and new-entry dialogs — panel scales 0.94→1
with fade over ~200ms, backdrop fades in; autofocus and Escape/cancel behave exactly as
before (quickstart §6).

### Implementation for User Story 5

- [X] T012 [US5] Implement the dialog zoom in `frontend/src/styles/tokens.css` (after T010): `@keyframes modal-zoom-in` (`from { opacity: 0; transform: scale(0.94); }` to neutral) applied to `.vault-modal` as `animation: modal-zoom-in var(--motion-zoom) ease-out`, and `@keyframes modal-fade-in` (opacity 0→1, 150ms ease-out) on `.vault-modal__backdrop`; extend the reduced-motion block (`animation: none` on both — dialog appears instantly). No `VaultModal.tsx` changes (insertion animation only; no exit animation).
- [X] T013 [US5] Verify US5 in the browser per quickstart §6 + §7: zoom on create/edit section, create/edit entry, and delete-confirmation surfaces; autofocus lands in the first field as before; Escape/cancel mid-zoom closes with no stuck backdrop; reduced-motion = instant appearance; dark theme dialog unaffected.

**Checkpoint**: All five animations implemented.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T014 Audit the cross-cutting guards in `frontend/src/styles/tokens.css` (after T012): the single `@media (prefers-reduced-motion: reduce)` block covers ALL five animations (sweep, glow, enter, trace, zoom) per contract §6; forced-colors and print guards match the contract table; every duration references a `--motion-*` token (no magic numbers); no dead/duplicated hover rules remain from the pre-sweep declarations (e.g. superseded `.chord-add:hover` / `.user-menu__item:hover` washes).
- [X] T015 Run quality gates and scope sweeps from repo root: `npm run typecheck`, `npm run lint`, `npm run build --workspaces --if-present` all green; `git diff --stat backend/ shared/` EMPTY; no `package.json` dependency changes; component diffs limited to `frontend/src/components/ChordGrid.tsx` + `frontend/src/pages/HomePage.tsx`.
- [X] T016 Full quickstart walkthrough (`specs/020-ui-animations/quickstart.md` §2–§8): all five animations, reduced-motion/forced-colors/touch/print degradation, light + dark themes, 320px/768px/1280px responsive sweep with zero animation-caused layout shift or horizontal scroll (SC-001..006).

---

## Dependencies & Execution Order

```text
Phase 2:  T001 (motion tokens)
             │
US1 (P1): T002 → T003                      ┐ tokens.css chain:
US2 (P2): T004 → T005                      │ T001→T002→T004→T008→T010→T012→T014
US3 (P2): T006 [P] → T007;  T008 → T009    │ (apply in this order)
US4 (P3): T010 → T011                      │
US5 (P3): T012 → T013                      ┘
Polish:   T014 → T015 → T016
```

- **Story order**: US1 → US2 → US3 → US4 → US5 (priority order; the tokens.css same-file
  chain makes this the natural sequence anyway).
- **Parallel opportunities**: T006 and T007 (component files) can proceed in parallel with
  ANY tokens.css task — e.g. do T006+T007 while T002/T004 are in review. Verify tasks
  (T003/T005/T009/T011/T013) only need their own story's implementation.
- **Independence**: each story touches disjoint rules; any story can be dropped from the
  release without breaking the others (US3 is the only one with component edits, and its
  `enterKey` prop is optional).

## Implementation Strategy

- **MVP** = Phase 2 + US1 (T001–T003): the app-wide button sweep alone is a shippable,
  visible improvement.
- **Incremental delivery**: each subsequent story is one tokens.css edit (+2 small
  component edits for US3) with its own browser verification — ship in priority order.
- **Constant guardrails**: after every story, hover/focus/open STATES must still change
  under reduced-motion, and no animated property may affect layout.

## Format validation

✅ All 16 tasks use the checklist format: checkbox + sequential ID (T001–T016), `[P]` only
on T006 (sole different-file/no-dependency task), `[US#]` labels on all user-story tasks
and none on Foundational/Polish tasks, and every implementation task names its exact file
path.
