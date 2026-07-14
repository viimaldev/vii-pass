# Phase 0 Research: Theme Support (Auto / Dark / Light)

**Feature**: specs/013-theme-support | **Date**: 2026-07-14

No `NEEDS CLARIFICATION` markers existed in the Technical Context; research below
locks in the technology choices and resolves the design unknowns.

---

## Decision 1: Theme application mechanism — `data-bs-theme` attribute + token overrides

**Decision**: Apply the resolved appearance by setting `data-bs-theme="light" | "dark"`
on the document element (`<html>`). Re-theme our own design system with a single
`[data-bs-theme='dark'] { --color-*: … }` override block in
`frontend/src/styles/tokens.css`.

**Rationale**:
- Bootstrap 5.3 (already installed, CSS-only) ships **native dark-mode support keyed
  on exactly this attribute** — every Bootstrap component we use (cards, forms,
  navbar `bg-body-tertiary`, dropdown-items, `text-muted`/`text-body-secondary`)
  re-themes automatically with zero per-component work.
- All custom vii-pass CSS already reads `--color-*` tokens from `:root`. Because
  `[data-bs-theme='dark']` on `<html>` has higher specificity than `:root`,
  re-pointing the same custom properties in one block re-themes **every** custom
  component (vault cards, dialogs, user menu, alerts) without touching their rules —
  the design-token architecture pays off directly (Constitution III).
- One attribute = one source of truth; trivially inspectable in DevTools.

**Alternatives considered**:
- **CSS class on `<body>`** (`.theme-dark`): works for our tokens but does NOT
  activate Bootstrap's dark variables — we'd hand-restyle every Bootstrap component.
  Rejected.
- **Two compiled stylesheets swapped at runtime**: doubles CSS payload, flash risk,
  build complexity. Rejected.
- **`color-scheme`/`light-dark()` CSS only**: cannot express the explicit-override or
  time-of-day rules (pure CSS can't ignore `prefers-color-scheme` conditionally).
  Rejected as the primary mechanism; we DO set the `color-scheme` property alongside
  so native widgets (scrollbars, form controls) match.

## Decision 2: Auto resolution — `matchMedia` with time-of-day fallback

**Decision**: In Auto mode, resolve via `window.matchMedia('(prefers-color-scheme: dark)')`:
- `.matches === true` → dark; else if `matchMedia('(prefers-color-scheme: light)').matches` → light.
- If **neither** matches (media feature unsupported / `no-preference`) → time
  fallback: `const h = new Date().getHours(); h >= 6 && h < 18 ? 'light' : 'dark'`
  (06:00 inclusive → light, 18:00 exclusive → dark, device-local clock, per spec).
- Subscribe with `mql.addEventListener('change', …)` while mode is `auto` so an OS
  appearance flip updates the app live (FR-006); listener removed when an explicit
  mode is chosen (FR-007).
- Time-boundary crossings: re-evaluate on a coarse timer (`setInterval`, 60s) active
  **only** when mode is auto AND the fallback branch is in use. Spec only requires
  reflection "no later than the next page load or user interaction", so a 60s poll
  comfortably exceeds the requirement at negligible cost.

**Rationale**: `prefers-color-scheme` + `matchMedia` change events are supported by
every evergreen browser; the fallback branch fully satisfies the user's "light in day
time, dark in night, 6AM–6PM" rule when no preference is detectable.

**Alternatives considered**:
- **Time rule first, system preference second**: contradicts the spec's stated
  precedence (system/browser preference wins when declared). Rejected.
- **`setTimeout` scheduled exactly at the next 06:00/18:00 boundary**: precise but
  more code (drift, sleep/wake edge cases) for a requirement that only demands
  next-load/next-interaction freshness. Rejected (YAGNI).

## Decision 3: Persistence — `localStorage`, per device, no account sync

**Decision**: Store the mode under key **`vii-pass:theme`** with literal values
`'auto' | 'dark' | 'light'`. Absent/unparseable value → `auto`. All reads/writes
wrapped in `try/catch`: when storage throws (privacy mode, blocked), selection still
works for the current visit via in-memory state and the next visit falls back to auto
(FR-013).

**Rationale**: The spec scopes the preference to the device (FR-009, Story 3
scenario 4). `localStorage` is synchronous — critical for the pre-paint inline script
(Decision 5). Sign-out must NOT clear it (theme applies to signed-out pages, FR-011),
so it deliberately lives outside the auth lifecycle — unlike the vault key in
IndexedDB, nothing security-sensitive is stored (a theme name is not secret).

**Alternatives considered**:
- **Account-synced (MongoDB `users` field + API)**: cross-device sync was explicitly
  ruled out of scope in the spec's assumptions; would add backend surface, migration,
  and a flash-of-wrong-theme until `/me` resolves. Rejected.
- **Cookie**: sent to the server on every request for no reason. Rejected.
- **IndexedDB**: async — unusable before first paint. Rejected.

## Decision 4: State management — dedicated `ThemeProvider` context

**Decision**: New `frontend/src/theme/ThemeContext.tsx` exporting `ThemeProvider` and
`useTheme(): { mode, resolved, setMode }` where `mode: 'auto'|'dark'|'light'` and
`resolved: 'light'|'dark'`. The provider owns: initial read from localStorage,
`data-bs-theme` + `color-scheme` side effects, the matchMedia listener, and the
fallback timer. Mounted in `main.tsx` **outside** `AuthProvider` (theme is
auth-independent — signed-out pages are themed too).

**Rationale**: Mirrors the repo's established context pattern (`auth/AuthContext`,
`vault/VaultContext`); single responsibility; UserMenu consumes it with one hook.

