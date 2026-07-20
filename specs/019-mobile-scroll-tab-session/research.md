# Research: Mobile Single-Scroll Layout & Tab-Scoped Sessions

**Feature**: specs/019-mobile-scroll-tab-session | **Date**: 2026-07-20

No `NEEDS CLARIFICATION` markers existed in the Technical Context; the research below
records the root-cause analysis and the decisions behind each technique chosen.

---

## Decision 1 — Root cause of the mobile double scrollbar: `100vh` vs. the dynamic mobile viewport

**Decision**: Size `.app-shell` with `height: 100dvh` (dynamic viewport height), keeping
`height: 100vh` immediately before it as the fallback for older browsers. Additionally
set `overscroll-behavior-y: none` awareness aside, pin the *page* scroller shut for the
signed-in vault surface (see Decision 2) and give `body` the app background token so no
white can ever show through.

**Root cause**: [tokens.css](../../frontend/src/styles/tokens.css) declares
`.app-shell { height: 100vh }`. On iOS Safari and Android Chrome, `100vh` is defined as
the **large viewport** height — the height when the browser URL/tool bars are retracted.
While those bars are visible (the normal state on page load), the layout viewport is
*shorter* than `100vh`, so the shell overflows the page by the bar height. The result is
exactly the reported bug: (a) the page/body gets its own scrollbar (second scrollbar in
addition to `.chord-scroll`), and (b) scrolling the page reveals the `body` background —
white in light theme — below the app content.

**Why `dvh`**: `100dvh` tracks the *current* visible viewport dynamically (URL bar shown
or hidden), so the shell always exactly fills the screen — no overflow, no white band,
and it also handles the on-screen-keyboard and landscape edge cases in the spec.
Browser support (Safari 15.4+, Chrome 108+, Firefox 101+) comfortably covers the
project's baseline; the `100vh` line above it is the graceful fallback (older browsers
get today's behavior, no worse).

**Alternatives considered**:
- **JS `--vh` custom property** (resize listener writing `window.innerHeight`): the
  classic pre-`dvh` workaround. Rejected — runtime cost, resize-event jank, and `dvh`
  makes it obsolete.
