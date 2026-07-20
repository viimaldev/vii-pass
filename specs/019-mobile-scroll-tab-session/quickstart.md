# Quickstart: Mobile Single-Scroll Layout & Tab-Scoped Sessions

**Feature**: specs/019-mobile-scroll-tab-session | **Branch**: `topic/vii-1022-mobile-scroll-tab-session`

## 1. Run locally

```powershell
# From repo root — Node API (:8787, preview DB) + Vite SPA (:5173), no wrangler:
npm run dev:node
```

Open http://localhost:5173. Test account (preview DB): `themeadmin` / `abc123`
(normal username `themeuser`; security answer `rex`) — register a fresh account if the
preview DB has been reset.

## 2. Verify US1 — single scroll region on mobile

Use browser devtools device emulation (or a real phone against your LAN IP).

1. Sign in; ensure the selected section has more entries than fit one screen (create a
   few if needed).
2. **320×568 portrait**: scroll the page body — it must not move; only the entries list
   scrolls. In the console:
   ```js
   const se = document.scrollingElement;
   se.scrollHeight === se.clientHeight   // → true (no page overflow)
   ```
3. Scroll the entries to the very end — no white/blank band below the app content.
4. Switch to a section with 0–2 entries — no scrollbars anywhere, no white band.
5. **568×320 landscape**: repeat step 2.
6. Focus a field in the Add-entry dialog (on-screen keyboard on a real device) — no
   page scrollbar appears.
7. **768 and 1280 widths**: confirm scrolling behavior identical to `main` (regression).
8. Log out → login page at **320×480**: if the form is taller than the viewport, the
   page itself still scrolls (auth-page exemption).
9. Repeat step 2 in **dark theme** — any transient edge must show the dark background,
   never white.

## 3. Verify US2 — session ends when the last tab closes

1. Sign in in a fresh tab. Refresh the page (F5) → still signed in, vault unlocked
   (FR-007 — lease survives refresh).
2. Close the tab WITHOUT signing out.
3. Open the app in a new tab → the SIGN-IN page must appear (no vault flash), and:
   - DevTools → Application → Cookies: the `session` cookie is gone (cleared by the
     revoke call).
   - Network: a `POST /api/auth/logout` fired during bootstrap.
   - Application → IndexedDB `vii-pass-vault`: the persisted key record is cleared.
4. (Server check, optional) the `sessions` document for the old tokenHash is deleted.
5. Close the whole browser instead of just the tab; reopen → sign-in required (the
   browser-session cookie died with the browser).

## 4. Verify US3 — additional tabs share the session

1. Sign in in tab A.
2. Open the app in tab B (same browser) → tab B is signed in immediately, no prompt,
   vault decrypts (watch Network: only `/me` + `/vault`, no `/logout`).
3. Close tab A → tab B keeps working (navigate, reveal, copy).
4. Refresh tab B → still signed in.
5. Close tab B too; reopen the app → sign-in required (US2 again, now via the B lease).
6. Sign in in two tabs; sign out in tab A → tab B's next action hits a 401 and shows
   the session-expired path (FR-010).

## 5. Degradation spot-checks

- Simulate no `BroadcastChannel` (devtools: `delete window.BroadcastChannel` before the
  app loads, or an older engine): a NEW tab beside a live one requires sign-in — fails
  safe, never silently grants access.
- Private/incognito window: behaves like a fresh browser — sign-in required.

## 6. Gates (must be green before ship)

```powershell
npm run typecheck   # all 3 workspaces
npm run lint        # eslint .
npm run build --workspaces --if-present   # frontend vite build
```

Also confirm: `git diff shared/` is empty; the backend diff touches ONLY
`setSessionCookie` in sessions.service.ts.
