# Implementation Plan: User Menu Redesign

**Branch**: `topic/vii-1013-user-menu-redesign` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-user-menu-redesign/spec.md`

## Summary

Restyle the opened account-menu panel (`UserMenu`) to relieve congestion: a roomier
identity header (circular initial badge — no photo — beside a large bold display name
with the username smaller and muted underneath), a divider, then icon-led menu rows —
a new non-functional "Change theme" placeholder row and the existing Logout action now
with a leading icon. Frontend-only: no API, data-model, or dependency changes. Icons
are inline Bootstrap-Icons SVGs following the established `chordFieldTypes.tsx`
pattern; styling extends the existing `.user-menu__*` classes in
`frontend/src/styles/tokens.css` using design tokens.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) — React 18 frontend only; backend untouched

**Primary Dependencies**: React, react-router-dom, Bootstrap 5 (CSS only) — **no new dependencies**; icons are inline Bootstrap-Icons SVG paths (existing repo pattern)

**Storage**: N/A — no data changes; `PublicUser { id, username, displayName, role }` already provides everything the menu needs

**Testing**: No unit tests (constitution). Manual verification of the menu at mobile/tablet/desktop widths + keyboard walkthrough

**Target Platform**: Modern evergreen browsers (same as the rest of the SPA)

**Project Type**: Web application (frontend change only)

**Performance Goals**: No regression — pure CSS/markup restyle of an already-mounted component; zero network or bundle-size impact beyond a few inline SVG paths

**Constraints**: WCAG 2.1 AA (keyboard operability, menu semantics, contrast via design tokens); panel must not overflow at ~320px; touch-friendly row heights (≥40px); no one-off styles — extend `tokens.css`

**Scale/Scope**: 1 component ([UserMenu.tsx](../../frontend/src/components/UserMenu.tsx)) + 1 stylesheet block ([tokens.css](../../frontend/src/styles/tokens.css)); ~100 LOC delta

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | ✅ PASS | Single-responsibility restyle of one component; TSDoc comments updated; lint/format clean required before done |
| II. Testing Standards | ✅ PASS | No unit tests added (mandated); manual verification of logout flow (the only security-adjacent path, unchanged logic) |
| III. UX Consistency | ✅ PASS | Uses existing design tokens + `.user-menu__*` conventions; inline Bootstrap-Icons SVGs match `chordFieldTypes.tsx` iconography; responsive/mobile-first behavior delivered in-story (FR-008); keyboard + menu semantics preserved (FR-007) |
| IV. Performance | ✅ PASS | Pure markup/CSS change; budget = no measurable impact (no new requests, no new deps) |
| V. Scalability & Maintainability | ✅ PASS | No architecture change; "Change theme" placeholder is a plain menu row — a clean extension point for the future theme feature without speculative plumbing (YAGNI) |

**Post-Phase-1 re-check**: ✅ PASS — design introduces no new violations (no new deps, no data changes, no one-off styles).

## Project Structure

### Documentation (this feature)

```text
specs/012-user-menu-redesign/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (UI contract — no API changes)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
└── src/
    ├── components/
    │   └── UserMenu.tsx        # MODIFIED — panel header layout, icon-led rows,
    │                           #   "Change theme" placeholder row, inline SVG icons
    └── styles/
        └── tokens.css          # MODIFIED — extend the `.user-menu__*` block:
                                #   header, badge, name/username typography, row
                                #   spacing/icon alignment
```

**Structure Decision**: Existing web-application layout is unchanged. Only two frontend
files are touched; backend, shared types, routes, and services are untouched.

## Complexity Tracking

> No constitution violations — table intentionally empty.

## Design Notes (implementation guidance)

- **Panel header**: `.user-menu__header` — horizontal flex: a 40px circular
  `.user-menu__badge` (reuses the avatar-button visual language: `--color-primary`
  background, white bold initial) beside a text column: `.user-menu__name`
  (`~1.05rem`, `font-weight: 700`) over `.user-menu__id` (small, `--color-text-muted`,
  `text-break` for long values). Bordered bottom (existing `border-bottom` divider
  pattern) with `--space-3` padding.
- **Menu rows**: keep Bootstrap `.dropdown-item` but add `.user-menu__item` for
  icon+label flex layout (`gap: var(--space-2)`; `min-height: 40px` touch target;
  vertical padding `--space-2`).
- **Icons**: inline Bootstrap-Icons paths, `aria-hidden="true"` — `palette`/`palette-fill`
  for Change theme, `box-arrow-right` for Log out. Defined as small local `ReactElement`
  constants inside `UserMenu.tsx` (only used here; no need to generalize —
  `chordFieldTypes.tsx` stays chord-specific).
- **"Change theme" row**: a real `<button role="menuitem">` for correct focus order and
  a11y, with an intentionally empty click handler (brief comment referencing FR-006);
  activating it does not close the menu or navigate.
- **Order**: header → divider → Change theme → Log out (spec FR-005).
- **Existing behaviors preserved untouched**: outside-click/Escape close, busy state
  ("Signing out…"), redirect to `/login`, `aria-haspopup`/`aria-expanded` on trigger,
  panel right-anchoring and `max-width: min(280px, calc(100vw - var(--space-4)))`
  viewport clamp.
