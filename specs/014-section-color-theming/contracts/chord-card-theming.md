# UI Contract: Chord Card Section-Color Theming

**Feature**: specs/014-section-color-theming | **Date**: 2026-07-14

This contract defines the visual API for section-colored chord cards. It binds the CSS
in `frontend/src/styles/tokens.css` and the color plumbing in
`frontend/src/components/ChordGrid.tsx` / `frontend/src/pages/HomePage.tsx`.

## Input contract

| Input | Source | Requirement |
|-------|--------|-------------|
| `--section-color` | Inline style on the `.chord-grid` container, set by `ChordGrid` from its `sectionColor` prop (provided by `HomePage` from vault context) | MUST equal the *currently selected* section's stored `color` (6-digit hex). MUST update in the same React commit that swaps the chord list (FR-006). MUST fall back to `var(--color-primary)` when absent (defensive default, mirrors `.section-tab`). |
| Active theme | `data-bs-theme` attribute on `<html>` (feature 013) | **The card interior is THEME-INVARIANT** (post-implementation user decision): the same light ramps and pinned light-palette tokens apply under both `light` and `dark` — only the page around the card adapts to the theme. |

## Rendering contract

### Header (`.chord-card__header`)

- Background: `linear-gradient(to bottom, var(--chord-header-top), var(--chord-header-bottom))`.
- **Both themes** (theme-invariant): both stops are
  `color-mix(in srgb, var(--section-color) P%, #ffffff)` with `P` ∈ **[25, 45]**.
  Foreground `--chord-header-fg` = `#1b1f24` (pinned light-palette text, via the
  card-scoped `--color-text`).
- The title (plain or link), copy-link/edit icon buttons, their hover washes, and the
  title-link focus outline MUST all derive from `--chord-header-fg` — no hardcoded
  white/black foregrounds remain in header rules.

### Body (`.chord-card__body`)

- Background: `linear-gradient(to bottom, var(--chord-body-top), var(--chord-body-bottom))`
  applied so the whole card interior below the header is covered (the card's
  `background` may host it instead of the body element, provided the header paints over it).
- **Both themes** (theme-invariant): stops mix `--section-color` toward white at
  ≤ **18%** color. All tokens the card interior consumes (`--color-text`,
  `--color-text-muted`, `--color-danger`, `--color-surface`, `--color-bg`,
  `--color-focus`) are re-pinned to their light-palette values on `.chord-card` so
  dark-theme token flips never produce light-on-light text.
- Body text, muted text, field icons, masked dots, per-field error text, and in-row
  eye/copy buttons keep their existing token-driven colors and MUST remain AA-readable
  over the body gradient.

### Contrast guarantees (FR-004, SC-005)

For **every** value `--section-color` can legally take (any 6-digit hex):

| Pair | Minimum ratio |
|------|---------------|
| Header foreground vs. any header gradient stop | ≥ 4.5:1 |
| Body text (pinned `#1b1f24`) vs. any body gradient stop | ≥ 4.5:1 |
| Muted text (pinned `#57606a`) vs. any body stop | ≥ 4.5:1 |
| Danger error text vs. any body stop | ≥ 4.5:1 |
| Focus outline vs. adjacent gradient background | ≥ 3:1 (non-text) |

The blend percentage bands above are the mechanism; the audit task MUST verify the
extremes (`#000000`, `#ffffff`, `#ff0000`, `#00ff00`, `#ffff00`) computationally (the
same light ramps apply in both themes) and tighten the bands if any pair fails. Band
values in this contract update to the audited finals.

### Degradation (FR-011)

- `@media (forced-colors: active)`: gradient backgrounds yield to the forced palette;
  header/body foregrounds map to system colors; focus indicators remain visible.
- `@media print`: gradients removed or reduced so all card text prints legibly.

## Behavioral invariants (FR-005, FR-006, FR-010)

- Theme switch (including Auto resolution flips) restyles all visible cards with **no
  JavaScript executed by this feature** — pure CSS re-resolution.
- Section switch never shows a card painted with the previous section's color.
- No card functionality changes: reveal, copy, link opening, edit, drag reorder, locked
  and read-only states behave byte-for-byte as before.
- The default "Mine" section is themed identically via its stored color (FR-003).

## Out of scope (unchanged surfaces)

- Section tabs keep their existing `--tab-top`/`--tab-bottom` ramp.
- The add-chord tile (`.chord-add`) and add-section tab keep faint-primary styling —
  they are buttons and MUST NOT adopt `--section-color` (see buttons-ui.md).
- Dialogs, pages, and the user menu receive no section coloring.
