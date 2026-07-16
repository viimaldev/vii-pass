# UI Contract: App Logo Branding

**Feature**: 018-logo-branding | **Date**: 2026-07-16

This feature exposes no API endpoints; its externally observable interface is the
rendered UI. The clauses below are the binding contract for implementation and review.

## C1 — Auth-card logo (Sign in / Create account / Reset password)

1. Each of the three auth cards MUST render, in the exact slot previously occupied by
   `<p class="auth-brand">Vii Pass</p>` (above the page `h1`), the element:

   ```html
   <img
     className="auth-logo"
     src="/logo/full_logo.png"
     alt="Vii Pass"
     width={1468}
     height={372}
   />
   ```

   (`width`/`height` are the intrinsic dimensions — layout-shift guard; CSS controls
   the rendered size.)
2. All three pages MUST use the identical markup and the identical `.auth-logo` class —
   no per-page size or position differences.
3. `.auth-logo` (tokens.css) MUST cap width at `min(170px, 50%)`, be horizontally
   centered in the card (`margin-inline: auto`), keep `height: auto` (aspect ratio
   preserved), and sit lifted toward the card's top edge (`margin-top: -1rem`) with
   `var(--space-4)` below it before the heading.
   *(Amended post-implementation per user review: originally left-aligned at
   `min(220px, 60%)` with `var(--space-2)` bottom spacing.)*
4. At a 320 px viewport the logo MUST remain fully inside the card padding — no
   overflow, no horizontal scroll.

## C2 — Home header logo

1. The `Link to="/"` navbar brand in `Layout.tsx` MUST keep its `to`, its
   `refreshVault` onClick, and its position as the first (left) header item; only its
   text content is replaced by the full-logo `<img>` (same `src`, `alt="Vii Pass"`,
   intrinsic `width`/`height` attributes).
2. The rendered logo MUST be height-capped at 32 px (`width: auto`) so the header
   height, the tab row, and the account-menu alignment are pixel-wise unchanged.
3. At mobile widths the brand MUST NOT collide with the section tabs or account menu,
   and the header MUST NOT wrap to a second line (existing `flex-nowrap` +
   `flex-shrink-0` behavior preserved).

## C3 — Favicon

1. `frontend/index.html` `<head>` MUST contain exactly one new line:

   ```html
   <link rel="icon" type="image/png" href="/logo/logo.png" />
   ```

2. `<title>Vii Pass</title>` MUST remain byte-for-byte unchanged.
3. No other `<head>` content (theme bootstrap script, meta tags) may change.

## C4 — Accessibility & fallback

1. Every logo `<img>` MUST have `alt="Vii Pass"` — never empty alt, never
   `aria-hidden`.
2. With images unavailable, each surface MUST still show/announce "Vii Pass" via the
   alt text, and the surrounding layout MUST NOT break.
3. The header logo remains inside a Link whose accessible name is "Vii Pass" (from the
   image alt) — no additional visually-hidden text needed.

## C5 — Theming

1. In dark theme, both logo placements MUST receive a CSS-only legibility treatment
   (`filter: brightness(1.8)`) via `[data-bs-theme='dark']` scoping in tokens.css;
   light theme renders the artwork unfiltered. *(Amended during implementation: the
   originally planned `invert(1) hue-rotate(180deg)` was prototyped against the dark
   surfaces and rejected — it darkened the wordmark's light gradient; a brightness
   boost preserves the brand hues and is clearly legible.)*
2. The PNG files themselves MUST NOT be modified.
3. Forced-colors mode: no special handling — content images are rendered as-is by the
   UA; do not hide the logo.

## C6 — Non-goals / invariants

1. Zero behavior changes: form flows, navigation, header controls, and routing are
   untouched (FR-010).
2. The `.auth-brand` CSS rule MUST be removed once unused (no dead CSS).
3. Body-copy text references to "Vii Pass" (e.g., "New to Vii Pass?") stay as text.
4. backend/ and shared/ MUST NOT change.
5. No new dependencies, no new build steps, no image processing.
