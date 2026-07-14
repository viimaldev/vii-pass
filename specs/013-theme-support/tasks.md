# Tasks: Theme Support (Auto / Dark / Light)

**Input**: Design documents from `specs/013-theme-support/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/theme-ui.md, quickstart.md

**Tests**: Per the project Constitution (Principle II), NO unit-test tasks are generated. Theme switching is not a security-critical flow, so no integration tests either — verification is manual per quickstart.md, embedded as per-story verify tasks.

**Organization**: Tasks are grouped by user story. This feature is **frontend-only** (zero new deps, zero backend/shared changes): one new provider module, edits to `UserMenu.tsx`, `tokens.css`, `main.tsx`, and `index.html`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Web app monorepo per plan.md — all paths under `frontend/` (backend/ and shared/ are untouched by this feature).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing stack supports the chosen mechanism — no scaffolding or new dependencies are needed.

- [X] T001 Verify `bootstrap` in frontend/package.json is >= 5.3.0 (native `data-bs-theme` dark-mode support is the core mechanism — research.md Decision 1) and confirm no other dependency changes are required; do not upgrade anything unless below 5.3

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The theme provider mechanism that every story consumes — mode state, resolution, and the `data-bs-theme` document projection.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Create `ThemeProvider` in frontend/src/theme/ThemeContext.tsx: export `type ThemeMode = 'auto' | 'dark' | 'light'`; a pure `resolve(mode: ThemeMode): 'light' | 'dark'` implementing the full FR-005 precedence (explicit mode wins → `matchMedia('(prefers-color-scheme: dark)')` → `('(prefers-color-scheme: light)')` → time fallback `getHours() >= 6 && < 18 ? 'light' : 'dark'`, guarded so `matchMedia` absence cannot throw); a context + `useTheme(): { mode, resolved, setMode }` hook (throw if used outside provider, matching the AuthContext pattern); provider holds `mode` in state (initial `'auto'` for now — persistence lands in US3) and an effect that applies the resolved value to `document.documentElement` as `data-bs-theme` AND `style.colorScheme` (contract §2: attribute always `'light'|'dark'`, never `'auto'`). TSDoc all exports
- [X] T003 Mount `ThemeProvider` in frontend/src/main.tsx OUTSIDE `AuthProvider` (wrapping it), so signed-out pages are themed too (plan: theme is auth-independent); update the import block comment if needed

**Checkpoint**: `useTheme` is available app-wide; calling `setMode('dark')` flips `<html data-bs-theme>` — user story implementation can begin.

---

## Phase 3: User Story 1 - Pick a theme from the user menu (Priority: P1) 🎯 MVP

**Goal**: Three icon controls (Auto, Dark, Light) in the user-menu panel replace the inert "Change theme" placeholder; selecting one restyles the entire app instantly (dark = medium-gray palette) with the active choice clearly indicated, identically for both roles.

**Independent Test**: Sign in, open the user menu, click each icon: Dark → medium-gray everywhere instantly, Light → light, active icon visibly marked, menu stays open, no reload (quickstart §2).

### Implementation for User Story 1

- [X] T004 [P] [US1] Add the dark palette block to frontend/src/styles/tokens.css: one `[data-bs-theme='dark']` rule re-pointing ALL existing tokens per research.md Decision 6 table (`--color-bg: #3a3f44`, `--color-surface: #2f3439`, `--color-border: #565e66`, `--color-text: #f0f2f4`, `--color-text-muted: #b8c0c8`, `--color-primary: #66aef0`, `--color-primary-contrast: #0c2d4d`, `--color-danger: #ff8a80`, `--color-success: #57c878`, `--color-focus: #8bc2f5`) plus matching `--bs-*` remaps (`--bs-body-bg/color`, `--bs-border-color`, `--bs-primary(-rgb)`, `--bs-link-color(-rgb)`, `--bs-link-hover-color`, `--bs-danger(-rgb)`) and restated `.btn-primary` hover/active colors for the dark scheme (Bootstrap hardcodes these at build time). Comment the block as the single theming point (components must never hardcode colors — contract §4)
- [X] T005 [US1] In frontend/src/styles/tokens.css add the dark-mode decorative-background treatment (research.md Decision 7): `[data-bs-theme='dark'] .page-bg` layers `linear-gradient(rgba(20, 22, 25, 0.55), rgba(20, 22, 25, 0.55))` over `var(--page-bg-image, none)` and sets a dark `--page-bg-fallback`; verify the existing print/forced-colors guards remain attribute-agnostic (they strip art in both themes) — same file as T004, run after it
- [X] T006 [P] [US1] Rework frontend/src/components/UserMenu.tsx: DELETE the "Change theme" placeholder row and its `paletteIcon`; add three inline Bootstrap-Icons SVGs local to the file (`circle-half`, `moon-fill`, `sun-fill`); add a theme row between the identity header and Log out — a "Theme" label plus three buttons in order Auto, Dark, Light, each `role="menuitemradio"`, `aria-checked={mode === value}`, `aria-label` "Auto theme"/"Dark theme"/"Light theme", icon `aria-hidden`; wire to `useTheme()` — clicking calls `setMode(value)` and the menu STAYS OPEN (contract §3); identical markup for both roles (FR-012)
- [X] T007 [US1] Style the selector in frontend/src/styles/tokens.css within the existing `.user-menu__*` block: `.user-menu__theme-row` (label + group layout inside the 280px-clamped panel), `.user-menu__theme-group`, `.user-menu__theme-btn` with an `[aria-checked='true']` active pill using `rgba(var(--bs-primary-rgb), …)`, visible `:focus-visible` ring, and ≥44px effective targets under the existing `@media (pointer: coarse)` pattern — all via tokens so both palettes work (after T005)
- [X] T008 [US1] Verify US1 per quickstart §2 in the browser (`npm run dev:node`): three icons in order with the placeholder gone; Auto active by default; Dark → medium-gray app-wide instantly (`<html data-bs-theme="dark">`), menu stays open; Light back; consistent across vault + login (after sign-out); selector present and functional for the normal-role username

