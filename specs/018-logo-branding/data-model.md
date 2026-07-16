# Data Model: App Logo Branding

**Feature**: 018-logo-branding | **Date**: 2026-07-16

This feature is purely presentational. **No database collections, API payloads, shared
types, or persisted client state are added or changed.** The "entities" are static
assets and the surfaces that consume them.

## Assets

### Full logo (`frontend/public/logo/full_logo.png`)

| Property | Value |
|----------|-------|
| Served at | `/logo/full_logo.png` (stable URL; file swap = art swap, no code change) |
| Intrinsic size | 1468 × 372 px (~3.95 : 1), transparent background |
| Content | "V"-with-keyholes mark + "PASS" wordmark, two-tone blue |
| Role | Meaningful content image — in the a11y tree with accessible name "Vii Pass" |
| Consumers | LoginPage, RegisterPage, ResetPasswordPage (auth cards), Layout (home header) |

### Logo mark (`frontend/public/logo/logo.png`)

| Property | Value |
|----------|-------|
| Served at | `/logo/logo.png` |
| Intrinsic size | 497 × 538 px (near-square), transparent background |
| Content | Standalone "V"-with-keyholes mark |
| Role | Browser tab / bookmark icon (favicon) |
| Consumers | `frontend/index.html` `<link rel="icon">` (all routes — SPA has one HTML shell) |

## Surfaces

| Surface | Today | After | Notes |
|---------|-------|-------|-------|
| Sign in card | `<p class="auth-brand">Vii Pass</p>` | `<img class="auth-logo" src="/logo/full_logo.png" alt="Vii Pass">` | Same slot above the `h1` |
| Create account card | same text line | same `<img>` | Identical size/position to Sign in |
| Reset password card | same text line | same `<img>` | Identical size/position to Sign in |
| Home header | `Link.navbar-brand` text "Vii Pass" | same Link wrapping the `<img>` (height-capped) | Link `to="/"` + `refreshVault` onClick preserved |
| Browser tab | no favicon (404 on `/favicon.ico`) | `<link rel="icon" type="image/png" href="/logo/logo.png">` | `<title>Vii Pass</title>` unchanged |

## Styling model (tokens.css)

- `.auth-logo` — centered, width-capped (`min(170px, 50%)`), `height: auto`, lifted
  toward the card top (`margin: -1rem auto var(--space-4)`).
- Header logo sizing — `height: 32px; width: auto` on the image inside
  `.app-navbar .navbar-brand`.
- Dark theme — `[data-bs-theme='dark']` applies `filter: brightness(1.8)`
  to both placements (see research Decision 4).
- `.auth-brand` rule — **deleted** (dead after the swap).

## State transitions

None. No client state, no persistence, no API interaction.
