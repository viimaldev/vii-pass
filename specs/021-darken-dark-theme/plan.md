# Implementation Plan: Darker, Less Colorful Dark Theme

**Branch**: `topic/vii-1025-darken-dark-theme` | **Date**: 2026-07-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/021-darken-dark-theme/spec.md`

## Summary

The current dark theme (feature 013) uses a deliberately MEDIUM-gray palette, and the
section-color-driven surfaces (tabs, chord cards, accents from features 014/017) render
at near-full vividness on it — the net effect reads as "gray and colorful" rather than
dark. This feature darkens the dark palette (deeper dark-gray, still not near-black) and
mutes colored elements in dark theme only: section-color ramps are pre-mixed toward a
neutral dark gray before the existing ramp math runs, the primary/action accents are
desaturated, and the decorative page artwork is dimmed more strongly. Light theme is
byte-for-byte unchanged.

Technical approach: **frontend-only, CSS-only, zero new dependencies, zero component/
markup/behavior changes.** Every change lands in the existing
`[data-bs-theme='dark']` override blocks of `frontend/src/styles/tokens.css`:
(1) re-point the dark `--color-*` / `--bs-*` tokens to a deeper palette; (2) add
dark-theme recomputations of the *derived* section-color ramps (`--tab-top/bottom`,
`--chord-header-*`, `--chord-body-*`, `.btn-section` button vars) that mix
`--section-color` toward a neutral gray first (inline `--section-color` itself is set
by components and cannot/need not change); (3) raise the `.page-bg` dim-overlay alpha
and add a dim overlay to the dark home artwork. ThemeProvider, the pre-paint script,
persistence, and all markup are untouched.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) project, but this feature is **CSS-only**
— a single stylesheet edited; no TS/TSX changes expected.

**Primary Dependencies**: Bootstrap 5.3 (CSS only, already installed — `data-bs-theme`
attribute mechanism from feature 013), CSS `color-mix(in srgb, …)` (already used
throughout tokens.css for ramps). **No new dependencies.**

**Storage**: N/A — no data, no API, no localStorage changes (theme persistence key
`vii-pass:theme` unchanged).

**Testing**: No unit tests (Constitution Principle II). Manual verification via
quickstart.md: before/after visual walkthrough in dark theme, WCAG AA contrast
spot-checks of every re-pointed token pair, light-theme no-change regression pass,
320px/tablet/desktop responsive sweep.

**Target Platform**: Modern evergreen browsers (Chrome/Edge/Firefox/Safari) on the
existing Cloudflare Workers single-origin deployment; `color-mix` is supported in all
of them (already a hard dependency since feature 014).

**Project Type**: Web application (monorepo: shared / frontend / backend) — this
feature touches **one frontend file** (`frontend/src/styles/tokens.css`).

**Performance Goals**: Zero runtime cost — token value swaps only; no new selectors
with broad invalidation, no new assets, no measurable bundle growth (<1KB CSS delta).

**Constraints**: Light theme pixel-identical (FR-004 / SC-003); all dark pairs meet
WCAG 2.1 AA ≥4.5:1 (FR-006); hover/focus/selected/disabled states remain visibly
distinct (FR-007); existing forced-colors/print/reduced-motion guards untouched
(FR-008); no near-black backgrounds (spec assumption); no component may start
hardcoding palette values (Constitution III / feature 013 contract).

**Scale/Scope**: ~1 file edited (tokens.css dark blocks), ~10 token re-points, ~4 new
dark-theme ramp override rules, 2 overlay tweaks. No new files in `src/`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|---|---|---|
| I. Code Quality | All changes concentrate in the existing single theming point (the `[data-bs-theme='dark']` blocks of tokens.css) with updated comments documenting the new contrast math; no dead code introduced; lint/format gates run. | PASS |
| II. Testing Standards | No unit tests. Manual quickstart verification only; theming is not a security-critical flow. | PASS |
| III. UX Consistency | The change *strengthens* the token system — colors move only inside token definitions and derived-ramp overrides, never per-component one-offs. WCAG AA re-verified for every changed pair (FR-006). Responsive: palette is layout-independent; quickstart still sweeps 320px→desktop. | PASS |
| IV. Performance | Budget: zero runtime regression, <1KB CSS delta. CSS-variable value changes are O(1); no new assets or listeners. | PASS |
| V. Scalability & Maintainability | Reuses the exact extension point feature 013 designed for ("future themes = token block edits"). YAGNI: no theme-builder, no user-tunable intensity, no per-section dark variants. | PASS |

**Initial gate: PASS — no violations, Complexity Tracking empty.**

**Post-design re-check (after Phase 1): PASS** — design artifacts introduce no new
projects, dependencies, or patterns; the one open spec question (FR-009 chord-card
scope) was resolved in research.md Decision 3 without expanding scope beyond CSS.

## Project Structure

### Documentation (this feature)

```text
specs/021-darken-dark-theme/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/
│   └── dark-theme-ui.md # Phase 1 output — dark-palette UI contract
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   └── styles/
│       └── tokens.css   # ONLY file edited:
│                        #  - [data-bs-theme='dark'] token block (deeper palette)
│                        #  - dark .btn-primary vars (retuned to new palette)
│                        #  - dark .alert--error/.alert--success tints (retuned)
│                        #  - NEW dark ramp overrides: .section-tab / .btn-section
│                        #  - dark .chord-card ramp overrides (muted, per research D3)
│                        #  - dark .page-bg overlay alpha + .page-bg--home overlay
├── index.html           # UNCHANGED (pre-paint script keys off data-bs-theme only)
└── src/theme/           # UNCHANGED (ThemeContext resolution/persistence untouched)

backend/                 # UNTOUCHED
shared/                  # UNTOUCHED
```

**Structure Decision**: Single-file CSS change inside the existing frontend theming
point. Feature 013 established `[data-bs-theme='dark']` blocks in
`frontend/src/styles/tokens.css` as THE place dark appearance is defined; this feature
edits values within (and adds derived-ramp overrides to) those blocks and nothing else.

## Complexity Tracking

> No constitution violations — table intentionally empty.
