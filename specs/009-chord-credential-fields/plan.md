# Implementation Plan: Chord Credential Fields

**Branch**: `topic/vii-1010-chord-credential-fields` | **Date**: 2026-07-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-chord-credential-fields/spec.md`

## Summary

Replace the placeholder chord shape (`field1/2/3`) with real credential fields: a
mandatory **Title** (unique per section, case-insensitive), an optional hidden **URL**
(clickable title opens it in a new tab; a copy-link button sits just before the edit
button), and exactly **three typed option rows** — each a type selector
(`username | email | password | other | otherSensitive`) paired with a text value.
The chord card renders each filled row as *type icon + value*; sensitive types
(`password`, `otherSensitive`) are masked with an eye (reveal/hide) + copy control,
non-sensitive types get copy only. Changes span all three workspaces: `shared` types,
backend Zod schemas + `chords.service.ts` (title uniqueness, URL normalization),
and the frontend `AddChordDialog` / `ChordCard` components. **No migration** — existing
placeholder chords are discarded (developer drops the `chords` collection per
[quickstart.md](quickstart.md)). No new dependencies (inline SVG icons, native clipboard).

## Technical Context

**Language/Version**: TypeScript 5.x everywhere — React 18 + Vite (frontend), Hono on
Cloudflare Workers with `nodejs_compat` (backend), shared types workspace.

**Primary Dependencies**: Existing only — Hono, official `mongodb` driver v6, Zod
(backend); React, React Router, Bootstrap CSS (frontend). **No new dependencies**;
type icons are inline SVGs (Bootstrap Icons path data), matching the existing
inline-SVG pattern in `AddChordDialog`/`VaultModal`.

**Storage**: MongoDB Atlas, existing `chords` collection — document shape changes to
`{ userId, sectionId, position, title, titleNormalized, url, fields[3], createdAt, updatedAt }`.
New compound unique index `{ userId: 1, sectionId: 1, titleNormalized: 1 }` for
duplicate-title race safety. Placeholder-era documents are dropped, not migrated.

**Testing**: No unit tests (Constitution Principle II). Gates: `npm run typecheck`
(3 workspaces) + `npm run lint` + `npm run build --workspaces --if-present`. Manual
verification of copy/reveal/open-link flows per quickstart.

**Target Platform**: Modern evergreen browsers (mobile ~320px → desktop) served as SPA
from the single-origin Cloudflare Worker; API on Workers runtime.

**Project Type**: Web application (frontend + backend + shared types).

**Performance Goals**: Inherited defaults — API p95 < 200ms (per-request Mongo connect
already the accepted tradeoff on Workers), page interactive < 2s. Copy feedback < 1s
(SC-002). Duplicate-title check is one indexed `findOne` — negligible.

**Constraints**: Security-first (password manager): URL restricted to `http(s)` only
(reject `javascript:`/`data:` schemes); new-tab opens with `rel="noopener noreferrer"`;
sensitive values never rendered unmasked by default; all queries user-scoped. WCAG 2.1
AA: labelled controls, keyboard operable, `aria-pressed` on reveal toggles.
Responsive/mobile-first per Constitution III.

**Scale/Scope**: Single-user vaults, ≤ ~10 sections × modest chord counts; 3 fixed rows
per chord. Field limits: title ≤ 100, value ≤ 200 (unchanged), URL ≤ 2048 chars.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Code Quality**: PASS — edits stay within the existing router → service → schema
  layering (backend) and the existing dialog/card components (frontend); each module keeps
  a single responsibility. Placeholder code (`field1/2/3` types, labels, TSDoc) is fully
  removed, not left dead. Lint/format gates enforced.
- **II. Testing Standards**: PASS — no unit tests added. Copy/reveal/duplicate-rejection
  are verified manually via quickstart; typecheck/lint/build are the CI gates.
- **III. User Experience Consistency**: PASS — reuses `VaultModal`, existing
  `.chord-card` token-based styles, Bootstrap form controls, and the established
  copy/reveal interaction pattern. Responsive + touch-friendly delivered in-story
  (FR-016, SC-005). Actionable, human-readable errors (duplicate title, invalid URL).
- **IV. Performance Requirements**: PASS — one extra indexed `findOne` per chord save;
  no new render cost beyond three icon SVGs per card. Budgets inherited and unaffected.
- **V. Scalability & Maintainability**: PASS — no new services or config; the typed
  `fields` array is the well-defined extension point if row counts ever change (YAGNI:
  fixed at 3 now). Stateless handlers unchanged.
- **Security (password app)**: PASS with note — values continue to be stored using the
  vault's existing at-rest approach (spec Assumption: strengthening at-rest encryption is
  an explicitly separate future feature). URL scheme allow-list + `noopener` prevent
  injection/tab-nabbing. No secrets in code; input validated at the API boundary with Zod.

**Result**: PASS. No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/009-chord-credential-fields/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── chords-api.md    # Revised chord REST contract
│   └── chord-card-ui.md # Chord card + form UI contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (complete)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
shared/
└── types/
    └── index.ts                    # EDIT: Chord, ChordFieldType, ChordField,
                                    #   Create/UpdateChordRequest (title/url/fields)

backend/
└── src/
    ├── schemas/
    │   └── chords.schema.ts        # EDIT: title/url/fields Zod schemas, URL normalization
    ├── services/
    │   └── chords.service.ts       # EDIT: ChordDoc shape, titleNormalized unique index,
    │                               #   duplicate-title 409, create/update/list projection
    └── routes/
        └── chords.ts               # EDIT: TSDoc only (paths/verbs unchanged)

frontend/
└── src/
    ├── components/
    │   ├── AddChordDialog.tsx      # EDIT: title + URL inputs, 3 type/value rows,
    │   │                           #   duplicate/URL error display
    │   ├── ChordCard.tsx           # EDIT: linked title, per-type icon rows,
    │   │                           #   masked/eye/copy vs copy-only, copy-link button
    │   └── chordFieldTypes.tsx     # ADD: type metadata (label, icon SVG, isSensitive)
    ├── pages/
    │   └── HomePage.tsx            # EDIT: pass-through of new save payload (minor)
    └── styles/
        └── tokens.css              # EDIT: chord-card row/icon/link styles (token-based)
```

**Structure Decision**: Web application layout (existing npm workspaces monorepo:
`shared` + `backend` + `frontend`). All changes are edits to existing files except one
new frontend module `chordFieldTypes.tsx` centralizing the five option-type definitions
(label, icon, sensitivity) so the dialog and the card render from one source of truth.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