**Checkpoint**: Theme switching is fully usable — MVP deliverable.

---

## Phase 4: User Story 2 - Auto mode follows the environment (Priority: P2)

**Goal**: Auto resolves from the OS/browser `prefers-color-scheme` when declared (reacting live to changes) and otherwise from local time (06:00-incl → light, 18:00-excl → dark); explicit Dark/Light ignore the environment.

**Independent Test**: In Auto, emulate/flip the OS appearance → app follows live without reload; select Dark and flip again → app stays dark; with no declared preference, appearance matches the 6 AM–6 PM rule (quickstart §3).

### Implementation for User Story 2

- [X] T009 [US2] Add live environment reaction to frontend/src/theme/ThemeContext.tsx (after T002): while `mode === 'auto'`, subscribe `matchMedia('(prefers-color-scheme: dark)').addEventListener('change', …)` to recompute `resolved` (FR-006); when `mode` is explicit, no listener is active so environment changes are ignored (FR-007); additionally run a 60-second `setInterval` re-evaluation ONLY while auto AND the time-fallback branch is in use (neither media query matches), so a 06:00/18:00 boundary crossing updates within a minute (data-model re-evaluation table); clean up listener + timer on mode change and unmount
- [X] T010 [US2] Verify US2 per quickstart §3: DevTools → Rendering → Emulate `prefers-color-scheme` dark/light while in Auto → app updates live, menu still shows Auto as the selected mode; switch to Dark, flip emulation → no change; sanity-check the time fallback branch (emulated no-preference or direct `resolve()` inspection: 05:59→dark, 06:00→light, 17:59→light, 18:00→dark)

**Checkpoint**: Auto behaves per FR-005..007 — default experience correct.

---

## Phase 5: User Story 3 - The choice sticks (Priority: P3)

**Goal**: The chosen mode persists per device across refreshes and sign-in/out (localStorage `vii-pass:theme`), first paint renders the right theme with no flash, absent/invalid values mean Auto, and blocked storage degrades gracefully.

**Independent Test**: Select Dark → refresh loads directly dark (no white flash); sign out/in → still dark; delete the key → Auto; theme change in one tab updates another (quickstart §4).

### Implementation for User Story 3

- [X] T011 [US3] Add persistence to frontend/src/theme/ThemeContext.tsx (after T009): initial `mode` reads `localStorage['vii-pass:theme']`, normalizing anything other than the three literals to `'auto'` (FR-008); `setMode` writes the raw literal (FR-009); ALL storage access wrapped in try/catch so blocked storage keeps selection working in-memory for the visit with no user-facing error (FR-013); never remove the key on sign-out (theme outlives auth — FR-011); add a `storage`-event listener adopting a new value written by another tab (research.md Decision 9)
- [X] T012 [P] [US3] Add the no-flash inline script to frontend/index.html `<head>` BEFORE the module script (research.md Decision 5): ~10 lines, plain ES5-safe JS, reads the key, mirrors the exact resolution rules, sets `document.documentElement.setAttribute('data-bs-theme', …)` + `style.colorScheme`; wrapped so it can NEVER throw (contract §5); add cross-reference comments in BOTH index.html and ThemeContext.tsx binding the duplicated logic
- [X] T013 [US3] Verify US3 per quickstart §4: refresh with Dark stored → loads directly dark with NO white flash; Application → Local Storage shows `vii-pass:theme = dark`; sign out → login page dark → sign back in → dark; delete key + refresh → Auto; second tab follows a theme change made in the first; (optional) blocked-storage incognito check

