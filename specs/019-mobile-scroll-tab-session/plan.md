# Implementation Plan: Mobile Single-Scroll Layout & Tab-Scoped Sessions

**Branch**: `topic/vii-1022-mobile-scroll-tab-session` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/019-mobile-scroll-tab-session/spec.md`

## Summary

Two fixes, one story:

1. **Mobile single-scroll layout (US1)** — the vault currently sizes its shell with
   `height: 100vh` ([tokens.css](../../frontend/src/styles/tokens.css) `.app-shell`).
   On mobile browsers `100vh` equals the **largest** viewport (URL bar retracted), so
   while the URL bar is visible the shell is taller than the screen: the *page* gains a
   second scrollbar, and scrolling it reveals the white `body` background below the app.
   Fix is CSS-only: size the shell with dynamic viewport units (`100dvh` with a `100vh`
   fallback) and pin the page scroller shut on the vault surface so the chord container
   (`.chord-scroll`) remains the only vertical scroller, plus give `body` the app
   background color as belt-and-braces so any residual overrun can never flash white.

2. **Tab-scoped sessions (US2+US3)** — sessions today ride an HttpOnly cookie whose
   `Max-Age` equals the absolute TTL (24h), so closing the tab/browser keeps the session
   alive. Change the cookie to a **browser-session cookie** (no `Max-Age` — dies with the
   browser) and add a **client-side tab lease**: a `sessionStorage` flag marks "this tab
   already held the session" (survives refresh/in-tab nav, dies with the tab) and a
   `BroadcastChannel` handshake lets a brand-new tab ask "is any signed-in tab alive?".
   Bootstrap logic: flag present → resume as today; flag absent but a live tab answers →
   adopt the session (US3); flag absent and silence → last tab was closed → proactively
   revoke the server session + clear the persisted vault key and show sign-in (US2).
   Server-side session records, expiry, sign-out, and the crypto model are unchanged.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) on both tiers; React 18 SPA; Node 22 for tooling

**Primary Dependencies**: React 18 + Vite + React Router 6 + Bootstrap 5.3 (CSS only) — frontend; Hono on Cloudflare Workers + official `mongodb` driver 6 + Zod — backend. **Zero new dependencies** (uses built-in `sessionStorage`, `BroadcastChannel`, `navigator.sendBeacon`, CSS `dvh` units).

**Storage**: MongoDB Atlas (`sessions` collection — schema unchanged); browser `sessionStorage` (per-tab lease flag only, no secrets); IndexedDB vault-key store (existing, cleared on session end)

**Testing**: No unit tests (Constitution Principle II). Manual browser verification via quickstart (mobile viewport emulation, multi-tab flows) + gates (`npm run typecheck`, `npm run lint`, frontend build)

**Target Platform**: Cloudflare Workers (API) + static SPA; browsers incl. iOS Safari / Android Chrome (mobile viewport behavior is the point)

**Project Type**: Web application (frontend + backend workspaces, shared types)

**Performance Goals**: No new endpoints; tab-adoption handshake resolves in <250ms (BroadcastChannel round-trip is ~ms); layout fix is pure CSS with zero runtime cost

**Constraints**: HttpOnly session cookie is invisible to JS (by design — the lease only decides *whether to use or revoke* it, never reads it); a closing tab cannot reliably run code (crash/OS kill) so the end-of-session guarantee is enforced at next visit (spec Assumptions); `sessionStorage` is per-tab and survives refresh — exactly the lease lifetime needed

**Scale/Scope**: 2 CSS touch points, 1 backend cookie option, 1 new small frontend module (tab lease), AuthContext bootstrap wiring, ~4 files edited + 1 added

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Code Quality | Lint/typecheck gates run; new tab-lease module gets TSDoc; no dead code introduced (removed `Max-Age` path documented in TSDoc) | PASS |
| II. Testing Standards | No unit tests. Session lifecycle is a critical auth flow → manual browser verification steps included in quickstart (allowed, not a blocker) | PASS |
| III. UX Consistency | US1 *is* the responsive/mobile-first fix; verified at 320–575px portrait + landscape, tablet, desktop. No visual language changes. A11y untouched (no new UI) | PASS |
| IV. Performance | No new requests on the happy path; handshake bounded at 250ms only for brand-new tabs; CSS fix has zero cost | PASS |
| V. Scalability & Maintainability | Server stays stateless per request; session model unchanged; tab lease is an isolated module with a narrow interface | PASS |

**Post-design re-check (after Phase 1)**: still PASS — no new violations introduced by the design; Complexity Tracking table remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/019-mobile-scroll-tab-session/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── session-lifecycle.md   # Tab-lease + cookie contract
│   └── mobile-layout.md       # Single-scroll-region contract
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
└── src/
    └── services/
        └── sessions.service.ts   # EDIT: setSessionCookie drops maxAge (browser-session cookie)

frontend/
└── src/
    ├── auth/
    │   ├── AuthContext.tsx       # EDIT: bootstrap consults the tab lease before /api/auth/me;
    │   │                         #       grants/renews lease on login/register; releases on logout
    │   └── tabLease.ts           # NEW: sessionStorage flag + BroadcastChannel handshake +
    │                             #      revoke-stale-session helper (sendBeacon-free, plain POST)
    └── styles/
        └── tokens.css            # EDIT: .app-shell 100dvh (+100vh fallback), body overscroll/bg,
                                  #       vault-surface page-scroll lockdown

shared/                            # UNTOUCHED (no type changes — no API payload changes)
```

**Structure Decision**: existing web-app monorepo layout (backend / frontend / shared
workspaces). One new frontend module (`auth/tabLease.ts`), three files edited. No new
routes, no schema changes, no shared-type changes.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
