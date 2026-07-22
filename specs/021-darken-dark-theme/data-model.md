# Data Model: Darker, Less Colorful Dark Theme

**Feature**: 021-darken-dark-theme | **Date**: 2026-07-21

This feature is a purely visual (CSS token) change. **No data entities, collections,
API payloads, or client-side storage shapes are added or modified.**

## Existing entities touched: none

| Store | Change |
|---|---|
| MongoDB (all collections) | none |
| API request/response payloads | none |
| localStorage `vii-pass:theme` (`'auto' \| 'dark' \| 'light'`) | unchanged — same key, same values, same semantics (feature 013) |
| sessionStorage / IndexedDB | none |

## Design-token "model" (CSS custom properties, for reference)

The only state this feature changes is the *values* of the dark-theme design tokens
and derived ramp variables in `frontend/src/styles/tokens.css`:

- **Palette tokens** (`--color-bg`, `--color-surface`, `--color-border`,
  `--color-text`, `--color-text-muted`, `--color-primary`,
  `--color-primary-contrast`, `--color-danger`, `--color-success`, `--color-focus`)
  — dark-theme values re-pointed to a deeper, less saturated palette
  (research.md Decision 1). Light-theme (`:root`) values untouched.
- **Bootstrap remaps** (`--bs-body-*`, `--bs-primary*`, `--bs-link-*`, `--bs-danger*`)
  — follow the palette tokens.
- **New derived variable** `--section-color-muted` — declared only inside dark-theme
  rules on `.section-tab` / `.chord-card` / `.btn-section`; computed from the
  component-supplied inline `--section-color` (research.md Decision 2). Never set by
  components, never persisted.
- **Derived ramps** (`--tab-top`, `--tab-bottom`, `--chord-header-top/bottom`,
  `--chord-body-top/bottom`, `.btn-section` `--bs-btn-*`) — dark-theme overrides
  recomputed from `--section-color-muted`.

No state transitions, no validation rules, no migrations.
