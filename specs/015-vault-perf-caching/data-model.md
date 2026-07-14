# Data Model: Vault Performance — Single Upfront Load & Client Caching

**Feature**: 015-vault-perf-caching | **Date**: 2026-07-14

No database schema changes. This feature adds one wire-level aggregate type and
reshapes the client's in-memory state. `Section` and `Chord` (shared/types) are
unchanged.

## Wire types (shared/types/index.ts)

### VaultResponse (NEW)

The complete organizer for the authenticated user, returned by `GET /api/vault`.

| Field | Type | Notes |
|---|---|---|
| `sections` | `Section[]` | All of the user's sections, sorted by `position` ascending. Lazy "Mine" provisioning applies exactly as `GET /api/sections` (a first-time user receives one default section). |
| `chords` | `Chord[]` | ALL of the user's chords across every section, flat, sorted by `(sectionId, position)`. Each chord carries its `sectionId`. `url` / `fields[].value` are Level-1 envelopes (`v1.l1.*`), `null`, or the `"v1.err"` sentinel — identical semantics to the retired per-section list. |

Invariants:

- Every `chords[].sectionId` refers to a section present in `sections`.
- Within one `sectionId`, `position` values are 0..n-1 with no gaps or duplicates.
- Titles and field `type`s are plaintext; secret values are never plaintext on the wire.

### Removed / retained response types

- `ChordsResponse` — **retained**: still the response of `POST /api/sections/:id/chords/reorder`.
- No request types change; no mutation payloads change.

## Backend (no collection changes)

- `sections`, `chords` collections: schemas, indexes, and every mutation path are
  untouched.
- New service function `listAllChords(env, userId): Promise<Chord[]>` — one
  `find({ userId })` sorted `{ sectionId: 1, position: 1 }` (prefix of the existing
  `{userId, sectionId, position}` index), mapped through the existing `toPublicChord`
  L2-unwrap projection (per-field `"v1.err"` isolation preserved).
- Removed: `listChords(env, userId, sectionId)` service function and the
  `GET /api/sections/:sectionId/chords` route (dead after this feature — research D5).

## Client state model (frontend/src/vault/VaultContext.tsx)

The provider remains the single owner and single crypto boundary. Memory-only (FR-006).

### Held state

| Name | Kind | Content | Lifecycle |
|---|---|---|---|
| `sections` | `useState<Section[]>` | All sections, position-sorted | Set by the single vault load; updated in place by section mutations; cleared on sign-out/401 |
| `allChords` | `useState<Chord[]>` (NEW, replaces per-section `chords`) | ALL chords, **decrypted** (plaintext or `VALUE_LOCKED` / `VALUE_UNREADABLE` sentinels) | Set by decrypting the vault load; updated in place by chord mutations; re-derived from the envelope cache on unlock; cleared on sign-out/401 |
| `envelopesRef` | `useRef<Chord[]>` (NEW) | ALL chords exactly as received (L1 envelopes) — never exposed via context | Set by the vault load; kept in sync by chord mutations (responses carry envelopes); source for unlock re-decrypt; cleared on sign-out/401 |
| `selectedId` | `useState<string \| null>` | Selected section id | Unchanged |
| `loading` / `ready` / `error` | as today | `loading` now covers the whole vault load (sections + chords) | `chordsLoading` no longer fires on section switch |

### Derived (not fetched)

- `chords` (the context value consumed by `HomePage`/`ChordGrid`):
  `useMemo` → `allChords.filter(c => c.sectionId === selectedId)` sorted by
  `position`. **Zero network on selection change** (FR-002).

### Context value — public shape compatibility

`VaultContextValue` keeps every existing member (`sections`, `selectedId`, `chords`,
`loading`, `chordsLoading`, `error`, `ready`, `vaultLocked`, actions). Consumers
(`Layout`, `HomePage`, `ChordGrid`, dialogs) require **no changes**; `chordsLoading`
simply stays `false` after the initial load.

### State transitions

| Event | Transition |
|---|---|
| Sign-in / page load with session | `loading=true` → `GET /api/vault` → envelopes cached → decrypt all with current key (or `VALUE_LOCKED` if locked) → `sections`/`allChords` set → `ready=true`, `loading=false` |
| Section switch | `selectedId` changes → derived `chords` recomputes. No fetch, no loading state |
| Unlock (vaultKey null → key) | Re-decrypt `envelopesRef` → replace `allChords`. No fetch (FR-008) |
| Create chord | 1 POST → response merged (identity/position from response + typed plaintext) into `allChords`; envelope copy appended to `envelopesRef` |
| Edit chord | 1 PATCH → same merge, replacing the matching id in both stores |
| Delete chord | 1 DELETE → remove id from both stores |
| Reorder chords | Optimistic local order → 1 POST → apply response `position`s to existing decrypted chords + envelope cache (do NOT replace values with response envelopes — research D4) |
| Create/edit/reorder section | As today (1 request, `sections` updated from response) |
| Delete section | 1 DELETE → remove section from `sections` AND its chords from both chord stores (cascade mirror) |
| Mutation failure | Existing error messages; local stores keep/restore server-consistent data (FR-005) |
| Sign-out / 401 | `sections=[]`, `allChords=[]`, `envelopesRef=[]`, `selectedId=null`, `ready=false` (FR-006) |
| Browser refresh | All memory discarded by the platform → full fresh load (FR-003) |
