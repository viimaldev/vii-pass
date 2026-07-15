# Research: Loading Spinner Indicator

**Feature**: specs/016-loading-spinner | **Date**: 2026-07-15

No NEEDS CLARIFICATION markers existed in the Technical Context; research below
records the decisions behind each technology/approach choice.

## Decision 1 — Recreate the spinner as an inline SVG component, not load `loading.svg`

**Decision**: Build a small React component (`frontend/src/components/Spinner.tsx`)
that renders the dotted-ring motif as a hand-written inline SVG (~10 circle dots on
a ring, graduated opacity), and do **not** reference `public/backgrounds/loading.svg`
at runtime.

**Rationale**:

- The supplied file is a 5000×3465 full scene export (~hundreds of KB of gradient
  stops); the spinner is one small motif inside it. Loading it and cropping via
  `viewBox`/CSS is fragile (coordinates baked into the export) and wasteful.
- The spec (FR-001, Assumptions) explicitly allows recreating the motif: a ring of
  round dots with graduated shading suggesting rotation.
- Inline SVG lets the dots use `currentColor` with per-dot `opacity`, which makes the
  spinner automatically correct in light theme, dark theme, and forced-colors mode
  (FR-006) with zero extra CSS.
- Inline SVG renders instantly (no network fetch) — important because the spinner IS
  the loading state; an image request for the loading indicator could itself be
  pending during slow loads.
- Matches the established repo pattern: `chordFieldTypes.tsx` and `UserMenu.tsx`
  already inline Bootstrap-Icons SVGs rather than adding icon deps.

**Alternatives considered**:

- `<img src="/backgrounds/loading.svg">` cropped — rejected: huge asset, crop
  coordinates brittle, can't recolor via `currentColor`, adds a request during load.
- Extract the spinner subtree into a new standalone SVG file — rejected: still a
  network fetch + no `currentColor`; and the export's per-dot linear gradients
  (34 stops each) are needless weight when flat dots + opacity look identical at
  16–48px render sizes.
- Bootstrap's `.spinner-border`/`.spinner-grow` — rejected: does not match the
  supplied dotted-ring design (FR-001 requires the artwork's motif), and we import
  Bootstrap CSS only (no JS) with our own component patterns.
- CSS-only spinner (pseudo-elements/`conic-gradient`) — rejected: a faithful ring of
  10 discrete round dots with graduated opacity is far simpler and more readable as
  SVG geometry than as layered CSS gradients.

## Decision 2 — Animation: CSS rotation of the whole ring, dots carry static graduated opacity

**Decision**: Animate with a single CSS `@keyframes` full-turn rotation applied to
the SVG (stepped or linear), with each dot's opacity fixed (1.0 → ~0.15 around the
ring). Under `@media (prefers-reduced-motion: reduce)`, drop the animation entirely —
the graduated ring reads as a static activity indicator.

**Rationale**:

- One keyframe rule + `transform: rotate` = GPU-composited, no layout/paint churn,
  no React re-renders (FR-004, Performance Goals).
- The graduated opacity already encodes "rotation direction", so a reduced-motion
  static frame still communicates activity (FR-004, SC-005). Using
  `animation: none` is the simplest compliant fallback; a slow opacity pulse was
  considered but adds motion where the user asked for less.
- `animation-timing-function: steps(10)` (one step per dot) reproduces the classic
  discrete-tick feel of dotted spinners; `linear` is the fallback aesthetic choice —
  decided at implementation, both trivially satisfy the spec.

**Alternatives considered**:

- Per-dot opacity keyframe animations (10 staggered animations) — rejected: 10× the
  CSS, same visual result as rotating the group.
- SMIL `<animateTransform>` inside the SVG — rejected: cannot be disabled via CSS
  `prefers-reduced-motion` media query; CSS animation keeps the a11y guard in one
  stylesheet.
- JS-driven animation (requestAnimationFrame) — rejected: needless main-thread work
  and complexity.

## Decision 3 — Component API: one `Spinner` with a `size` variant, plus a page-centering wrapper class