**Alternatives considered**:
- **Module-level singleton + custom event**: less idiomatic in this codebase, harder
  to consume from React, no render-tied selected-state updates. Rejected.
- **State inside UserMenu**: UserMenu unmounts on signed-out pages — theme must
  outlive it. Rejected.

## Decision 5: No-flash first paint — inline script in `index.html`

**Decision**: Add a ~10-line inline `<script>` in `frontend/index.html` `<head>`
(before the module bundle) that reads `localStorage['vii-pass:theme']`, runs the same
resolution rules (matchMedia → time fallback), and sets `data-bs-theme` on
`document.documentElement` immediately. `ThemeProvider` then takes over on hydration
(idempotent — it sets the same attribute).

**Rationale**: Without it, a dark-mode user gets a white flash on every load (SC-002
"no mixed-theme artifacts"; SC-003 restore-on-reload). The logic is deliberately tiny
and duplicated (script can't import TS modules); a comment in both places binds them.

**Alternatives considered**:
- **Accept the flash**: visibly broken for dark users on every refresh. Rejected.
- **Build-time injection of shared code**: Vite HTML plugin complexity for ~10
  duplicated lines. Rejected (documented duplication is cheaper).

## Decision 6: Dark palette — medium-gray, WCAG AA

**Decision**: Dark tokens (all in one `[data-bs-theme='dark']` block), medium-gray as
the user specified — grays, not near-black:

| Token | Light (current) | Dark | Contrast notes |
|---|---|---|---|
| `--color-bg` | `#ffffff` | `#3a3f44` | medium gray body |
| `--color-surface` | `#f4f6f8` | `#2f3439` | cards/panels slightly deeper |
| `--color-border` | `#d0d7de` | `#565e66` | visible on both bg levels |
| `--color-text` | `#1b1f24` | `#f0f2f4` | ≥ 11:1 on `#3a3f44` |
| `--color-text-muted` | `#57606a` | `#b8c0c8` | ≥ 4.5:1 on `#3a3f44` |
| `--color-primary` | `#0b5cad` | `#66aef0` | link/brand ≥ 4.5:1 on dark bg |
| `--color-primary-contrast` | `#ffffff` | `#0c2d4d` | text on primary buttons |
| `--color-danger` | `#b42318` | `#ff8a80` | ≥ 4.5:1 on dark bg |
| `--color-success` | `#1a7f37` | `#57c878` | status text |
| `--color-focus` | `#0b5cad` | `#8bc2f5` | focus ring visible on gray |

Matching `--bs-*` remaps (body bg/color, link color/rgb, primary/danger rgb) and the
`.btn-primary` hover/active grays are restated inside the same block. Buttons keep
the brand-blue fill in dark mode with dark text (`#0c2d4d` on `#66aef0` ≈ 7:1).
Exact hex values are start points — the quickstart includes a contrast spot-check and
values may be nudged during implementation **within the medium-gray constraint**.

**Rationale**: FR-010 mandates medium-gray + AA contrast. Lightened primary/danger
are required because the light-mode hues (#0b5cad ≈ 2.4:1 on #3a3f44) fail AA on gray.

**Alternatives considered**:
- **Bootstrap's stock dark (`#212529`)**: near-black, contradicts the explicit
  "medium gray" requirement. Rejected (we override `--bs-body-bg` to our gray).
- **Auto-derived palette (color-mix)**: uncontrollable contrast outcomes. Rejected.

## Decision 7: Decorative backgrounds in dark mode — CSS dimming overlay

**Decision**: Keep the existing SVG artwork; in dark mode, dim it with a layered
gradient: `[data-bs-theme='dark'] .page-bg { background-image:
linear-gradient(rgba(20,22,25,0.55), rgba(20,22,25,0.55)), var(--page-bg-image, none); }`
plus a dark `--page-bg-fallback`. The existing print/forced-colors guards are
attribute-agnostic and continue to strip the art entirely.

**Rationale**: Spec assumption says artwork replacement is out of scope but dark mode
may adjust presentation for readability. A gradient overlay is pure CSS, keeps the
stable `/backgrounds/*` URL contract, and preserves card legibility.

**Alternatives considered**:
- **`filter: brightness(.5)` on the element**: would dim the page's *content* too
  (children render above the background but filter applies to the element's
  backdrop… actually filter affects the element and descendants). Rejected — overlay
  only affects the background layer stack.
- **Separate dark SVG files**: new assets, doubles art maintenance, out of scope.
  Rejected.

## Decision 8: Selector UI — three `menuitemradio` icon buttons in the user menu

**Decision**: Replace the placeholder "Change theme" row in `UserMenu.tsx` with a
theme row: a text label ("Theme") plus a 3-button icon group inside the existing
`role="menu"` panel. Each button: `role="menuitemradio"`, `aria-checked` for the
active mode, `aria-label` ("Auto theme" / "Dark theme" / "Light theme"), and an
inline Bootstrap-Icons glyph local to UserMenu.tsx (repo pattern, no deps):
- Auto → `circle-half`; Dark → `moon-fill`; Light → `sun-fill` (order: Auto, Dark,
  Light per FR-002).
Selecting a mode applies instantly and does **not** close the menu (so the user can
compare). Buttons are ≥44px touch targets on coarse pointers (existing pattern).
Active state = filled pill using `--color-primary` at low alpha + `aria-checked`.

**Rationale**: `menuitemradio` is the ARIA-correct role for a single-select group
inside a `menu` and announces the selected state natively (FR-003). Feature 012's
instruction "do NOT generalize chordFieldTypes.tsx" holds — icons stay local.

**Alternatives considered**:
- **Keep a "Change theme" submenu/dialog**: extra interaction step; spec asks for
  three icons directly in the menu. Rejected.
- **Cycle-through single button**: not "three icons", poor discoverability. Rejected.
- **`role="radiogroup"` with `radio`s**: invalid inside `role="menu"`; menuitemradio
  is the composite-widget-correct equivalent. Rejected.

## Decision 9: Multi-tab behavior — passive `storage` event pickup

**Decision**: `ThemeProvider` listens for the `storage` event on `window`; when the
`vii-pass:theme` key changes in another tab, it adopts the new mode immediately.
~4 lines; satisfies (and exceeds) the edge case "other tabs pick up the new
preference on their next load" with no risk of corruption (localStorage writes are
atomic).

**Alternatives considered**: Do nothing (spec minimum) — the listener is nearly free
and prevents jarring cross-tab inconsistency; BroadcastChannel — unnecessary
machinery. Chose the storage event.
