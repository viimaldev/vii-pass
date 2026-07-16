# Implementation Plan: App Logo Branding

**Branch**: `topic/vii-1019-logo-branding` (spec dir `018-logo-branding`) | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-logo-branding/spec.md`

## Summary

Replace the plain-text "Vii Pass" brand with the official logo artwork on all four
user-facing surfaces, and give the app a browser tab icon. Frontend-only, zero new
dependencies, zero behavior changes:

1. **Auth pages** (Sign in, Create account, Reset password): the `<p class="auth-brand">Vii
   Pass</p>` text line at the top of each card becomes an `<img>` of
   `/logo/full_logo.png` with `alt="Vii Pass"`, styled by one shared `.auth-logo` class.
2. **Home page header**: the `navbar-brand` Link text in `Layout.tsx` becomes the same
   full-logo `<img>`, height-constrained to the existing navbar row.
3. **Browser tab**: `frontend/index.html` gains a `<link rel="icon" type="image/png"
   href="/logo/logo.png">` (the square mark). Title text "Vii Pass" is unchanged.

Assets already exist at `frontend/public/logo/` (served at stable `/logo/*` URLs, same
pattern as `/backgrounds/*`). Dark theme legibility is handled with a CSS-only
treatment on the shared logo class (artwork files untouched). The now-dead
`.auth-brand` CSS rule is removed.

## Technical Context

**Language/Version**: TypeScript 5.x (React 18 SPA, Vite build)

**Primary Dependencies**: React, react-router-dom, Bootstrap 5.3 (CSS only) — no new dependencies

**Storage**: N/A (static image assets only; no data changes)

**Testing**: No unit tests (Constitution II). Manual verification via quickstart.md across themes and viewports.

**Target Platform**: Evergreen browsers (desktop + mobile), served by Cloudflare Worker single-origin deploy (static assets from `frontend/public/`)

**Project Type**: Web application (frontend-only change; backend/, shared/ untouched)

**Performance Goals**: No regression to "page interactive < 2s". `full_logo.png` is ~350 KB / 1468×372 — rendered with explicit dimensions to avoid layout shift; cached like other static assets.

**Constraints**: Zero new deps; artwork files used as-is (FR-008); no behavioral changes (FR-010); WCAG 2.1 AA (accessible name "Vii Pass" on every logo image, FR-005); responsive 320px→desktop (FR-004).

**Scale/Scope**: 4 pages/components + `index.html` + one CSS block. ~6 files touched, all in `frontend/`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Code Quality | Lint-clean TS/CSS; dead `.auth-brand` rule removed with the text it styled; shared logo sizing classes in tokens.css (no one-off inline styles) | PASS |
| II. Testing Standards | No unit tests; manual quickstart verification only | PASS |
| III. UX Consistency | Same logo asset, size and position across all three auth cards; header logo fits existing navbar without layout change; responsive 320px→desktop verified per story; `alt="Vii Pass"` everywhere (WCAG AA); dark theme legibility handled | PASS |
| IV. Performance | Static PNGs with explicit width/height (no CLS); favicon is a one-time small fetch; no runtime cost | PASS |
| V. Scalability & Maintainability | Assets at stable `/logo/*` URLs — final artwork swaps in by replacing a file, no code change (same convention as `/backgrounds/*`) | PASS |

**Post-Phase-1 re-check**: PASS — design introduces one shared CSS block and three
`<img>` swaps; no new abstractions, no violations.

## Project Structure

### Documentation (this feature)

```text
specs/018-logo-branding/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (assets & surfaces — no DB entities)
├── quickstart.md        # Phase 1 output (manual verification)
├── contracts/
│   └── logo-ui.md       # UI contract for logo placement/sizing/a11y
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── index.html                          # + <link rel="icon"> (logo.png); title unchanged
├── public/
│   └── logo/
│       ├── full_logo.png               # existing asset — in-page brand (1468×372)
│       └── logo.png                    # existing asset — favicon mark (497×538)
└── src/
    ├── components/
    │   └── Layout.tsx                  # navbar-brand text → full-logo <img>
    ├── pages/
    │   ├── LoginPage.tsx               # .auth-brand <p> → full-logo <img>
    │   ├── RegisterPage.tsx            # .auth-brand <p> → full-logo <img>
    │   └── ResetPasswordPage.tsx       # .auth-brand <p> → full-logo <img>
    └── styles/
        └── tokens.css                  # + .auth-logo / navbar logo sizing;
                                        #   dark-theme treatment; − .auth-brand rule

backend/   # UNTOUCHED
shared/    # UNTOUCHED
```

**Structure Decision**: Existing web-app layout; this feature touches only the
`frontend/` workspace — three page components, one shared layout component, the design
token stylesheet, and the HTML shell.

## Complexity Tracking

> No Constitution Check violations — table not applicable.
