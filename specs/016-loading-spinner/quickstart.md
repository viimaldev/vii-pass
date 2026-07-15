# Quickstart: Loading Spinner Indicator

**Feature**: specs/016-loading-spinner | **Date**: 2026-07-15

Manual verification walkthrough (no unit tests — Constitution Principle II).

## 0. Run locally

```powershell
# From repo root — Node API (:8787, preview DB) + Vite SPA (:5173), no wrangler
npm run dev:node
```

Open http://localhost:5173. To make loading states observable, throttle the
network in DevTools (e.g., "Slow 3G") before each step.

## 1. Page-level spinner — session bootstrap (US1)

1. Sign in, then hard-refresh the app with throttling on.
2. While the session is being restored (ProtectedRoute wait):
   - The circular dotted spinner appears **centered in the viewport** (both axes).
   - No visible "Loading…" text; no horizontal scrollbar.
3. In DevTools, inspect the wait: a `role="status"` element still exists with
   visually-hidden loading text; the SVG has `aria-hidden="true"`.
4. When loading completes, the spinner disappears with no layout jump.

## 2. Page-level spinner — vault load (US1)

1. With throttling on, navigate to the home page (or refresh while signed in).
2. While `/api/vault` is in flight, the same centered spinner shows; when the
   grid renders, it's gone. Verify no leftover "Loading your sections…" /
   "Loading entries…" text anywhere (grep the built UI or the source).

## 3. Button spinners (US2)

With throttling on, trigger each and confirm: a small spinner appears **before**
the busy text, the button is disabled, its height doesn't change, and the
spinner disappears on completion or error:

| Surface | Action | Expected busy content |
|---------|--------|-----------------------|
| Login | submit | ⟳ Signing in… |
| Register | submit | ⟳ Creating account… |
| Home (locked vault) | unlock | ⟳ Unlocking… |
| Add/Edit entry dialog | save / delete | ⟳ Saving… / ⟳ Deleting… |
| Section dialog | save / delete | ⟳ Saving… / ⟳ Deleting… |
| Reset password | each of 3 steps | ⟳ Checking… / ⟳ Verifying… / ⟳ Resetting… |
| User menu | log out | ⟳ Signing out… |

Error path spot-check: submit login with a wrong password (throttled) — spinner
shows while pending, then disappears and the normal error message renders.

## 4. Consistency (SC-003)

Compare any page spinner and any button spinner side by side: identical motif
(10-dot graduated ring), just scaled.

## 5. Themes & degradation (US3 / FR-006)

1. Switch theme via the user menu: spinner clearly visible in **light** and
   **dark** (it inherits the text color).
2. DevTools → Rendering → emulate `prefers-reduced-motion: reduce`: spinners
   stop rotating but the static graduated ring stays visible.
3. Emulate `forced-colors: active`: spinner still perceivable (system ink).
4. Print preview on a loading page: spinner hidden, no artifacts.

## 6. Responsive (SC-002)

At 320px, 768px, and 1280px widths:

- Page spinner centered, fully visible, `document.documentElement.scrollWidth
  === clientWidth` (no horizontal scroll).
- Button spinners don't wrap busy labels onto a second line at 320px.

## 7. Roles

Repeat step 1–2 signed in as a **normal**-role username: identical spinners.

## 8. Gates

```powershell
npm run typecheck   # all 3 workspaces
npm run lint
npm run build --workspaces --if-present
```

All green; `git diff --stat backend/ shared/` is empty (frontend-only feature).
