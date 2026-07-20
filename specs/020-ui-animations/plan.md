# Implementation Plan: UI Micro-Animations

**Branch**: `topic/vii-1024-ui-animations` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-ui-animations/spec.md`

## Summary

Add five purely decorative micro-animations app-wide: (1) button hover backgrounds sweep in
right→left over ~500ms, (2) chord cards glow softly on hover, (3) chord cards enter one by
one with a staggered rise-and-fade, (4) text inputs trace an accent line left→right on
focus, and (5) vault dialogs zoom in on open. **Frontend-only, CSS-first, zero new
dependencies, zero backend/shared/API changes.** All motion is implemented in
`frontend/src/styles/tokens.css` (one new "Motion & micro-animations" block plus targeted
edits to existing button/card/input/dialog rules); the only component changes are a
`--enter-index` inline custom property + an `enterKey` remount key in `ChordGrid.tsx` and
one prop pass-through in `HomePage.tsx` to drive the stagger. Every animation is removed
under `prefers-reduced-motion: reduce` and degrades safely in forced-colors/print.

## Technical Context

**Language/Version**: TypeScript 5.x (React 18, Vite) — frontend workspace only

**Primary Dependencies**: React 18, Bootstrap 5.3 (CSS only), existing design tokens in `frontend/src/styles/tokens.css` — **no new dependencies**

**Storage**: N/A (no data changes; purely presentational)

**Testing**: No unit tests (Constitution Principle II). Manual browser verification per quickstart.md (hover/focus/dialog/stagger matrix, reduced-motion emulation, both themes, 320px/768px/1280px)

**Target Platform**: Evergreen desktop + mobile browsers (same support envelope as the shipped app; `color-mix`, CSS `min()`, and CSS animations are already used by features 014/016)

**Project Type**: Web application (monorepo: shared / frontend / backend) — this feature touches `frontend/` only

**Performance Goals**: 60fps motion on baseline hardware; entrance/zoom animate only compositor-friendly `opacity`/`transform`; hover sweep and focus trace animate `background-size` (paint-only, small element areas); no layout-affecting properties animated (zero CLS)

**Constraints**: Stagger fully complete ≤1.5s for any card count (FR-007); hover sweep never delays activation (FR-002); focus indication never momentarily invisible (FR-009); all motion gone under `prefers-reduced-motion: reduce` (FR-011); no behavior/DOM-semantics changes (FR-012)

**Scale/Scope**: 1 CSS file (tokens.css motion block + ~6 existing-rule edits), 2 component files touched (`ChordGrid.tsx`, `HomePage.tsx`), 0 new components, 0 route/API changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Code Quality | CSS lives in the existing design-token stylesheet with intent comments; component edits are two small, typed prop additions; lint/typecheck gates run before done. No dead rules left (superseded hover declarations are edited in place, not duplicated). | PASS |
| II. Testing Standards | No unit tests added (mandated). Verification = manual browser walkthrough (quickstart.md) — appropriate for visual motion. | PASS |
| III. UX Consistency | One shared motion language defined once in tokens.css (shared duration/easing custom properties); WCAG 2.1 AA preserved: focus visibility is never interrupted (FR-009), `prefers-reduced-motion` honored (FR-011, WCAG 2.3.3), no hover-only functionality, forced-colors/print guards mirror existing `.page-bg`/`.spinner` precedent. Responsive: animations are viewport-independent; touch devices get no stuck hover states (hover effects scoped to `:hover` on `@media (hover: hover)` where sticky-tap is a risk). | PASS |
| IV. Performance Requirements | Explicit budget: entrance/zoom = `opacity`/`transform` only (compositor); sweep/trace/glow = paint-only properties on small areas; stagger capped via CSS `min()`; no JS animation loops, no layout thrash. | PASS |
| V. Scalability & Maintainability | Zero new deps; one cohesive CSS block + tokens; component API grows by one optional prop; backend/shared untouched; no speculative abstraction (no animation library, no generic `<Animated>` wrapper). | PASS |

**Post-Phase-1 re-check**: design artifacts introduce no new violations — still PASS. Complexity Tracking table left empty.

## Project Structure

### Documentation (this feature)

```text
specs/020-ui-animations/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (no persistent entities — animation-state model)
├── quickstart.md        # Phase 1 output (manual verification walkthrough)
├── contracts/
│   └── animations-ui.md # UI motion contract (selectors, durations, a11y guarantees)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
└── src/
    ├── components/
    │   └── ChordGrid.tsx        # EDIT: per-card `--enter-index` inline var + `enterKey`
    │                            #       remount key (replays stagger on section switch only)
    ├── pages/
    │   └── HomePage.tsx         # EDIT: pass enterKey={selectedId} to ChordGrid
    └── styles/
        └── tokens.css           # EDIT: new "Motion & micro-animations" block (keyframes,
                                 #       duration/easing tokens, reduced-motion +
                                 #       forced-colors + print guards) and targeted edits to
                                 #       .btn/.chord-add/.user-menu__item (sweep),
                                 #       .chord-card (glow), .form-control:focus (trace),
                                 #       .vault-modal/__backdrop (zoom+fade)

backend/   # UNTOUCHED
shared/    # UNTOUCHED
```

**Structure Decision**: Web-application layout already in place; this feature only edits the
frontend workspace — one stylesheet and two components. No new files outside `specs/`.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
