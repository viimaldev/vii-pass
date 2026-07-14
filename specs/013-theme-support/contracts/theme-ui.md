# Contract: Theme UI, Persistence & Resolution

**Feature**: specs/013-theme-support | **Date**: 2026-07-14

There are **no HTTP API changes** in this feature. The externally observable
contracts are: the user-menu selector UI, the localStorage persistence format, and
the document-level theming attribute that all CSS keys off.

---

## 1. Persistence contract (localStorage)

| Item | Value |
|---|---|
| Key | `vii-pass:theme` |
| Values | exactly `auto` \| `dark` \| `light` (raw string, no JSON) |
| Absent / invalid | treated as `auto` (FR-008) |
| Written | only on user selection (FR-009) |
| Cleared | never by the app (survives sign-out — FR-011) |
| Storage unavailable | selection works in-memory for the visit; next visit = auto; **no user-facing error** (FR-013) |

Multi-tab: writers rely on atomic localStorage semantics; readers listen to the
`storage` event and adopt the new value live.

## 2. Document contract (what CSS may depend on)

| Guarantee | Detail |
|---|---|
| `document.documentElement.dataset.bsTheme` | always `'light'` or `'dark'` (the **resolved** appearance, never `'auto'`) after the inline head script runs — i.e., before first paint |
| `color-scheme` style on `<html>` | matches `data-bs-theme` |
| Stability | no other element carries a theme attribute; components MUST key styling off tokens (`--color-*`) or `[data-bs-theme='dark']`, never off JS state |

Resolution precedence (normative, FR-005):

1. `mode == 'dark' | 'light'` → that value, environment ignored (FR-007).
2. `mode == 'auto'` + declared `prefers-color-scheme` → follow it, live (FR-006).
3. `mode == 'auto'` + no declared preference → device-local time: `06:00 ≤ t < 18:00`
   → light, else dark. Boundary crossings reflected within 60s while the app is open.

## 3. User-menu selector contract (UserMenu panel)

Replaces the feature-012 "Change theme" placeholder row (FR-002). Everything else in
the panel (identity header, logout row, open/close behavior, 280px clamp) is
unchanged.

### Structure

```text
user-menu__panel (role="menu")
├── identity header                       (unchanged)
├── theme row:  "Theme" label + 3 icon buttons, order: Auto, Dark, Light
│   ├── button role="menuitemradio" aria-checked aria-label="Auto theme"  [circle-half icon]
│   ├── button role="menuitemradio" aria-checked aria-label="Dark theme"  [moon-fill icon]
│   └── button role="menuitemradio" aria-checked aria-label="Light theme" [sun-fill icon]
└── Log out row                           (unchanged)
```

### Behavior

| Aspect | Contract |
|---|---|
| Order | Auto, Dark, Light — left to right (FR-002) |
| Selected state | exactly one button has `aria-checked="true"` + a visible active style (FR-003); default = Auto when nothing stored (FR-008) |
| Activation | click / Enter / Space applies the theme **immediately**, no reload (FR-004); the menu **stays open** |
| Icons | inline Bootstrap-Icons SVGs local to UserMenu.tsx (`circle-half`, `moon-fill`, `sun-fill`), `aria-hidden="true"`; accessible name via `aria-label` |
| Roles | identical presence/behavior for admin and normal sessions (FR-012) |
| Touch | ≥44px effective target on coarse pointers |
| Keyboard | buttons are tabbable menu items; visible `:focus-visible` ring in both themes |

### CSS (tokens.css, no one-off styles)

New classes under the existing `.user-menu__*` block: `.user-menu__theme-row`,
`.user-menu__theme-group`, `.user-menu__theme-btn` (+ `[aria-checked='true']` active
style using `rgba(var(--bs-primary-rgb), …)`). All colors via tokens so both palettes
work automatically.

## 4. Dark palette contract (tokens.css)

A single `[data-bs-theme='dark']` block re-points the existing custom properties —
consuming components MUST NOT hardcode colors:

- `--color-bg` medium gray (`#3a3f44`-family, NOT near-black — FR-010), `--color-surface`,
  `--color-border`, `--color-text`, `--color-text-muted`, `--color-primary` (lightened
  for AA on gray), `--color-primary-contrast`, `--color-danger`, `--color-success`,
  `--color-focus`.
- Matching `--bs-body-bg`, `--bs-body-color`, `--bs-border-color`, `--bs-link-color(-rgb)`,
  `--bs-primary(-rgb)`, `--bs-danger(-rgb)` remaps + `.btn-primary` hover/active restated.
- `.page-bg` gains a dark dimming gradient layered over `--page-bg-image` and a dark
  `--page-bg-fallback`; artwork files unchanged; print/forced-colors guards unchanged.

**Contrast acceptance**: normal text ≥ 4.5:1 against its background in BOTH palettes
(FR-010 / SC-005), spot-checked per quickstart §5.

## 5. No-flash contract (index.html)

An inline `<script>` in `<head>` (before the Vite module) mirrors the resolution
rules and sets `data-bs-theme` synchronously. Requirements:

- Must never throw (try/catch around localStorage; bare `matchMedia` guarded).
- Must produce the same result as `ThemeContext.resolve` for identical inputs — a
  cross-reference comment in both files binds them.
- No user-visible flash of the wrong theme on load with a stored `dark` preference
  (SC-002/SC-003).
