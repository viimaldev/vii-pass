# Research: App Logo Branding

**Feature**: 018-logo-branding | **Date**: 2026-07-16

No NEEDS CLARIFICATION items remained in the Technical Context; research below records
the design decisions and the alternatives weighed.

## Decision 1 — Serve logos from `frontend/public/logo/` at stable `/logo/*` URLs

**Decision**: Reference the existing assets directly by public URL
(`/logo/full_logo.png`, `/logo/logo.png`) rather than importing them through the Vite
module graph.

**Rationale**:
- The assets were provided in `frontend/public/logo/` already; Vite copies `public/`
  verbatim, so the URLs are stable across builds.
- Matches the established project convention for decorative/background art
  (`/backgrounds/*`, feature 005): final or updated artwork swaps in by replacing a
  file — no code change, no re-hash, no redeploy of JS.
- The favicon `<link>` in `index.html` must be a plain URL anyway (it is outside the
  module graph), so using public URLs everywhere keeps one referencing style.

**Alternatives considered**:
- **`import logoUrl from './full_logo.png'` (Vite asset import)** — gives content-hashed
  cache-busting, but breaks the "swap the file, no code change" convention, requires
  moving assets into `src/`, and still can't serve the favicon link. Rejected.
- **Inline base64/SVG** — the artwork is raster PNG; inlining ~350 KB into the bundle is
  strictly worse. Rejected.

## Decision 2 — Full logo as `<img>` with `alt="Vii Pass"`, not a CSS background

**Decision**: Render the full logo as a real `<img>` element wherever it replaces brand
text, with `alt="Vii Pass"` and explicit `width`/`height` attributes.

**Rationale**:
- The logo is **meaningful content** (it names the product), unlike the decorative
  `.page-bg` art — so it belongs in the accessibility tree with an accessible name
  (FR-005; WCAG 1.1.1). A CSS background would be invisible to screen readers and
  vanish silently on load failure.
- `alt` text doubles as the broken-image / images-disabled fallback: the user still
  sees/hears "Vii Pass" (spec edge case, SC-004).
- Explicit intrinsic dimensions (`width`/`height` attributes reflecting the 1468×372
  ratio) let the browser reserve space and avoid layout shift while CSS scales the
  rendered size (Constitution IV).

**Alternatives considered**:
- **CSS `background-image` + visually-hidden text** — two things to keep in sync,
  no automatic broken-image fallback. Rejected.
- **`<picture>` with theme-specific sources** — no theme-specific artwork exists
  (spec assumption); over-engineering. Rejected.

## Decision 3 — Sizing: width-capped on auth cards, height-capped in the header

**Decision**:
- **Auth cards**: `.auth-logo` scales by width — `width: min(220px, 60%)` of the card
  body, `height: auto`, left-aligned like the old text brand, `margin-bottom` matching
  the old `.auth-brand` spacing so the card rhythm is unchanged. At 320 px viewport the
  60% cap keeps it comfortably inside the card padding.
- **Header**: the logo scales by height — `height: 32px`, `width: auto` — inside the
  existing `navbar-brand` Link. 32 px sits within the current tab-row height (the
  brand is `align-self: center` against the tab row), so the header height and the
  brand · tabs · account-menu layout are untouched at every breakpoint.

**Rationale**: The 1468×372 (~3.95 : 1) artwork is wide; capping the axis that the
container constrains (card = width, navbar = height) preserves aspect ratio (FR-003)
and prevents overflow at 320 px (FR-004) without media queries.

**Alternatives considered**:
- **Fixed pixel size everywhere** — overflows the card at ~320 px. Rejected.
- **Bootstrap `.img-fluid` alone** — 100%-width logo would dwarf the auth card and give
  no height control in the navbar. Rejected (used conceptually, but with explicit caps).

## Decision 4 — Dark-theme legibility via a CSS-only treatment (artwork unaltered)

**Decision** *(amended during implementation)*: In dark theme
(`[data-bs-theme='dark']`), apply `filter: brightness(1.8)` to the shared logo
styling — lifting the navy artwork to a vivid, readable blue on the medium-gray dark
surfaces while preserving the brand hues. Artwork files are byte-for-byte unchanged
(FR-009).

**Rationale**:
- The artwork is dark navy + medium blue on transparency; on feature 013's medium-gray
  dark surfaces the navy wordmark would approach invisibility unfiltered.
- A pure brightness boost keeps every hue exactly on-brand and needs no second logo
  variant; pure CSS keeps the "swap the artwork file, no code change" property.

**Alternatives considered**:
- **`invert(1) hue-rotate(180deg)` (original plan)** — prototyped side-by-side on the
  actual dark surface during implementation: the wordmark's light gradient regions
  inverted to *dark* navy, making the result LESS legible than the unfiltered artwork.
  Rejected on visual evidence.
- **Dedicated dark-theme logo file** — cleanest visually but no such asset was provided
  and the spec assumes no new artwork. Rejected (can supersede this filter later by
  simply shipping a variant).
- **Light chip/plate behind the logo in dark mode** — adds a visual box that exists in
  neither theme's design language. Rejected.
- **`brightness(0) invert(1)` (flat white)** — guaranteed contrast but destroys the
  two-tone brand colors entirely. Rejected.

## Decision 5 — Favicon: single PNG `<link rel="icon">`, title text unchanged

**Decision**: Add one line to `frontend/index.html`:
`<link rel="icon" type="image/png" href="/logo/logo.png" />`. Keep
`<title>Vii Pass</title>` exactly as is.

**Rationale**:
- The app currently declares **no** favicon (browsers 404 on `/favicon.ico`); a single
  PNG link fixes tabs and bookmarks in all evergreen browsers (FR-006, SC-003).
- `logo.png` (497×538) is near-square; browsers letterbox non-square favicons
  transparently — no re-cut needed (FR-008).
- The SPA never mutates `document.title`, so one static link + title covers every route
  (FR-007).

**Alternatives considered**:
- **Multi-size `.ico` / apple-touch-icon / manifest icon set** — PWA-grade polish that
  the spec doesn't ask for; can be layered on later without conflict. Rejected (YAGNI).
- **SVG favicon** — no SVG asset exists. Rejected.

## Decision 6 — Remove the dead `.auth-brand` rule; keep the header Link behavior

**Decision**: Delete the `.auth-brand` CSS block from tokens.css once no page renders
that class (Constitution I: dead code must be removed). In `Layout.tsx`, the logo goes
**inside** the existing `Link to="/"` (with its `refreshVault` onClick) — the brand's
click-to-home behavior is an existing behavior that FR-010 requires preserving, not a
new feature.

**Rationale**: Straight application of the code-quality principle and FR-010 (no
behavior changes in either direction).

**Alternatives considered**: Keeping `.auth-brand` "just in case" — violates
Constitution I. Rejected.
