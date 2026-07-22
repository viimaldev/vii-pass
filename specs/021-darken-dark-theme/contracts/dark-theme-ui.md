# UI Contract: Dark Theme Palette (Darker & Muted)

**Feature**: 021-darken-dark-theme | **Date**: 2026-07-21
**Supersedes**: the dark-palette values of feature 013's theme contract (the medium-gray
palette and its documented contrast pairs). Feature 013's *mechanism* contract
(`data-bs-theme` attribute, ThemeProvider, pre-paint script, persistence) is unchanged
and remains authoritative.

## Scope

Applies ONLY under `[data-bs-theme='dark']`. Light theme (`:root` values) is
byte-for-byte unchanged — any light-theme rendering difference is a contract violation.

## C1 — Base surfaces are deep dark-gray, never near-black

- Page background (`--color-bg`) and surface (`--color-surface`) move to a deep
  dark-gray palette (indicative: bg ≈ `#26292d`, surface ≈ `#1e2226`; exact values
  fixed at implementation).
- MUST NOT be pure black or near-black (`#000`–`#121212` band is reserved for the
  dialog header/footer lattice bands, which stay the darkest element).
- Every surface pair (page vs. card vs. menu vs. dialog vs. input) MUST remain
  visually distinguishable (border and/or luminance step).

## C2 — Every text/background pair meets WCAG 2.1 AA

- Body text, muted text, link/primary text, error text, success text, button labels,
  and placeholder text MUST measure ≥4.5:1 against their actual rendered background.
- The focus ring (`--color-focus`) MUST remain clearly visible against all darkened
  surfaces (≥3:1 non-text contrast).
- The changed pairs MUST be re-documented in the tokens.css block comment with their
  measured ratios (same convention feature 013 established).

## C3 — Section colors render muted through `--section-color-muted`

- Components continue to set raw `--section-color` inline; they MUST NOT pre-mute it.
- Dark theme derives `--section-color-muted: color-mix(in srgb, var(--section-color)
  ~70%, <neutral dark gray>)` locally on `.section-tab`, `.chord-card`, and
  `.btn-section`, and every dark ramp/fill derived from the section color MUST consume
  the muted variable, not the raw one.
- Selected vs. unselected tabs MUST remain clearly distinguishable for any section
  color, including vivid (pure red/lime) and very dark (near-black) picks.
- Light-theme ramp rules are untouched and continue to consume raw `--section-color`.

## C4 — Chord cards: muted, still light contrast bands (resolves spec FR-009)

- Card interiors remain LIGHT bands in dark theme (clearly lighter than the page) with
  the feature-014 pinned dark interior tokens and `--chord-header-fg` unchanged.
- Dark-theme header/body ramps are rebuilt from `--section-color-muted` and mix toward
  off-white (≈`#e9eaec`) instead of pure white — measurably less vivid, slightly less
  glaring.
- The AA contrast-band guarantee holds for the worst case (near-black section color):
  interior dark text ≥4.5:1 on the deepest band.

## C5 — Decorative artwork recedes harder

- `.page-bg` dark overlay alpha increases (≈0.55 → ≈0.72).
- `.page-bg--home` (dark artwork) gains a dim overlay (≈0.45) — previously none.
- Artwork files under `/backgrounds/*` are NOT edited; the swap-a-file contract
  (feature 005) is preserved.

## C6 — States stay legible

- Hover, focus-visible, active, selected, disabled, and busy treatments MUST remain
  visibly distinct on the darker palette for: `.btn` variants, `.btn-section`,
  section tabs, `.chord-add`, user-menu items, theme radios, form controls, and
  in-card icon buttons.
- Error and success indications MUST remain immediately recognizable despite muting.

## C7 — Out of scope / must not change

- ThemeContext resolution (Auto/Dark/Light, matchMedia, time fallback), the
  `vii-pass:theme` storage key, and the `index.html` pre-paint script.
- Forced-colors, print, and reduced-motion guard rules.
- All markup/TSX, backend, shared types.
- Both roles (admin/normal) see the identical palette.

## Verification

Manual, per quickstart.md: dark-theme before/after walkthrough (SC-001), contrast
measurements (SC-002/C2/C4), light-theme regression pass (SC-003/C7), full-flow
walkthrough at 320px/tablet/desktop (SC-004).
