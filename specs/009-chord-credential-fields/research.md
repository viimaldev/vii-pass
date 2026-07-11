# Research: Chord Credential Fields

**Feature**: 009-chord-credential-fields | **Date**: 2026-07-11

No `NEEDS CLARIFICATION` markers remained in the Technical Context (the spec's single
clarification — uniqueness scope — was resolved by the user: **per section**). The
decisions below settle the remaining design unknowns.

## Decision 1 — Chord field storage shape: typed `fields` array (length 3)

**Decision**: Store the three option rows as a fixed-length array
`fields: { type: ChordFieldType; value: string | null }[]` (exactly 3 entries) on the
chord document and in the shared `Chord` type, replacing `field1/field2/field3`.
`ChordFieldType = 'username' | 'email' | 'password' | 'other' | 'otherSensitive'`.

**Rationale**: The rows are homogeneous (same type options, same value rules) and
positional — an array models that directly, lets the frontend `map()` rows, keeps Zod
validation to one row schema (`z.array(rowSchema).length(3)`), and centralizes any
future row-count change in one place. A row left unused keeps its selected `type` with
`value: null`, so edit round-trips preserve the user's dropdown choices exactly.

**Alternatives considered**:
- *Six flat fields (`row1Type`, `row1Value`, …)* — mirrors the old placeholder style but
  triples schema/UI wiring and invites copy-paste drift between rows. Rejected.
- *Sparse array (only filled rows stored)* — smaller documents but breaks the spec's
  "exactly three rows" form model and complicates edit pre-fill (which slot was which?).
  Rejected.
- *Separate `chord_fields` collection* — over-normalized for a bounded, always-embedded
  trio; violates YAGNI and the schema-design guidance to embed bounded one-to-few data.
  Rejected.

## Decision 2 — Duplicate-title enforcement: normalized shadow field + unique index + service check

