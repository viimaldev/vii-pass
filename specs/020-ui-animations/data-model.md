# Data Model: UI Micro-Animations

**Feature**: specs/020-ui-animations | **Date**: 2026-07-20

This feature is purely presentational: **no database collections, no API payloads, no
shared types, and no persisted client state change.** The "model" below documents the
transient UI state each animation reads and the invariants that hold.

## Entities

### AnimationTokens (CSS custom properties — stylesheet constants)

Defined once in `frontend/src/styles/tokens.css`; not user data.

| Token | Value | Consumed by |
|-------|-------|-------------|
| `--motion-sweep` | 500ms | Button hover sweep transition |
| `--motion-glow` | 500ms | Chord card glow transition |
| `--motion-enter` | 300ms | `chord-enter` keyframes duration |
| `--motion-enter-step` | 60ms | Per-card stagger delay unit |
| `--motion-trace` | 300ms | Input focus underline sweep |
| `--motion-zoom` | 200ms | `modal-zoom-in` duration (backdrop fade 150ms) |

**Invariant**: `min(index × --motion-enter-step, 1100ms) + --motion-enter ≤ 1.5s` (FR-007).

### ChordEnterIndex (transient, per render)

- **Source**: array position of each chord in `ChordGrid`'s `chords` prop.
- **Representation**: inline CSS custom property `--enter-index: <number>` on each card
  wrapper `div`.
- **Lifecycle**: recomputed every render; only has a visible effect when the wrapper is a
  NEW DOM node (CSS animations fire on insertion).

### EnterKey (transient, per section)

- **Source**: `selectedId` from `VaultContext`, passed by `HomePage` as a new optional
  `enterKey` prop on `ChordGrid`.
- **Representation**: React `key` on the `.chord-grid` container element.
- **Transitions**:
  - `enterKey` changes (section switch) → container remounts → all cards are new DOM
    nodes → full staggered entrance replays.
  - `enterKey` stable + chord added → one new node → that card alone animates in.
  - `enterKey` stable + edit/delete/reorder → nodes reused by chord `id` key → **no**
    entrance replay (FR-007).

### Hover / focus / open states (browser-native)

| State | Owner | Animated response |
|-------|-------|-------------------|
| `:hover:not(:disabled)` on `.btn`/`.chord-add`/`.user-menu__item` | Browser | Sweep layer `background-size` 0%→100% (right-anchored) |
| `:hover` on `.chord-card` | Browser | Glow `box-shadow` fade in/out |
| `:focus` on `.form-control` | Browser | Underline `background-size` 0%→100% (left-anchored); instant ring unchanged |
| `VaultModal` mount | React | `modal-zoom-in` + backdrop fade on insertion |

No React state, refs, effects, timers, or context changes are introduced anywhere except
the `enterKey` prop plumbing described above.

## Validation rules

- `--enter-index` MUST be a non-negative integer (array index — guaranteed by construction).
- `enterKey` is optional; when absent, `ChordGrid` behaves exactly as today except the
  initial mount still plays the entrance (initial vault load case).
- All animated properties MUST be non-layout-affecting (`opacity`, `transform`,
  `background-size`, `box-shadow`) — enforced by the contract, verified in quickstart.

## Out of scope

- No changes to `Section`, `Chord`, `PublicUser`, sessions, or any backend document.
- No new persisted browser state (localStorage/sessionStorage/IndexedDB untouched).
