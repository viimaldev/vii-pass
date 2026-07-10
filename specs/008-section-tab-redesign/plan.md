# Implementation Plan: Section Tab Visual Redesign

**Branch**: `topic/vii-1009-section-tab-redesign` | **Date**: 2026-07-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-section-tab-redesign/spec.md`

## Summary

Restyle the existing credential section tab strip to match the reference design
(`specs/designs/tab.png`): overlapping "folder/browser" tabs where each tab tucks **behind**
the tab to its right, each tab has **only its top-right corner rounded**, and each casts a
soft **shadow toward its right edge**. The selected tab is lifted to the front of the
stacking order. This is a **CSS/presentation-only** change to
[frontend/src/styles/tokens.css](../../frontend/src/styles/tokens.css) plus minimal markup
adjustments in [frontend/src/components/SectionTabs.tsx](../../frontend/src/components/SectionTabs.tsx).
No backend, data-model, API, or dependency changes. All existing tab behaviors (select,
double-click edit, drag-reorder, add "+", keyboard) are preserved.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18 (frontend only)

**Primary Dependencies**: React, Bootstrap (CSS utilities), Vite; existing design tokens in
`frontend/src/styles/tokens.css`. No new dependencies.

**Storage**: N/A (no persistence change; section color/name already stored)

**Testing**: No unit tests (per constitution). Manual visual verification against
`specs/designs/tab.png` at mobile/tablet/desktop widths.

**Target Platform**: Modern evergreen browsers (desktop + mobile), served as SPA from the
single-origin Cloudflare Worker.

**Project Type**: Web application (frontend surface only for this feature)

**Performance Goals**: No runtime cost regression; CSS-only styling. Tab strip interactive
< 2s (inherited default). No layout thrash on reorder.

**Constraints**: Presentation-only; must preserve accessibility (tablist/tab roles,
keyboard operability, contrast) and remain responsive/mobile-first (~320px). Overlap must
not clip labels or break horizontal scroll.

**Scale/Scope**: Up to `MAX_SECTIONS` (10) tabs plus the trailing add control; single
component + one stylesheet block.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Code Quality**: PASS — change is scoped to one component + its stylesheet block,
  single responsibility (tab presentation), lint-clean, comments explain the "why" of the
  overlap/stacking technique. No dead code introduced.
- **II. Testing Standards**: PASS — no unit tests required; visual/manual verification of a
  non-security UI flow is appropriate. No new automated tests needed.
- **III. User Experience Consistency**: PASS — uses existing design tokens; delivers
  responsive/mobile-first behavior within this story; preserves WCAG 2.1 AA (tablist/tab
  semantics, keyboard nav, label contrast, tooltip for truncated names). No one-off styles
  outside the tokens stylesheet.
- **IV. Performance Requirements**: PASS — CSS-only, no measurable runtime cost; no
  regression to page-interactive budget.
- **V. Security** (password app): PASS — no data, auth, or crypto changes; purely visual.

**Result**: PASS. No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/008-section-tab-redesign/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (N/A — no data changes; documented)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (UI contract for the tab strip)
│   └── section-tab-ui.md
└── checklists/
    └── requirements.md  # Spec quality checklist (already present)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   └── SectionTabs.tsx        # Tab strip component (minimal markup tweaks if needed)
│   └── styles/
│       └── tokens.css             # .section-tabs / .section-tab* rules restyled here
```

**Structure Decision**: Existing web-application layout. This feature touches only the
frontend presentation layer: the `.section-tabs` / `.section-tab` rule block in
`frontend/src/styles/tokens.css` and, if required for stacking/z-index, small attribute or
inline-style additions in `frontend/src/components/SectionTabs.tsx`. No backend or shared
package changes.

## Complexity Tracking

> No constitution violations. Section intentionally left empty.
