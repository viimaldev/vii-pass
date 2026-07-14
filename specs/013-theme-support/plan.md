# Implementation Plan: Theme Support (Auto / Dark / Light)

**Branch**: `topic/vii-1014-theme-support` | **Date**: 2026-07-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/013-theme-support/spec.md`

## Summary

Add a three-mode theme system — **Auto** (default; follows the OS/browser
`prefers-color-scheme` when declared, otherwise local time: light 06:00–17:59, dark
outside), **Dark** (medium-gray palette), and **Light** (current palette) — selectable
via three icon controls (order: Auto, Dark, Light) that replace the inert
"Change theme" placeholder row in the user menu. The preference is **per-device**
(localStorage, not synced to the account) and applies to every surface including
signed-out pages.

Technical approach: **frontend-only, zero new dependencies, zero backend changes.**
A new `ThemeProvider` React context computes the resolved appearance
(`light | dark`) from the stored mode + a `matchMedia('(prefers-color-scheme: dark)')
listener + a time-of-day fallback, and applies it by setting
`data-bs-theme="light|dark"` on `<html>`. Bootstrap 5.3 natively re-themes all its
components from that attribute; our design tokens in
`frontend/src/styles/tokens.css` gain a `[data-bs-theme='dark']` override block that
re-points the existing `--color-*` custom properties to a medium-gray dark palette,
so every existing component (vault cards, dialogs, menus, alerts) re-themes without
per-component edits. A tiny inline pre-hydration script in
`frontend/index.html` applies the stored/resolved theme before first paint to avoid a
flash of the wrong theme.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) — React 18 frontend only; backend untouched

**Primary Dependencies**: React 18, React Router 6, Bootstrap 5.3 (CSS only, already
installed — its native `data-bs-theme` dark-mode support is the core mechanism).
**No new dependencies.**

**Storage**: `localStorage` key `vii-pass:theme` (`'auto' | 'dark' | 'light'`; absent
= auto). No MongoDB/collection/API changes — the preference is per-device by spec
(FR-009) and deliberately not synced to the account.

**Testing**: No unit tests (Constitution Principle II). Manual verification via
quickstart.md: browser walkthrough incl. OS-preference flip, time-fallback check,
persistence across refresh/sign-out, contrast spot-check, 320px responsive check.

**Target Platform**: Modern evergreen browsers (Chrome/Edge/Firefox/Safari) on the
existing Cloudflare Workers single-origin deployment; `matchMedia` +
`prefers-color-scheme` are universally supported there.

**Project Type**: Web application (monorepo: shared / frontend / backend) — this
feature touches **frontend only**.

**Performance Goals**: Theme switch visually applied < 100ms (CSS-variable swap, no
re-render storm — SC-001 allows 1s); no flash of wrong theme on load (inline script
runs before first paint); zero bundle-size impact beyond ~2KB of CSS/TS.

**Constraints**: Zero new dependencies; CSS must integrate with existing design
tokens (no one-off styles); WCAG 2.1 AA contrast in both palettes (FR-010); must not
break `forced-colors` mode (existing `.page-bg` guard stays); menu ARIA semantics
(`role="menu"`) preserved; identical behavior for admin/normal roles (FR-012).

**Scale/Scope**: 1 new context/provider, 1 new component (theme selector rows/group
in UserMenu), 1 CSS override block, 1 inline bootstrap script, 3 new icons. ~6 files
edited, ~2 files added.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|---|---|---|
| I. Code Quality | Single-responsibility modules: `ThemeContext.tsx` (state + resolution), tokens.css override block (palette). TSDoc on exports; lint/typecheck gates run. | PASS |
| II. Testing Standards | No unit tests. Manual quickstart verification only; theme switching is not a security-critical flow. | PASS |
| III. UX Consistency | Uses the existing design-token system (re-points `--color-*` vars — the opposite of one-off styles). Icon controls follow the repo's inline Bootstrap-Icons pattern. WCAG AA contrast required in both palettes (FR-010); keyboard-operable selector with announced selected state (FR-003); responsive/mobile-first — selector lives in the existing 280px-clamped menu panel, verified at 320px. | PASS |
| IV. Performance | Budget defined: <100ms visual switch, no first-paint flash. CSS-variable swap is O(1); no measurable regression expected. | PASS |
| V. Scalability & Maintainability | Loosely coupled: one provider, one attribute, one CSS block. YAGNI honored — no account-sync, no theme-builder, no per-component theme props. Extension point: future themes = new `data-bs-theme` value + token block. | PASS |

**Initial gate: PASS — no violations, Complexity Tracking empty.**

**Post-design re-check (after Phase 1): PASS** — design artifacts introduce no new
projects, no new dependencies, no backend surface; the only "global" mutation is the
`data-bs-theme` attribute, which is Bootstrap's documented public theming API.

## Project Structure

### Documentation (this feature)

```text
specs/013-theme-support/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── theme-ui.md      # Selector UI + persistence + resolution contract
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── index.html                       # EDIT: inline pre-hydration theme script (no-flash)
└── src/
    ├── main.tsx                     # EDIT: mount ThemeProvider (outside AuthProvider)
    ├── theme/
    │   └── ThemeContext.tsx         # NEW: ThemeProvider + useTheme (mode state, resolution,
    │                                #      matchMedia listener, time fallback, localStorage)
    ├── components/
    │   └── UserMenu.tsx             # EDIT: replace placeholder row with 3-icon selector
    │                                #       (+ 3 inline icons: circle-half, moon-fill, sun-fill)
    └── styles/
        └── tokens.css               # EDIT: [data-bs-theme='dark'] token override block
                                     #       + .user-menu__theme* selector styles
                                     #       + dark-mode .page-bg dimming layer

backend/    # UNTOUCHED
shared/     # UNTOUCHED
```

**Structure Decision**: Frontend-only change inside the existing monorepo layout. New
`frontend/src/theme/` directory holds the provider (mirrors the existing
`auth/`/`vault/` context pattern). All styling lands in the existing
`tokens.css` (Constitution III: no one-off styles). No backend, shared-types, or API
changes — the preference never leaves the device.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
