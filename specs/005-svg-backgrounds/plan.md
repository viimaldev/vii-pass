# Implementation Plan: SVG Background Placeholders

**Branch**: `topic/vii-1006-svg-backgrounds` (feature dir `specs/005-svg-backgrounds`, story `vii:1006`) | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-svg-backgrounds/spec.md`

## Summary

Add decorative, **placeholder** SVG backgrounds behind the login page and home page, plus a
single reusable mechanism so the same treatment can be applied to future containers and so the
placeholder art can be swapped for the final design later with **zero code changes**.

Technical approach: a **CSS-only, dependency-free** solution that extends the existing design
system in [frontend/src/styles/tokens.css](../../frontend/src/styles/tokens.css). Static SVG
files live in a new, single, well-known folder served verbatim by Vite
(`frontend/public/backgrounds/`). A reusable `.page-bg` utility class reads a CSS custom
property (`--page-bg-image`) for the graphic and a `--page-bg-fallback` color, and uses
`background-size: cover` so the graphic fills the surface at any viewport (phones cover-crop it);
per-surface modifier classes (`.page-bg--login`, `.page-bg--home`) simply set those variables. The two pages
wrap their existing Bootstrap `.container` in a full-bleed `.page-bg` element. Backgrounds are pure
CSS `background-image`s, so they are **never in the accessibility tree, never intercept pointer or
keyboard input, and never alter focus order** — satisfying the decorative-only requirement for
free. Foreground text/controls already sit inside Bootstrap `.card`s (opaque surfaces), so contrast
is unaffected. No new dependencies, no API, no data store, no config.

For mobile, every surface **cover-crops its single desktop SVG** (`background-size: cover`) — no
separate mobile file and no width-based media query — so login and home behave identically and
future surfaces need only one asset.

## Technical Context

**Language/Version**: TypeScript 5.5 (strict) for the two React page edits; CSS3 (custom
properties + media queries) for the reusable mechanism; SVG 1.1 for the static assets. No new
languages or tooling.

**Primary Dependencies**: **No change.** Frontend — React 18, Vite 5, React Router 6, Bootstrap
5.3 (grid/breakpoints/utilities). No packages added or removed. No SVG loader/optimizer plugin is
introduced (assets are hand-authored static files served as-is).

**Storage**: N/A — no database, no persisted state. Assets are static files under
`frontend/public/backgrounds/`; Vite copies `public/` to `dist/` verbatim (stable, unhashed URLs,
which is exactly what makes drop-in replacement work).

**Testing**: No unit-test suites (Constitution Principle II + project instructions). Verification =
TypeScript strict + ESLint/Prettier clean + `vite build` + the manual
[quickstart.md](./quickstart.md) responsive/replace/fallback walkthrough at ~320px, tablet, and
desktop widths.

**Target Platform**: Browser SPA (static build on Cloudflare Pages). No backend/Worker change.

**Project Type**: Web application (existing `frontend/` + `backend/` + `shared/` monorepo); this
feature touches **frontend only**.

**Performance Goals**: Constitution default — primary page interactive < 2s. Background SVGs are a
few KB each, requested via CSS `background-image` (non-render-blocking, fetched after first paint),
so they do **not** regress time-to-interactive (FR-010). No JavaScript is added to any hot path.

**Constraints**: Backgrounds MUST be decorative-only (no a11y-tree presence, no pointer/focus
interception — FR-009); foreground contrast MUST stay ≥ WCAG AA (FR-005, SC-003); no horizontal
scrolling introduced at any width (SC-001); must render crisply at all sizes/DPRs (FR-008); must
fall back to an on-brand color if an asset fails to load (FR-011); must use existing design tokens
and the Bootstrap breakpoint system, no one-off breakpoints or styles (Constitution III).

**Scale/Scope**: 2 styled surfaces now (login, home) + a reusable class for future surfaces. ~3
SVG files + 1 folder README added; `tokens.css`, `LoginPage.tsx`, `HomePage.tsx`, and a one-class
tweak to `Layout.tsx`'s `<main>` edited. No shared/backend files touched.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| **I. Code Quality** | CSS-only reusable class + variables (single responsibility), no dead code, no new deps; placeholder SVGs are documented as such with a co-located README; changes are lint/format-clean. No one-off styles — the mechanism is centralized in `tokens.css`. | PASS |
| **II. Testing Standards** | No unit tests (per constitution). Manual quickstart verifies the visual/responsive/replace/fallback behavior; nothing security-sensitive is involved. | PASS |
| **III. UX Consistency** | Reuses the shared design tokens and Bootstrap breakpoints; **mobile-first & responsive delivered in-story** (US2) via graceful cover-crop of one desktop SVG across ~320px→desktop; decorative backgrounds are hidden from assistive tech, keep keyboard/focus order intact, and preserve WCAG AA contrast (content sits on opaque cards). Respects `prefers-reduced-motion` (assets are static), print, and forced-colors. | PASS |
| **IV. Performance** | Static few-KB SVGs via non-blocking CSS `background-image`; no JS on any path; page-interactive < 2s budget preserved (FR-010, SC-006). | PASS |
| **V. Scalability & Maintainability** | One reusable, token-driven mechanism (`.page-bg` + CSS vars) instead of per-surface bespoke styling; assets in a single known folder; placeholders swap by replacing a file (YAGNI — no theming engine, no build plugin, no component framework). | PASS |

**Security gates** (Quality Gates & project instructions): no secrets, no user input, no new
network calls, no new dependencies (so no new CVE surface). SVGs are **static, hand-authored**
assets referenced by CSS `url()` — they are never inlined into the DOM and carry no scripts, so
there is no SVG-borne XSS vector. No change to auth, sessions, or the vault.

**Result**: PASS. No violations, no deviations. Complexity Tracking is intentionally empty.

**Post-Design Re-evaluation** (after Phase 1): Re-checked against
[data-model.md](./data-model.md), [contracts/background-assets.md](./contracts/background-assets.md),
and [quickstart.md](./quickstart.md). The design remains CSS-only and dependency-free; the asset
contract keeps graphics decorative and replaceable from one folder; the CSS API is centralized and
token-driven; responsiveness is delivered in-story. No new secrets, dependencies, or a11y
regressions were introduced. **Constitution Check remains PASS.**

## Project Structure

### Documentation (this feature)

```text
specs/005-svg-backgrounds/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output — design decisions
├── data-model.md        # Phase 1 output — asset/surface model + CSS-var contract
├── quickstart.md        # Phase 1 output — manual responsive/replace/fallback walkthrough
├── contracts/
│   └── background-assets.md   # Phase 1 output — asset location/naming + CSS class/variable API
└── checklists/
    └── requirements.md  # From /speckit.specify
