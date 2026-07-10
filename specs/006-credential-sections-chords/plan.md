# Implementation Plan: Credential Sections & Chords

**Branch**: `topic/vii-1007-credential-sections-chords` | **Date**: 2026-07-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-credential-sections-chords/spec.md`

## Summary

Add a per-user credential organizer: color-coded, reorderable **section** tabs (with a
default **Mine** section and a trailing **+** tab that opens a create-section dialog) and,
within each section, reorderable **chord** tiles (with a trailing **add chord** tile that
opens a dialog with placeholder numeric fields 1/2/3). This feature delivers the **layout
and data structure only** — chord contents are placeholders; real credential fields come
later. Data is user-scoped and persisted in MongoDB via two new collections (`sections`,
`chords`), exposed through session-protected Hono routes under `/api/sections` and
`/api/chords`, and rendered by a new React vault surface on `HomePage` built with Bootstrap
(mobile-first). Every user is auto-provisioned a default **Mine** section on first access.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node 22 tooling; ES modules.

**Primary Dependencies**: Backend — Hono on Cloudflare Workers (`nodejs_compat`), official
`mongodb` driver 6, Zod. Frontend — React 18 + Vite + React Router 6, Bootstrap 5.3 (CSS
only; drag-and-drop uses the native HTML5 DnD API — **no new dependency**). Shared — type-only
package `@vii-pass/shared`.

**Storage**: MongoDB Atlas, database `vii_pass` (prod) / `vii_pass_preview` (preview & local
`dev:node`). New collections: `sections`, `chords`.

**Testing**: No unit tests (Constitution Principle II). Manual verification of the flows +
quickstart walkthrough; lint + typecheck gates.

**Target Platform**: Cloudflare Workers (single-origin API + static SPA); modern browsers,
mobile-first from ~320px.

**Project Type**: Web application (existing `backend/` + `frontend/` + `shared/` monorepo).

**Performance Goals**: API p95 < 200ms (constitution default); list endpoints return a
user's full sections/chords in a single round trip. Reorder persists via a small bulk update.

**Constraints**: Per-request MongoDB connection (Workers socket rule — see repo memory);
PBKDF2 unaffected. All section/chord routes require a valid session; strict per-user
isolation (every query filtered by `userId`). CSS integrates with `frontend/src/styles/tokens.css`
design tokens — no one-off styles.

**Scale/Scope**: Personal-scale (tens of sections, hundreds of chords per user). ~2 new
backend routers + 2 services + 2 schemas; 1 rebuilt vault surface + a handful of components;
new shared types.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Code Quality**: PASS — strict typing, shared types as source of truth, TSDoc on
  exported services/routes, lint-clean. New code mirrors existing service/router/schema
  patterns (no new abstractions beyond what auth already established).
- **II. Testing Standards**: PASS — no unit tests added; layout/data feature is not a
  critical security-crypto flow. Session enforcement reuses existing `requireSession`.
- **III. UX Consistency (responsive + mobile-first)**: PASS — Bootstrap grid/utilities +
  tokens.css; section strip is horizontally scrollable on phones, chord tiles reflow in a
  responsive grid; dialogs are accessible modals; keyboard + a11y labels for tabs, dialogs,
  and reorder controls (WCAG 2.1 AA). Delivered within this feature's UI stories.
- **IV. Performance**: PASS — single-round-trip list endpoints; indexed `userId` (+ `sectionId`)
  queries; p95 < 200ms budget. Reorder is a small bulk position update.
- **V. Scalability & Maintainability**: PASS — modular services/routers, stateless
  handlers, env-driven config, user-scoped documents. YAGNI: only layout + placeholder
  chord fields; no sharing/search/delete beyond scope.

**Result**: PASS — no violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/006-credential-sections-chords/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
shared/
└── types/
    └── index.ts               # ADD Section, Chord, and request/response contracts

backend/
└── src/
    ├── index.ts               # EDIT: mount sectionsRouter + chordsRouter behind /api/*
    ├── routes/
    │   ├── sections.ts        # ADD: list/create/reorder sections
    │   └── chords.ts          # ADD: list/create/edit/reorder chords
    ├── services/
    │   ├── sections.service.ts  # ADD: sections collection + default "Mine" provisioning
    │   └── chords.service.ts    # ADD: chords collection, user+section scoped
    └── schemas/
        ├── sections.schema.ts   # ADD: Zod create/reorder schemas
        └── chords.schema.ts     # ADD: Zod create/edit/reorder schemas

frontend/
└── src/
    ├── pages/
    │   └── HomePage.tsx       # REBUILD: vault surface (section tabs + chord grid)
    ├── components/
    │   ├── SectionTabs.tsx        # ADD: color tabs + trailing "+" tab, reorderable
    │   ├── CreateSectionDialog.tsx # ADD: name* + color picker (random default)
    │   ├── ChordGrid.tsx         # ADD: chord tiles + trailing "add chord" tile
    │   ├── ChordCard.tsx         # ADD: single chord tile (show/copy/edit affordances)
    │   └── AddChordDialog.tsx    # ADD: placeholder fields 1/2/3
    ├── services/
    │   └── vaultApi.ts        # ADD: typed client calls for sections/chords
    └── styles/
        └── tokens.css        # EDIT: section-tab + chord-tile styles via tokens
```

**Structure Decision**: Reuse the existing web-app monorepo. Backend follows the
established router → service → schema layering (mirroring `auth`); frontend adds vault
components under `components/` and a `vaultApi` client mirroring `apiClient`/`AuthContext`
patterns. Shared contracts live in `@vii-pass/shared` as the single source of truth.

## Complexity Tracking

> No constitution violations — section intentionally left empty.
