# Phase 0 Research: Credential Sections & Chords

All Technical Context items were resolvable from existing repo patterns and the spec.
No `NEEDS CLARIFICATION` markers remained. Decisions below record the choices made.

## Decision 1 — Data model: two collections (`sections`, `chords`)

**Decision**: Store sections and chords in two separate MongoDB collections, each document
carrying `userId` (owner). Chords also carry `sectionId`. Ordering is an integer `position`
field per scope (sections ordered per user; chords ordered per section).

**Rationale**: Mirrors the existing `users` service pattern (typed `Collection<Doc>`,
`ObjectId`, per-request `getDb`). Separate collections keep chord lists unbounded without
growing a single section document (avoids the MongoDB unbounded-array anti-pattern) and let
chord reads/edits be scoped efficiently by `{ userId, sectionId }`.

**Alternatives considered**: Embedding chords as an array inside each section document —
rejected because chord counts are open-ended and per-chord edit/reorder churns the whole
parent document; also complicates future per-chord encryption.

## Decision 2 — Ordering strategy: integer `position` with gap-free reindex on reorder

**Decision**: Persist an integer `position` (0-based) per document within its scope. On
reorder, the client sends the full ordered list of ids; the server rewrites positions
0..n-1 in one bulk write.

**Rationale**: Simple, deterministic, and matches the spec ("initially creation order",
then user-customized order persists). Full-list reorder avoids fractional-index drift and
is trivial at personal scale (tens of sections / hundreds of chords).

**Alternatives considered**: Fractional/LexoRank positions (overkill for this scale); a
linked-list `nextId` (harder to query/sort). Rejected for complexity.

## Decision 3 — Default "Mine" section auto-provisioning

**Decision**: On the first authenticated `GET /api/sections` for a user with zero sections,
the service creates the default **Mine** section (position 0, a fixed brand color) before
returning. A `isDefault: true` flag marks it as non-deletable (deletion is out of scope
anyway).

**Rationale**: Guarantees FR-002 (every user always has **Mine**) without a separate
migration or a registration-time hook, and is idempotent. Lazy provisioning keeps the auth
flow untouched.

**Alternatives considered**: Provision during `register` — rejected because it couples an
unrelated router to this feature and misses pre-existing users. A DB migration — unnecessary
for lazy creation.

## Decision 4 — Section color: stored hex string, random default chosen client-side

**Decision**: A section's color is a validated hex string (`#RRGGBB`) stored on the
document. The create-section dialog pre-selects a random color from a curated palette
(client-side); the user may change it via a native `<input type="color">` (with the palette
as quick swatches). The server validates the hex format via Zod.

**Rationale**: Hex is portable, renders directly as a CSS value/token, and validates
cleanly. A curated palette keeps tabs visually distinct and on-brand while satisfying "some
random color is selected by default".

**Alternatives considered**: Server-assigned color — rejected; the spec wants the picker
pre-filled and user-editable. Free-form CSS color names — rejected for validation/consistency.

## Decision 5 — Reordering interaction: native HTML5 drag-and-drop, no new dependency

**Decision**: Implement tab and chord reordering with the native HTML5 Drag and Drop API
plus keyboard-accessible move controls (e.g., move-left/right / move-up/down buttons for a11y).
No `react-dnd`/`dnd-kit` dependency.

**Rationale**: Keeps the dependency surface minimal (consistent with feature 005's
zero-new-deps ethos), works within Bootstrap layout, and lets us meet WCAG 2.1 AA by pairing
drag with keyboard controls. Personal-scale lists don't need a heavy DnD engine.

**Alternatives considered**: `dnd-kit` (nice a11y, but a new dependency + bundle cost) —
deferred; can be revisited if native DnD proves insufficient.

## Decision 6 — Frontend data flow: `vaultApi` client + local state on the vault page

**Decision**: Add a typed `vaultApi.ts` (mirroring `apiClient.ts`) with `credentials:
'include'`. `HomePage` fetches sections + chords on mount, holds them in local React state,
and applies optimistic updates for create/reorder with reconciliation from the server
response.

**Rationale**: Consistent with the existing `apiClient`/`AuthContext` approach; no global
store needed for a single surface. Optimistic updates keep the UI responsive within the
p95 budget.

**Alternatives considered**: Introduce React Query / a global store — rejected as
over-engineering (YAGNI) for one page.

## Decision 7 — Dialogs: accessible modal pattern using existing tokens

**Decision**: Build the create-section and add-chord dialogs as accessible modals
(`role="dialog"`, `aria-modal`, focus trap, Esc-to-close), styled with Bootstrap utilities +
tokens.css, reusing the app's own JS (as UserMenu already does — no Bootstrap JS/popper).

**Rationale**: Matches the repo's established choice to avoid Bootstrap's JS bundle and hand-roll
small interactive widgets, while meeting a11y requirements.

**Alternatives considered**: Bootstrap's modal JS — rejected to stay consistent with the
CSS-only Bootstrap usage already documented in repo memory.

## Decision 8 — Chord placeholder fields

**Decision**: For now a chord stores three placeholder fields named `field1`, `field2`,
`field3` (the "1, 2, 3" from the spec), each an optional string. The UI renders them as a
generic tile with show/copy/edit affordances. The concrete credential schema is deferred.

**Rationale**: Satisfies "add dummy chords / layout only" while giving the persistence layer
a stable, forward-compatible shape that a future feature can extend or migrate.

**Alternatives considered**: Storing an opaque `data` blob — rejected; named fields make the
current UI and future migration clearer.
