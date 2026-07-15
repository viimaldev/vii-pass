# Implementation Plan: Button Style Unification & Section-Color Primary Actions

**Branch**: `topic/vii-1018-button-style-unification` (spec dir `017-button-style-unification`) | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-button-style-unification/spec.md`

## Summary

A frontend-only visual refresh of the button language: every rectangular action button
app-wide adopts the section-tab silhouette (only the upper-right corner rounded,
`border-radius: 0 20px 0 0`), the entry create/edit dialog's primary button is filled
with the active section's color (with a contrast-adaptive label), all button fills
become fully opaque, button-row gaps widen by one spacing step, and in dark theme the
eye/copy controls on chord cards adopt the edit icon's hover wash. Zero new
dependencies, zero backend/shared/API changes. This feature **deliberately supersedes**
feature 014's "buttons never adopt `--section-color`" rule for exactly one button (the
entry dialog primary) — `specs/014-section-color-theming/contracts/buttons-ui.md` gets
an annotation, and this feature ships its own v2 button contract.

## Technical Context

**Language/Version**: TypeScript 5.x (React 18, Vite) — frontend workspace only

**Primary Dependencies**: React 18, Bootstrap 5.3 (CSS only), existing design tokens in `frontend/src/styles/tokens.css`. No new dependencies.

**Storage**: N/A — purely presentational; no data, API, or schema changes

**Testing**: No unit tests (Constitution Principle II). Manual browser verification via quickstart.md (both themes, 320/768/1280px)

**Target Platform**: Modern evergreen browsers (Chromium, Firefox, Safari); `color-mix()` already a baseline requirement since feature 014

**Project Type**: Web application (monorepo: frontend / backend / shared) — this feature touches `frontend/` only

**Performance Goals**: No regression; CSS-only restyle + one tiny pure function. No new network requests, no layout thrash

**Constraints**: WCAG 2.1 AA label contrast (≥4.5:1) for ANY user-chosen section color on the section-colored primary button; button heights and feature-016 spinner alignment unchanged; light-theme eye/copy hover pixel-identical (FR-008); forced-colors/print degrade gracefully

**Scale/Scope**: ~6 frontend files edited + 1 tiny new module; 1 CSS file carries most of the change. Surfaces: login, register, reset (3 steps), home vault, entry dialog, section dialog, user menu

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|---|---|---|
| I. Code Quality | CSS integrates with existing token system in tokens.css (no one-off styles); new contrast helper is a small documented pure function; lint/typecheck gates apply | PASS |
| II. Testing Standards | No unit tests added; manual quickstart verification only (matches constitution) | PASS |
| III. UX Consistency | This feature IS a consistency feature: one button language everywhere; AA contrast enforced for arbitrary section colors via adaptive label color; responsive verification at 320/768/1280 included per story; keyboard focus ≥ hover visibility (FR-009) | PASS |
| IV. Performance | No measurable impact — static CSS + O(1) color computation at dialog render | PASS |
| V. Scalability & Maintainability | Button language centralized in one tokens.css block + one contract doc; supersession of 014's rule is explicit and documented, not silent drift | PASS |

**Violations**: none. Complexity Tracking table remains empty.

*Post-Phase-1 re-check (after contracts/design below): still PASS — no new violations introduced by the design.*

## Project Structure

### Documentation (this feature)

```text
specs/017-button-style-unification/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (no entities — records that fact)
├── quickstart.md        # Phase 1 output (manual verification walkthrough)
├── contracts/
│   └── buttons-ui.md    # v2 unified button language (supersedes 014's buttons-ui.md)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── styles/
│   │   └── tokens.css                    # EDIT: button shape block, .btn-section, gap,
│   │                                     #   opaque fills, dark eye/copy hover
│   ├── components/
│   │   ├── AddChordDialog.tsx            # EDIT: primary → .btn-section + inline vars;
│   │   │                                 #   cancel → solid gray .btn-secondary
│   │   ├── SectionDialog.tsx             # EDIT: cancel → solid gray .btn-secondary
│   │   └── colorContrast.ts              # NEW: readable label color for a hex bg (WCAG)
│   └── vault/
│       └── VaultContext.tsx              # EDIT: pass sectionColor to AddChordDialog

specs/014-section-color-theming/
└── contracts/buttons-ui.md               # EDIT: supersession annotation → 017

backend/   — untouched
shared/    — untouched
```

**Structure Decision**: Existing web-app monorepo layout; all changes land in the
`frontend/` workspace. The button language continues to live in a single labeled block
of `frontend/src/styles/tokens.css` (the feature-014 block is amended in place), keeping
one source of truth.

## Design Decisions (Phase 0 summary — details in research.md)

1. **Shape**: one rule in the tokens.css button block — `.btn`, `.chord-add`, and
   `.user-menu__item` take `border-radius: 0 20px 0 0` (identical corner + curvature to
   `.section-tab`). Circular controls (avatar, badge, color swatches) and small
   icon-only controls (eye/copy/edit, theme radios, dialog header icons) are explicitly
   OUT of shape scope — documented in the contract.
2. **Section-colored primary**: new `.btn-section` class consumed only by the entry
   dialog's submit button. `VaultContext` (which renders the dialog) passes the active
   section's color (add → selected section; edit → the chord's own section). The button
   sets `--section-color` and `--section-color-fg` inline; CSS provides an opaque
   fill, a `color-mix` darkened hover/active, and the label color comes from the new
   `readableTextColor()` helper (white vs. dark by WCAG relative luminance → guarantees
   ≥4.5:1 for any hex).
3. **Opaque fills**: cancel buttons switch `btn-outline-secondary` → solid gray
   `btn-secondary`; the translucent `rgba(...)` tints on `.section-tab--add`,
   `.chord-add`, and `.user-menu__theme-btn[aria-checked]` become opaque `color-mix(...,
   var(--color-bg))` equivalents (same perceived color, no alpha).
4. **Gap**: `.vault-modal__footer` gap `var(--space-2)` → `var(--space-3)` (one spacing
   step; the only surface where two+ buttons sit side by side).
5. **Dark eye/copy hover**: `[data-bs-theme='dark'] .chord-field__btn:hover/:focus-visible`
   adopts the edit icon's exact wash — `color-mix(in srgb, var(--color-text) 16%,
   transparent)` (identical to `.chord-card__icon-btn`'s `--chord-header-fg` wash, since
   both resolve to the pinned `#1b1f24` inside `.chord-card`). Light theme rule
   untouched (FR-008).
6. **014 supersession**: annotate `specs/014-section-color-theming/contracts/buttons-ui.md`
   ("buttons never adopt --section-color" now has exactly one sanctioned exception);
   this feature's own `contracts/buttons-ui.md` is the successor contract.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