- **`100svh` (small viewport height)**: always fits, but leaves a gap when the URL bar
  retracts (shell shorter than screen → background shows *below* the shell, the very
  artifact we're removing). Rejected.
- **`position: fixed; inset: 0` shell**: works but changes stacking/scroll semantics for
  dialogs and the fixed `.page-spinner`, higher regression risk than a height swap.

---

## Decision 2 — Guarantee a single scroll region: lock the page scroller on the vault surface

**Decision**: Keep the existing inner scroll architecture (`.app-main` → `.vault-page` →
`.vault-page__inner` → `.chord-scroll`, flex chain with `min-height: 0`) exactly as is.
Add `overflow: hidden` to `.app-main` **only when it hosts the vault page** (scoped via
the existing `.vault-page` child — e.g. `.app-main:has(.vault-page)` with a
documented fallback, or an explicit modifier class set by the vault page), and set
`body { background: var(--color-bg) }`→ already the case; extend `html`/`body` with
`overscroll-behavior-y: none` on the app shell surface so iOS rubber-banding never
exposes the area behind the page.

**Rationale**: `.app-main { overflow-y: auto }` is a deliberate *fallback* scroller for
short public pages (login/register may exceed small viewports and MUST page-scroll —
spec Assumptions). On the vault surface, however, the chord scroller owns scrolling, and
any accidental overflow (e.g. sub-pixel rounding, keyboard-driven viewport changes)
currently materializes as a second scrollbar. Scoping the lockdown to the vault surface
preserves auth-page behavior while making FR-001 structurally true rather than
incidentally true.

**Support note on `:has()`**: Baseline since 2023 (Chrome 105+, Safari 15.4+, Firefox
121+) — acceptable here; if review prefers zero risk, the modifier-class variant
(HomePage already renders `.vault-page`; Layout can equally add a class) is the
dependency-free fallback. Final choice deferred to implementation; contract only
requires the *behavior* (vault surface never page-scrolls).

**Alternatives considered**:
- **Global `body { overflow: hidden }`**: breaks the login/register page-scroll
  fallback on short viewports. Rejected.
- **Restructure the flex chain**: unnecessary — the chain already works on desktop; the
  defect is purely the `100vh` overrun plus the permissive fallback scroller.

---

## Decision 3 — Tab-scoped session: browser-session cookie + per-tab lease + cross-tab handshake

**Decision**: Three cooperating parts, no new dependencies, no API/schema changes:

1. **Cookie becomes a browser-session cookie** — `setSessionCookie` drops `maxAge`
   (HttpOnly/Secure/SameSite=Lax/path unchanged). The cookie now dies when the browser
   fully closes (spec US2 scenario 3). Server-side absolute + idle TTLs are untouched
   and continue to bound lifetime (FR-011).
2. **Per-tab lease in `sessionStorage`** (`vii-pass:tab-lease` = `'1'`, no secrets):
   written on successful login/register and on any legitimate session resume. Because
   `sessionStorage` is per-tab and survives refresh/in-tab navigation but not tab close,
   its presence means "THIS tab already legitimately held the session" → FR-007
   (refresh keeps session) falls out for free.
3. **Cross-tab adoption via `BroadcastChannel`** (`vii-pass:tabs`): a booting tab with
   no lease broadcasts `who-is-alive?` and waits a short deadline (~200ms). Any tab that
   holds the lease answers `alive`. An answer → the new tab writes its own lease and
   bootstraps normally, sharing the cookie session (FR-008/US3). Silence → the last tab
   was closed: the tab **first calls `POST /api/auth/logout`** (revokes the server
   session record — FR-006 — and clears the cookie) and clears the persisted IndexedDB
   vault key, then renders the sign-in page (FR-004/FR-005).

**Bootstrap decision table** (implemented in AuthContext before the existing
`GET /api/auth/me`):

| Lease present? | Peer answered? | Meaning | Action |
|---|---|---|---|
| yes | — | refresh / in-tab nav | resume: `/me` as today |
| no | yes | new tab beside a live one | write lease, resume via `/me` |
| no | no | first visit OR returning after last-tab close | revoke (`/logout`, ignore errors), clear vault key, treat as signed out |

The "revoke on silence" call is harmless on a genuine first visit (no cookie → logout is
a no-op; it's already idempotent) — so no state needs to distinguish "never signed in"
from "stale session".

**Rationale**: A closing tab cannot reliably run code (crash, OS tab kill, iOS Safari
freezing background pages — spec Edge Cases), so any design that *acts at close time* is
best-effort at most. This design instead makes the **next visit** authoritative: without
a live tab vouching for the session, the visitor is signed out and the stale server
record is destroyed. That matches the spec's observable guarantee (Assumptions) exactly,
and the browser-session cookie independently covers the full-browser-close case even if
the SPA never loads again.

**Alternatives considered**:
- **`pagehide`/`beforeunload` + `navigator.sendBeacon('/api/auth/logout')`**: fires on
  refresh and in-tab navigation too (would kill the session on F5 — violates FR-007);
  distinguishing refresh from close is unreliable across browsers; doesn't fire on
  crash. Rejected as the primary mechanism (and once next-visit revocation exists, a
  best-effort beacon adds complexity without changing the guarantee).
- **Token in `sessionStorage` instead of a cookie**: would make sessions truly per-tab
  but (a) breaks FR-008 (no sharing without an explicit token handoff — more moving
  parts and secrets crossing `postMessage`), (b) abandons the HttpOnly protection the
  project deliberately chose (feature 002), (c) touches every API call. Rejected.
- **`localStorage` open-tab counter** (increment on load, decrement on `pagehide`):
  the classic approach, but counters go stale on crash → session wrongly kept alive, or
  wrongly killed with tabs still open. The lease+handshake needs no persistent counter
  and self-heals. Rejected.
- **Server-side heartbeat (short-TTL session + keep-alive pings)**: robust but adds
  recurring network traffic, drains mobile batteries, fights the Workers per-request
  connection model, and changes session semantics for everyone. Rejected as
  disproportionate; existing idle TTL already provides a server-side backstop.
- **`BroadcastChannel` availability**: Baseline across all modern browsers (Safari
  15.4+). If unavailable (ancient browser), the design degrades to "every new tab
  requires sign-in" — fails safe, never leaks access. Documented in the contract.

---

## Decision 4 — What "kill the session" must touch on the client

**Decision**: When bootstrap concludes "stale session" (lease absent, no peer), the
client must (in order): call `POST /api/auth/logout` (revokes server record + clears
cookie server-side; ignore network errors), call `clearVaultKey()` (IndexedDB persisted
non-extractable key — otherwise the *next* sign-in of a different account could race a
stale key), and start in the signed-out state without flashing protected UI.

**Rationale**: Feature 010 persists the unwrapped vault key in IndexedDB so refreshes
skip the unlock prompt. IndexedDB is *not* tab-scoped — if the session dies with the tab
but the key survives, the security win of tab-scoped sessions would be partly hollow
(the key alone can't call the API, but hygiene and FR-005's "no vault data without
sign-in" intent demand clearing it). The existing logout path already clears it; the
stale-session path must do the same.

**Alternatives considered**: leaving the key and letting the next login overwrite it —
rejected, weaker hygiene for a password manager and inconsistent with the logout path.

---

## Decision 5 — Scope guard: what deliberately does NOT change

**Decision**: No changes to: session document schema, idle/absolute TTLs, `validateSession`,
`requireSession`, roles, the salt/login/register payloads, vault crypto, `shared/` types,
or any route surface. The only backend diff is the cookie `maxAge` removal.

**Rationale**: FR-010/FR-011 mandate sign-out and expiry stay as-is; the tab lease is an
*additional* end-of-life trigger layered entirely client-side plus one cookie attribute.
Keeping the server contract identical means zero migration and zero cross-feature risk
(features 010/011 flows — unlock, reset, roles — are untouched).