```

### Source Code (repository root)

```text
frontend/
├── public/
│   └── backgrounds/                 # (new) single, well-known home for all background assets (FR-004)
│       ├── README.md                # (new) documents naming, variants, swap-in instructions
│       ├── login-desktop.svg        # (new) placeholder — login; phones cover-crop this same file
│       └── home-desktop.svg         # (new) placeholder — home; phones cover-crop this same file
├── src/
│   ├── styles/
│   │   └── tokens.css               # (edit) add the reusable `.page-bg` mechanism:
│   │                                #   .page-bg base (cover/center/no-repeat + fallback color;
│   │                                #     one SVG per surface, phones cover-crop it),
│   │                                #   @media print/(forced-colors) → background-image:none,
│   │                                #   .page-bg--login / .page-bg--home modifiers set the CSS vars
│   ├── components/
│   │   └── Layout.tsx               # (edit, 1 line) <main> gains `d-flex flex-column` so a
│   │                                #   full-height .page-bg child can fill the viewport area
│   └── pages/
│       ├── LoginPage.tsx            # (edit) wrap the existing .container in
│       │                            #   <div className="page-bg page-bg--login flex-grow-1">
│       └── HomePage.tsx             # (edit) wrap the existing .container in
│                                    #   <div className="page-bg page-bg--home flex-grow-1">
    # UNCHANGED: main.tsx (import order already Bootstrap→tokens), App.tsx, all auth/services/types,
    #            RegisterPage.tsx, UserMenu.tsx, ProtectedRoute.tsx; entire backend/ and shared/.
```

**Structure Decision**: Continue the existing web-app monorepo, **frontend only**. Assets go in
Vite's `public/` (served at stable, unhashed URLs — the property that lets a designer replace a
file with no code change, FR-003) rather than `src/assets/` (which hashes/bundles and would require
an `import`). The reusable mechanism lives in the existing `tokens.css` design-system file (not a
new component or stylesheet), keeping one source of truth and honoring "no one-off styles"
(Constitution III). Pages opt in by adding two class names; future containers do the same or define
a new `--page-bg-image` variable.

## Complexity Tracking

> No constitutional violations or deviations. This feature adds a single reusable, token-driven CSS
> mechanism and static placeholder assets — nothing to justify here.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _(none)_ | — | — |