**Decision**: Store `titleNormalized` (title → `trim()` → `toLowerCase()`) alongside the
display `title`. Enforce uniqueness per `{ userId, sectionId }` two ways: (a) a service
pre-check (`findOne` on the triple, excluding the chord's own `_id` on update) that
throws a friendly `409 { code: 'chord_title_taken' }`, and (b) a compound unique index
`{ userId: 1, sectionId: 1, titleNormalized: 1 }` as the race-proof backstop (duplicate
key error also mapped to the same 409).

**Rationale**: Matches FR-001/FR-002 exactly (case-insensitive, whitespace-trimmed, per
section, self-conflict excluded on rename). The pre-check yields a precise, actionable
message; the unique index guarantees correctness under concurrent saves — the same
belt-and-braces pattern already used for usernames (feature 004). A normalized shadow
field is simpler and more portable than a case-insensitive collation index (collation
must be specified identically on every query; easy to miss and Workers-side driver code
stays simpler without it).

**Alternatives considered**:
- *Collation-based unique index (`strength: 2`)* — avoids the shadow field but requires
  collation on the index **and** every uniqueness query, and doesn't handle whitespace
  trimming; more fragile. Rejected.
- *Service check only, no index* — a concurrent double-submit could slip a duplicate in.
  Cheap to prevent; rejected.
- *Vault-wide uniqueness* — explicitly ruled out by the user's clarification (Option A).

## Decision 3 — URL handling: normalize to https, allow-list http(s), open with `noopener`

**Decision**: In the Zod schema: trim; empty → `null`; if the value lacks a scheme,
prepend `https://`; then it must parse via `new URL()` with protocol `http:` or
`https:` — anything else (including `javascript:`, `data:`, `file:`) is rejected with an
actionable message. Store the normalized absolute URL (≤ 2048 chars). On the card, the
title becomes an `<a href={url} target="_blank" rel="noopener noreferrer">`; the copy-link
button copies the stored URL string.

**Rationale**: Satisfies the spec's "scheme-less URLs are treated as secure web
addresses" assumption and SC-006 (opens correct destination, never navigates the vault).
The scheme allow-list is the critical security control for a stored-link feature in a
password manager (blocks stored-XSS-via-`javascript:` URLs — OWASP A03); `noopener
noreferrer` prevents reverse-tabnabbing from the opened site. Normalizing at the API
boundary (server-side) means the client can trust `chord.url` as safe to render into
`href` — with the same normalization mirrored client-side for instant form feedback.

**Alternatives considered**:
- *Store raw input, validate on render* — every consumer must re-validate; one missed
  spot = XSS. Rejected.
- *Regex-only validation* — `new URL()` parsing is stricter and standard; regexes for
  URLs are notoriously leaky. Rejected.
- *`window.open()` in a click handler* — an anchor gives native link semantics (cursor,
  middle-click, a11y role) that the spec's "link cursor on hover" asks for. Rejected.

## Decision 4 — Type icons: shared inline-SVG metadata module, no icon dependency

**Decision**: Add `frontend/src/components/chordFieldTypes.tsx` exporting a
`CHORD_FIELD_TYPES` record keyed by `ChordFieldType`, each entry providing `label`
(e.g. "Other sensitive"), `isSensitive` (true for `password`/`otherSensitive`), and an
inline SVG `icon` (Bootstrap Icons path data: `person`, `envelope`, `key`, `tag`,
`shield-lock`). Both `AddChordDialog` (dropdown labels) and `ChordCard` (row icons)
consume this single source of truth. Icons are `aria-hidden` with the type name provided
as visually-hidden text / `title` for screen readers.

**Rationale**: Zero new dependencies (constitution/YAGNI; the repo already inlines
Bootstrap-Icon SVG paths, e.g. the trash icon in `AddChordDialog`). One module keeps
icon↔type↔sensitivity mapping consistent between form and card (FR-008) and makes the
"defined icons for each option" requirement reviewable in one place.

**Alternatives considered**:
- *Install `bootstrap-icons` / `react-icons`* — adds a dependency + bundle weight for 5
  icons. Rejected.
- *Emoji icons (like the current 👁/⧉)* — inconsistent cross-platform rendering and
  poor contrast control; the existing emoji eye/copy buttons will also be migrated to
  inline SVGs on the card for visual consistency. Rejected.

## Decision 5 — Placeholder data: drop, don't migrate

**Decision**: No data migration. The developer clears placeholder-era chord documents
(`db.chords.drop()` in `mongosh`, dev/preview and prod) before/at deploy; the new unique
index is created lazily by the service on first use, exactly like the existing index
bootstrapping. The old `{ userId, sectionId, position }` non-unique index is recreated
automatically on the fresh collection.

**Rationale**: The spec explicitly assumes placeholder chords are temporary and not
preserved; `field1/2/3` cannot be meaningfully mapped to titled/typed rows (no title
exists → would violate FR-001). Dropping the collection also clears the old index
definitions in one step. Mirrors the feature-004 precedent (drop legacy `email_1` index).

**Alternatives considered**:
- *Auto-migrate `field1`→title* — fabricates titles from secret-ish placeholder data and
  still can't infer row types; risks junk titles violating uniqueness. Rejected.
- *Lazy in-code migration on read* — permanent complexity for explicitly disposable data.
  Rejected.

## Decision 6 — Copy & reveal interactions: extend the existing card patterns

**Decision**: Keep `navigator.clipboard.writeText` with the existing transient
"copied" state, but surface **failure** feedback too (brief inline "Copy failed" state)
per the spec edge case, replacing today's silent catch. Reveal state stays local
`useState` per card keyed by row index — unmounting (section switch, reload, edit close)
naturally resets to masked (FR-012). Copying a masked value uses the in-memory
`chord.fields[i].value` directly — no reveal required.

**Rationale**: Minimal delta over the proven `ChordCard` implementation; local state
guarantees "always starts masked" without any global store. Clipboard failure feedback
closes the FR-011 gap in the current code.

**Alternatives considered**:
- *`document.execCommand('copy')` fallback* — deprecated; the app already requires a
  secure context (HTTPS/localhost) where the async Clipboard API works. Rejected.
- *Global reveal store with auto-remask timer* — nice-to-have hardening, but not in the
  spec and adds state complexity; the per-render masking guarantee is already met.
  Rejected (possible future feature).

## Decision 7 — API surface: unchanged routes, changed payloads

**Decision**: Keep the existing endpoints and verbs exactly —
`GET/POST /api/sections/:sectionId/chords`, `POST …/chords/reorder`,
`PATCH /api/chords/:chordId`, `DELETE /api/chords/:chordId` — changing only request and
response bodies to the new shape (`title`, `url`, `fields`). `PATCH` accepts the full
editable shape (title/url/fields); reorder and delete are untouched.

**Rationale**: The resource model (chords in sections) is unchanged; only the entity's
attributes changed. Reusing routes keeps `HomePage`/`vaultApi` wiring and session
middleware exactly as-is, minimizing blast radius.

**Alternatives considered**:
- *New versioned routes (`/api/v2/chords`)* — versioning for a pre-release app with
  discarded data is pure ceremony. Rejected.