**Checkpoint**: All three stories complete — full feature behavior per spec.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Contrast/a11y/responsive audits and quality gates.

- [X] T014 Contrast audit per quickstart §5: in Dark mode verify ≥4.5:1 for body text on `--color-bg`, muted text on `--color-surface`, links/buttons/danger text, vault chord-card content, and legibility over the dimmed `.page-bg` art; nudge the dark hex values in frontend/src/styles/tokens.css if any pair fails, staying within the medium-gray constraint (FR-010); quick regression pass in Light mode (must be visually unchanged from before the feature)
- [X] T015 Responsive + a11y spot-check per quickstart §6: 320px viewport — theme row fits the 280px panel, ≥44px touch targets, no horizontal scroll in either theme; keyboard — Tab/Enter/Space through avatar → theme buttons → activation, Escape closes; `menuitemradio` + `aria-checked` announced; focus ring visible on the gray background
- [X] T016 Quality gates + hygiene sweep: `npm run typecheck` (all 3 workspaces), `npm run lint`, `npm run build --workspaces --if-present` all green; grep frontend/src for leftover `paletteIcon` / "Change theme" references (must be zero); confirm `git status` shows NO changes under backend/ or shared/
- [X] T017 Full quickstart.md walkthrough (§1–§6) as a final end-to-end pass in a real browser, including the normal-role account — developer manual check

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: no dependencies — start immediately
- **Phase 2 (Foundational)**: after T001; T002 → T003
- **Phase 3 (US1)**: after Phase 2
- **Phase 4 (US2)**: after Phase 2 (T009 chains on T002 in the same file); independent of US1's files except verification benefits from US1's selector
- **Phase 5 (US3)**: T011 chains on T009 (same file ThemeContext.tsx); T012 independent
- **Phase 6 (Polish)**: after all user stories

### Story dependency graph

```text
T001 → T002 → T003 ─┬─ US1: T004 → T005 → T007 ; T006 ─→ T008
                    ├─ US2: T009 → T010          (T009 same-file after T002)
                    └─ US3: T011 → T013 ; T012   (T011 same-file after T009)
                                     ↓
                    Polish: T014 → T015 → T016 → T017
```

### Same-file chains (do NOT parallelize)

- frontend/src/theme/ThemeContext.tsx: **T002 → T009 → T011**
- frontend/src/styles/tokens.css: **T004 → T005 → T007** (and T014 nudges last)
- frontend/src/components/UserMenu.tsx: T006 only

### Parallel opportunities

- **Within US1**: T004 (tokens.css) ∥ T006 (UserMenu.tsx) — different files
- **Across stories** (after Phase 2): US1's T004/T006 ∥ US2's T009 ∥ US3's T012 — four different files
- **Within US3**: T011 (ThemeContext.tsx) ∥ T012 (index.html)

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. T001–T003 (setup + provider foundation)
2. T004–T008 (palette, selector, verification)
3. **STOP & VALIDATE**: manual theme switching works app-wide → demoable MVP (Auto exists but resolves once at load; no live reaction, no persistence)

### Incremental delivery

1. + US2 (T009–T010): Auto reacts live to the environment
2. + US3 (T011–T013): choice persists, no-flash first paint
3. Polish (T014–T017): contrast, a11y, gates, full walkthrough

---

## Summary

- **Total tasks**: 17
- **Per story**: Setup 1 · Foundational 2 · US1 5 · US2 2 · US3 3 · Polish 4
- **Parallel opportunities**: 4 distinct files enable cross-story parallelism after Phase 2; [P] on T004, T006, T012
- **Independent test criteria**: embedded per story (quickstart §2 / §3 / §4)
- **Suggested MVP**: Phase 1–3 (through T008)
- **Format check**: all tasks use `- [ ] Txxx [P?] [USx?] description + exact file path`; story labels only in US phases ✔