**Decision**: `Spinner` renders the decorative SVG (`aria-hidden="true"`,
`focusable="false"`) and accepts `size?: 'page' | 'button'` (default `'button'`).
Page-level centering is a CSS concern: a `.page-spinner` wrapper class
(flex, centers both axes, fills the available viewport region) used at the two
page-wait call sites; the accessible text moves into a visually-hidden span inside
the existing `role="status"` element.

**Rationale**:

- Exactly two sizes exist in the spec (page ≈ 48px, button ≈ 1em text-height);
  a constrained union beats a free-form pixel prop (YAGNI, Constitution V).
- Keeping the announcement element (`role="status"` / `aria-live`) with
  visually-hidden text preserves today's screen-reader behavior byte-for-byte
  (FR-005, SC-004) while removing the visible text the user asked to replace.
  Bootstrap's `.visually-hidden` utility is already available.
- Button call sites keep their existing busy text visible and simply prepend
  `<Spinner />` — matching the user's "next to text" instruction with a one-line
  edit per button.
- `em`-based sizing for the button variant means the spinner scales with the
  button's own font-size and never changes button height (FR-003, FR-007).

**Alternatives considered**:

- Separate `PageSpinner` / `ButtonSpinner` components — rejected: two components
  for one motif invites drift; one component + size variant keeps SC-003 (visual
  identity) structurally guaranteed.
- Fixed `position: fixed` full-viewport overlay for page waits — rejected: an
  overlay dims/blocks content that may already be interactive (e.g., unlock form
  and error banners render during vault load); flex-centering inside the existing
  full-height page containers achieves "center of the window" without stacking
  contexts or scroll-lock concerns. The app shell is already `height: 100vh` with
  flex columns, so the wrapper naturally centers in the visible region.

## Decision 4 — Placement inventory (what call sites change)

**Decision**: The complete, closed list of surfaces (FR-008):

**Page-level (spinner centered in viewport, visible text removed):**

1. `ProtectedRoute.tsx` — session bootstrap `Loading…`
2. `HomePage.tsx` — `loading` branch `Loading your sections…` (the `chordsLoading`
   branch `Loading entries…` is dead since feature 015 hardcoded it `false`; its
   branch is updated or removed with the same treatment — no text-only wait remains)

**Button-level (small spinner prepended to the existing busy label):**

3. `LoginPage.tsx` — `Signing in…`
4. `RegisterPage.tsx` — `Creating account…`
5. `HomePage.tsx` (UnlockVaultForm) — `Unlocking…`
6. `AddChordDialog.tsx` — `Saving…` and `Deleting…`
7. `SectionDialog.tsx` — `Saving…` and `Deleting…`
8. `ResetPasswordPage.tsx` — `Checking…`, `Verifying…`, `Resetting…`
9. `UserMenu.tsx` — `Signing out…`

**Rationale**: Grep-verified inventory of every `…`-suffixed busy label and loading
text in `frontend/src` (2026-07-15). No other loading states exist; no new ones are
invented (spec Assumptions).

**Alternatives considered**: Centralizing busy-button rendering in a shared
`BusyButton` component — rejected for this feature: 7 surfaces with heterogeneous
markup (forms, dialogs, menu item) would need a risky refactor for a one-line-per-site
visual addition; noted as possible future cleanup.

## Decision 5 — Degradation guards (forced-colors, print)

**Decision**: Dots use `fill="currentColor"`; in forced-colors mode the spinner
inherits `CanvasText`/`ButtonText` automatically and stays visible — no special rule
needed beyond verifying opacity-graduated dots remain perceivable (worst case the
ring reads as solid dots, acceptable per spec Edge Cases). For print, hide the
spinner (`display: none` under `@media print`) — a frozen loading indicator on paper
is noise; the visually-hidden status text still prints nothing visible, matching the
existing `.page-bg` print-guard precedent.

**Rationale**: `currentColor` is the standard forced-colors-safe technique; explicit
print hiding mirrors the repo's established decorative-asset guards
(tokens.css `.page-bg` block).

**Alternatives considered**: `forced-color-adjust: none` to preserve exact grays —
rejected: overriding user contrast preferences on a pure activity indicator is an
a11y anti-pattern.
