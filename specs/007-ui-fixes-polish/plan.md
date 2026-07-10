# Implementation Plan: UI Fixes & Polish

**Branch**: `topic/vii-1008-ui-fixes-polish` | **Date**: 2026-07-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-ui-fixes-polish/spec.md`

## Summary

A focused presentation-and-validation polish pass over existing surfaces — no new data
model, no new routes. Seven fixes: (1) set the browser title to **Vii Pass**; (2) remove
the app header from the login/signup pages and show a **Vii Pass** brand line atop each auth
card; (3) show the decorative background behind a **~40% translucent** header on
authenticated surfaces and give the Add/Edit Chord dialog a **white ~40% translucent**
surface; (4) replace the fixed 450px chord width with a **min 350px, space-filling** fluid
grid (no trailing empty space); (5) move chord delete to an **icon-only control in the edit
dialog header** and require a **confirmation** before deleting; (6) constrain section tabs to
**100–150px** with ellipsis + tooltip on overflow; (7) reject **duplicate section names**
(case-insensitive, trimmed) with a clear message. All frontend changes integrate with the
existing `frontend/src/styles/tokens.css` tokens/Bootstrap bridge; the single backend change
adds a uniqueness guard in the sections service.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node 22 tooling; ES modules.

**Primary Dependencies**: Backend — Hono on Cloudflare Workers (`nodejs_compat`), official
`mongodb` driver 6, Zod. Frontend — React 18 + Vite + React Router 6, Bootstrap 5.3 (CSS
only). No new dependencies.

**Storage**: MongoDB Atlas, database `vii_pass` (prod) / `vii_pass_preview` (preview & local
`dev:node`). Existing `sections` / `chords` collections — no schema change.

**Testing**: No unit tests (Constitution Principle II). Manual verification per quickstart;
lint + typecheck gates. Duplicate-section rejection is a non-crypto validation, so no
integration test required.

**Target Platform**: Cloudflare Workers (single-origin API + static SPA); modern browsers,
mobile-first from ~320px.

**Project Type**: Web application (existing `backend/` + `frontend/` + `shared/` monorepo).

**Performance Goals**: Unchanged. No new round trips; duplicate check is one indexed
`findOne` on `{ userId }` within the existing create path (API p95 < 200ms).

**Constraints**: CSS-only translucency (rgba/`color-mix`) with foreground content kept fully
opaque to preserve WCAG 2.1 AA contrast; the header remains legible over the CSS fallback
color where no background art exists. Duplicate detection matches the project's username
convention (case-insensitive, whitespace-trimmed). Header/background translucency must not
place backgrounds in the a11y tree or intercept focus/pointer (feature 005 rule).

**Scale/Scope**: ~1 backend service edit (+ error surface), ~1 CSS token/rule block, and a
handful of small component edits (`index.html`, `Layout`, `LoginPage`, `RegisterPage`,
`AddChordDialog`, `SectionTabs`, chord grid CSS). No new source files expected beyond docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Code Quality**: PASS — small, single-responsibility edits reusing existing patterns
  (service validation, token-driven CSS). Strict typing preserved; the delete confirmation
  reuses the existing dialog. No dead code or new abstractions.
- **II. Testing Standards**: PASS — no unit tests added; changes are presentation +
  one non-crypto validation. Manual quickstart verification covers the flows.
- **III. UX Consistency (responsive + mobile-first)**: PASS — every change is verified at
  ~320px / tablet / desktop. Translucency keeps foreground contrast AA-compliant; section
  tooltips and the icon-only delete keep accessible labels; confirmation prevents
  destructive accidents. All styling flows through design tokens (no one-off styles).
- **IV. Performance**: PASS — no new endpoints/round trips; duplicate check is a single
  indexed query in the existing create path. CSS-only visual changes.
- **V. Scalability & Maintainability**: PASS — background/translucency driven by CSS custom
  properties (art swaps without code change); duplicate rule lives in the service layer,
  the single source of truth for section writes.

**Result**: PASS — no violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/007-ui-fixes-polish/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── sections-create.md
└── checklists/
    └── requirements.md  # (created by /speckit.specify)
```

### Source Code (repository root)

```text
frontend/
├── index.html                          # <title> → "Vii Pass"
└── src/
    ├── components/
    │   ├── Layout.tsx                   # header background + translucency; brand "Vii Pass"
    │   ├── SectionTabs.tsx              # min/max width + ellipsis + tooltip (title attr)
    │   └── AddChordDialog.tsx           # icon-only delete in header + confirm; translucent surface
    ├── pages/
    │   ├── LoginPage.tsx                # no header context / brand line on card
    │   └── RegisterPage.tsx             # no header context / brand line on card
    └── styles/
        └── tokens.css                   # translucent header/dialog, fluid chord grid, section tab bounds

backend/
└── src/
    └── services/
        └── sections.service.ts          # duplicate-name guard in createSection
```

**Structure Decision**: Existing web-app monorepo. This feature edits existing files only;
the sole backend change is a uniqueness guard in `sections.service.ts`. Auth pages already
render without the protected shell — the fix ensures no header chrome and adds the brand
line. Header/dialog translucency and the chord grid live in `tokens.css` (token-driven, no
one-off styles).

## Complexity Tracking

> No Constitution violations — section intentionally left empty.
