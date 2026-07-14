# Implementation Plan: Section Color Theming for Chords & Unified Buttons

**Branch**: `topic/vii-1015-section-color-theming` | **Date**: 2026-07-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-section-color-theming/spec.md`

## Summary

Carry each section's chosen color onto every chord card inside it: the card **header**
becomes a linear gradient blending the section color toward **black in dark theme /
white in light theme**, and the card **body** becomes a linear gradient derived from the
section color in **both** themes (darker blend in dark, lighter blend in light). At the
same time, unify the app-wide **button** design language: no bold labels on any button,
variants distinguished by design/size, buttons keep functional colors (never the section
color).

Technical approach: **frontend-only, CSS-first, zero new dependencies.** The selected
section's color is exposed as the existing `--section-color` CSS custom property — set
inline once on the chord grid container (one line of React) — and `color-mix(in srgb, …)`
gradients in `tokens.css` derive the header/body ramps, with `[data-bs-theme='dark']`
overrides flipping the blend base (the exact pattern the section tabs already use).
Blend ratios are constrained to luminance bands that guarantee WCAG AA text contrast for
*any* pickable section color. Button unification is a small tokens.css block plus the
removal of two `font-weight: 700` declarations. No backend, shared-types, API, or stored
data changes.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), React 18

**Primary Dependencies**: Vite, React Router 6, Bootstrap 5.3 (CSS only), design tokens in `frontend/src/styles/tokens.css` — **no new dependencies**

**Storage**: N/A (no data changes; `Section.color` already stored per feature 006)

**Testing**: No unit tests (Constitution Principle II). Manual quickstart walkthrough + computational contrast audit + browser spot-checks at mobile/tablet/desktop widths.

**Target Platform**: Modern evergreen browsers (Chrome 111+, Edge 111+, Firefox 113+, Safari 16.2+ — the `color-mix()` baseline, already a shipped dependency via the section tabs)

**Project Type**: Web application (monorepo: shared / frontend / backend) — this feature touches **frontend only**

**Performance Goals**: No regression to page-interactive < 2s; theme/section switches re-render gradients in a single paint (pure CSS custom-property resolution, no JS recomputation)

**Constraints**: WCAG 2.1 AA contrast for all card content over gradients for ANY user-choosable section color, both themes; graceful degradation under `forced-colors: active` and `@media print`; responsive/mobile-first (existing card grid layout unchanged)

**Scale/Scope**: 2 frontend files edited (`tokens.css`, `ChordGrid.tsx` or `HomePage.tsx` — one inline style), ~1 small prop addition; app-wide button CSS sweep across ~7 pages/dialogs

**Dependency**: Feature 013 (theme support, `data-bs-theme` attribute + dark token block) lives on **unmerged** branch `topic/vii-1014-theme-support`. This feature's dark-theme behavior builds on it. **Prerequisite: merge feature 013 into this branch (or land its PR on `main` and rebase) before implementation.** Light-theme behavior has no dependency.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Code Quality | CSS additions integrate with existing design tokens (`--section-color`, `color-mix` ramp pattern already established by `.section-tab`); one-line React change; lint/typecheck gates run before done. Dead rules superseded by the new treatment (e.g. 013's flat dark header pin) are removed, not left behind. | PASS |
| II. Testing Standards | No unit tests. Verification = computational contrast audit (same method as 013 T014) + manual quickstart walkthrough of critical visuals. | PASS |
| III. UX Consistency | This feature *strengthens* the design system: one shared gradient mechanism for tabs AND cards; one unified button language replacing ad-hoc bold/size choices. WCAG AA contrast is an explicit FR (FR-004) with audit task. Forced-colors + print guards required (FR-011). Layout untouched → existing responsive behavior preserved; verified at 320px/768px/1280px as part of this story. | PASS |
| IV. Performance | Pure CSS custom properties + `color-mix` — resolved by the style engine, no JS work on theme/section switch. No new assets, no bundle growth beyond ~2KB CSS. | PASS |
| V. Scalability & Maintainability | The `--section-color` variable is already the section-theming API; extending it to cards adds zero new abstractions. Button rules live in one tokens.css block. YAGNI: no theming engine, no per-user customization added. | PASS |

**Initial gate: PASS** — no violations, Complexity Tracking empty.

**Post-design re-check (after Phase 1): PASS** — design artifacts introduce no new
projects, dependencies, or abstractions; the only moving part is CSS variable
inheritance plus one inline style.

## Project Structure

### Documentation (this feature)

```text
specs/014-section-color-theming/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── chord-card-theming.md   # CSS variable API + gradient/contrast contract
│   └── buttons-ui.md           # Unified button design-language contract
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
└── src/
    ├── components/
    │   └── ChordGrid.tsx        # EDIT: accept sectionColor prop; set --section-color
    │                            #       inline on the .chord-grid container
    ├── pages/
    │   └── HomePage.tsx         # EDIT: derive selected section's color from useVault()
    │                            #       (sections + selectedId) and pass it to ChordGrid
    └── styles/
        └── tokens.css           # EDIT: chord-card gradient ramps (light + dark),
                                 #       theme-aware header foreground, unified button
                                 #       block, forced-colors/print guards, de-bolding

backend/   — UNTOUCHED
shared/    — UNTOUCHED
```

**Structure Decision**: Existing web-app monorepo structure is reused as-is. All changes
land in the frontend workspace: two component files gain a tiny color-plumbing change,
and `tokens.css` (the single design-system file mandated by the Constitution) receives
the gradient and button rules. No new files, folders, or modules are created in `src/`.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
