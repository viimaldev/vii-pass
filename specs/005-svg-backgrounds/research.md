# Phase 0 Research: SVG Background Placeholders

**Feature**: [spec.md](./spec.md) | **Branch**: `topic/vii-1006-svg-backgrounds` | **Date**: 2026-07-08

This document records the design decisions for adding decorative, replaceable SVG background
placeholders to the login and home pages and a reusable mechanism for future surfaces. It builds on
the existing frontend design system ([../../frontend/src/styles/tokens.css](../../frontend/src/styles/tokens.css))
and the Bootstrap integration added in the responsive-UI work (story vii:1005). The spec carried
**no [NEEDS CLARIFICATION]** markers; the interpretive choices below were pre-resolved as documented
Assumptions in the spec and are formalized here.

---

## Decision 1 — Asset location: `frontend/public/backgrounds/` (served verbatim)

- **Decision**: Store the placeholder SVGs as static files in a new
  **`frontend/public/backgrounds/`** folder and reference them from CSS via absolute
  URLs (`url('/backgrounds/login-desktop.svg')`). Add a short `README.md` in that folder documenting
  the naming convention and how to swap in final art.
- **Rationale**:
  - Vite serves `public/` **verbatim** at the site root and copies it to `dist/` unchanged, giving
    each asset a **stable, unhashed URL**. That is precisely the property FR-003/SC-004 need: a
    designer replaces `login-desktop.svg` with the final art and the page updates with **no code,
    import, or layout change**.
  - A single dedicated folder satisfies FR-004/US3 ("all background assets live together in one
    clearly named location").
  - No build tooling, loader, or optimizer plugin is required (Constitution V, YAGNI).
- **Alternatives considered**:
  - **`frontend/src/assets/` + `import` (bundled/hashed)**: **Rejected** — Vite fingerprints the
    filename (`login-desktop.abcd1234.svg`) and requires a JS/CSS `import`, so swapping art would
    change a hashed reference and couple the asset to code. Hashing benefits cache-busting but
    fights the "drop-in replace with zero code change" requirement. For placeholders replaced at
    deploy time, stable URLs win.
  - **Inline `<svg>` in JSX**: **Rejected** — puts large decorative markup in the component (dead
    weight, harder to swap), and would need explicit `aria-hidden`/`focusable` handling to stay
    decorative. CSS backgrounds are decorative for free (see Decision 4).
  - **Data-URI in CSS**: **Rejected** — not human-swappable, bloats the stylesheet, no clean
    per-file replacement.

---

## Decision 2 — Application mechanism: reusable `.page-bg` class driven by CSS custom properties

- **Decision**: Add one reusable utility to `tokens.css`:
  - `.page-bg` — the base: `background-size: cover; background-position: center top;
    background-repeat: no-repeat;` a fallback `background-color`, and the image pulled from a
    variable: `background-image: var(--page-bg-image, none);`
  - Per-surface **modifier classes** set only the variables:
    `.page-bg--login { --page-bg-image: url('/backgrounds/login-desktop.svg'); }`
    and `.page-bg--home { --page-bg-image: url('/backgrounds/home-desktop.svg'); }`.
  - A future container gets a background by adding `page-bg` + either an existing modifier or a new
    one (or by setting `--page-bg-image` inline). This is the single documented mechanism (FR-007).
- **Rationale**:
  - Centralizes the treatment in the existing design-system file — **no one-off styles**
    (Constitution III). Pages opt in with class names only; they carry no styling logic.
  - CSS custom properties make the image a **data value**, so the base rule (sizing, fallback,
    responsiveness, print/forced-colors handling) is written **once** and every surface inherits it.
  - Pure CSS → no JavaScript, no component API, no re-render cost (Constitution IV/V).
- **Alternatives considered**:
  - **A `<PageBackground>` React component**: **Rejected** — more code and a JS surface for a
    purely presentational concern; the CSS class is lighter and reused identically.
  - **Bootstrap utilities only**: **Rejected** — Bootstrap has no "cover background image" utility;
    a custom class is unavoidable, so it should be the single reusable one.
  - **Per-page bespoke CSS blocks**: **Rejected** — duplicates sizing/fallback logic and invites
    drift (explicitly disallowed by Constitution III).

---

## Decision 3 — Mobile strategy: cover-crop the desktop SVG (no separate mobile file)

- **Decision**: Every surface uses a **single desktop SVG** that is **cover-cropped** on phones —
  no separate mobile file and no width-based media query for the image:
  - `.page-bg` sets `background-size: cover`, so the graphic scales to fill the surface at any
    viewport; on a narrow phone it is simply cropped (centered) with no distortion and no horizontal
    scroll. Both `.page-bg--login` and `.page-bg--home` set only `--page-bg-image`.
  - This is the simplest of the approaches the user described ("same svg crop can be done") and is
    applied uniformly, so future surfaces need only one asset.
- **Rationale**:
  - Directly implements the requirement ("same svg crop can be done") with the least machinery — one
    asset per surface, one CSS rule, no breakpoint to maintain (FR-006, US2).
  - `cover` + `center` guarantees full coverage with no gaps or repeat at any aspect ratio
    (SC-001/SC-002 and the "very tall/short content" and "ultra-wide" edge cases).
- **Alternatives considered**:
  - **JS viewport detection / `<picture>` element**: **Rejected** — background images can't use
    `<picture>`; JS media queries add code for what a CSS `@media` rule does natively.
  - **A new custom breakpoint**: **Rejected** — Constitution III says reuse the existing breakpoint
    system; Bootstrap `sm` is the app's phone boundary.

---

## Decision 4 — Decorative-only via CSS background (no accessibility-tree presence)

- **Decision**: Render backgrounds exclusively as CSS `background-image` on a wrapper `<div>`. Do
  **not** use `<img>` or inline `<svg>` for them. No `alt`, `role`, or `aria-*` is needed because CSS
  backgrounds are inherently absent from the accessibility tree.
- **Rationale**:
  - FR-009/SC-007 require backgrounds to be invisible to assistive tech, to not intercept pointer or
    keyboard input, and to not alter focus order. A CSS background satisfies **all** of these by
    construction: it is not a DOM node, not focusable, not hit-testable for content, and not announced
    by screen readers.
  - Foreground legibility (FR-005/SC-003) is preserved because all page content sits inside opaque
    Bootstrap `.card`s; text contrast is measured against the card surface, not the background. The
    background only shows in the page gutters/padding where there is no text.
- **Alternatives considered**:
  - **`<img aria-hidden="true">` positioned behind content**: **Rejected** — adds a DOM node and
    z-index/pointer-events management for no benefit over a CSS background.

---

## Decision 5 — Graceful degradation: fallback color, reduced-motion, print, forced-colors

- **Decision**:
  - **Load failure (FR-011)**: `.page-bg` always sets `background-color: var(--page-bg-fallback,
    var(--color-surface))`. If an SVG 404s or fails, the surface shows the on-brand
    `--color-surface` and stays fully usable.
  - **Reduced motion**: assets are **static** SVGs (no `<animate>`/CSS animation), so
    `prefers-reduced-motion` is honored by default; no animation is ever introduced.
  - **Print**: a `@media print { .page-bg { background-image: none; } }` rule drops the decorative
    art from printouts (browsers also suppress backgrounds by default) so printed pages stay clean.
  - **Forced colors / high contrast**: `@media (forced-colors: active) { .page-bg { background-image:
    none; } }` yields to the user's high-contrast palette instead of fighting it.
- **Rationale**: Covers the spec's "asset fails to load", "reduced-motion/high-contrast/print", and
  "ultra-wide/high-DPI" edge cases with a few declarative rules and the token palette — no JS, no new
  tokens. SVG stays crisp at any DPR by nature (FR-008), so no raster fallbacks are needed.
- **Alternatives considered**:
  - **`onerror` JS fallback**: **Rejected** — CSS `background-color` under the image already provides
    the fallback with no script.

---

## Decision 6 — Placeholder art: subtle, brand-tinted, lightweight, obviously temporary

- **Decision**: Hand-author minimal SVGs — soft abstract shapes (blobs/waves/dots) in the existing
  brand palette (`--color-primary` `#0b5cad` and light tints of `--color-surface` `#f4f6f8`) at low
  visual weight. Desktop files use a landscape `viewBox`; the login mobile file uses a portrait
  `viewBox`. Each file is a few KB, no embedded rasters, no scripts, no external references.
- **Rationale**:
  - FR-012 wants placeholders that look coherent with the current UI until final art arrives; using
    the token palette achieves that. Low visual weight keeps the surface calm and avoids any
    perceived clash behind the cards.
  - Small, script-free, self-contained SVGs keep payload negligible (FR-010) and carry no XSS vector
    (they are referenced by `url()`, never inlined into the DOM).
  - Intentionally generic art signals "placeholder" and is trivial to replace (US3).
- **Alternatives considered**:
  - **Photographic/raster placeholders**: **Rejected** — heavier, blur on high-DPI, contradict the
    user's explicit SVG request.
  - **Third-party pattern library / generator dependency**: **Rejected** — adds a dependency for a
    few static files (YAGNI); hand-authored SVGs are enough for placeholders.

---

## Decision 7 — Full-height coverage without touching page semantics

- **Decision**: Each page wraps its existing `.container` in `<div className="page-bg page-bg--<surface>
  flex-grow-1">`, and `Layout.tsx`'s `<main>` gains Bootstrap `d-flex flex-column` (one class) so the
  `flex-grow-1` wrapper stretches to fill the remaining viewport height below the header.
- **Rationale**:
  - Guarantees the background covers the **full visible surface** even when content is short (the
    "very short content" edge case, SC-001) without absolute positioning or magic pixel heights.
  - Reuses Bootstrap flex utilities (already the app's layout system) — no custom layout CSS. The
    `<main>` change is a general, harmless shell improvement shared by all pages.
- **Alternatives considered**:
  - **`min-height: 100vh` on `.page-bg`**: **Rejected** — double-counts the header height and can
    cause overflow/scroll; flex-fill is exact.
  - **Background on `<main>` in `Layout`**: **Rejected** — `main` is shared by all routes (including
    register); we want the treatment only where a surface opts in.

---

## Summary of resolved unknowns

| Topic | Resolution |
|-------|------------|
| Where assets live | `frontend/public/backgrounds/` (static, stable URLs, one folder) |
| How a surface gets a background | `.page-bg` + `.page-bg--<surface>` classes (CSS custom properties) |
| Mobile behavior | Every surface cover-crops its single desktop SVG (`background-size: cover`); no separate mobile file |
| Accessibility | CSS background → not in a11y tree, no focus/pointer interception, no `aria` needed |
| Contrast | Content sits on opaque `.card`s → foreground contrast unaffected (WCAG AA preserved) |
| Failure/edge handling | Fallback `background-color` token; `print` & `forced-colors` drop the image; static SVG ⇒ reduced-motion safe |
| Art style | Subtle brand-palette abstract SVGs, few KB, script-free, obviously placeholder |
| Full-height fill | `<main>` `d-flex flex-column` + wrapper `flex-grow-1` |
| Dependencies added | None |
