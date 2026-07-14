# Quickstart: Theme Support (Auto / Dark / Light)

**Feature**: specs/013-theme-support | **Date**: 2026-07-14

Manual verification walkthrough (no unit tests — Constitution Principle II).
Frontend-only feature; any working backend loop is fine.

## 1. Run the app

```powershell
# From repo root — Node API (:8787, preview DB) + Vite SPA (:5173), no wrangler:
npm run dev:node
```

Open http://localhost:5173 and sign in (any existing account; e.g. a test account
registered earlier on the preview DB).

## 2. Selector basics (User Story 1 / FR-002..004)

1. Open the account menu (avatar, top right).
2. Verify the panel shows — between the identity header and "Log out" — a **Theme**
   row with three icon buttons in order: **Auto** (half circle), **Dark** (moon),
   **Light** (sun). The old "Change theme" placeholder row is gone.
3. Exactly one is visually active; on a fresh browser profile it is **Auto**.
4. Click **Dark** → the whole app switches to a medium-gray appearance instantly
   (no reload); the menu stays open; Dark shows as active.
   DevTools check: `<html data-bs-theme="dark">`.
5. Click **Light** → light appearance instantly; Light active.
6. Navigate (vault, sign out → login page): appearance is consistent everywhere
   (FR-011 — signed-out pages honor the theme).
7. Sign in as the **normal-role** username: the selector is present and works
   identically (FR-012).

## 3. Auto mode (User Story 2 / FR-005..007)

1. Select **Auto**.
2. **OS preference follows**: flip Windows Settings → Personalization → Colors →
   "Choose your mode" between Light and Dark (or DevTools → Rendering → Emulate
   `prefers-color-scheme`). The app updates **live**, no reload.
3. **Explicit wins**: select **Dark**, flip the OS preference again → app stays dark
   (FR-007).
4. **Time fallback** (only used when NO preference is declared — rare on real OSes;
   verify the logic in DevTools console):

   ```js
   // With Rendering → Emulate prefers-color-scheme: "No emulation" on a device
   // reporting no preference, or by temporary inspection of resolve():
   // 05:59 → dark, 06:00 → light, 17:59 → light, 18:00 → dark (local clock)
   ```

   Acceptable check: temporarily change the machine clock to 19:00 with emulated
   no-preference and reload → dark; back to 12:00 → light.

## 4. Persistence (User Story 3 / FR-008, FR-009, FR-013)

1. Select **Dark** → refresh (F5). Page loads **directly dark — watch for any white
   flash on load; there must be none** (inline head script). Menu shows Dark active.
2. DevTools → Application → Local Storage: key `vii-pass:theme` = `dark`.
3. Sign out → login page is dark → sign back in → still dark.
4. Delete the localStorage key → refresh → app is back to **Auto** (FR-008).
5. Second tab: open the app in another tab, switch theme in tab 1 → tab 2 follows
   (storage event).
6. Storage blocked (optional): DevTools → Application → Storage → simulate via
   incognito with blocked site data → selection still themes the current visit; next
   visit is Auto; no error shown (FR-013).

## 5. Contrast & visual audit (FR-010 / SC-005)

In **Dark** mode, spot-check with DevTools' contrast ratio tool (inspect element →
color picker) on:

- Body text on page background (`--color-text` on `--color-bg`) — expect ≥ 4.5:1.
- Muted text (`--color-text-muted`) on cards (`--color-surface`) — ≥ 4.5:1.
- Links / primary buttons / danger alert text — ≥ 4.5:1.
- Vault: chord card titles, field values, masked dots, eye/copy icons visible.
- Login/home **decorative backgrounds are dimmed** and the auth card/vault content
  stays fully legible.
- Focus ring clearly visible on the gray background (tab through the menu).

Repeat a quick pass in **Light** mode (should be unchanged from before the feature).

## 6. Responsive & a11y spot-check (Constitution III)

1. DevTools device toolbar at **320px**: open the user menu — the theme row fits the
   280px-clamped panel, buttons are comfortably tappable (≥44px), no horizontal
   scroll in either theme.
2. Keyboard: Tab to the avatar → Enter opens the panel → Tab reaches each theme
   button → Enter/Space activates → Escape closes the menu.
3. Screen-reader sanity (optional, Narrator/NVDA): theme buttons announce as
   radio-style menu items with a checked state ("Dark theme, menu item radio,
   checked").
4. Forced colors (optional): Windows High Contrast → app remains usable; decorative
   backgrounds are stripped (existing guard).

## 7. Gates

```powershell
npm run typecheck   # all 3 workspaces
npm run lint
npm run build --workspaces --if-present
```

All must pass. No backend/shared changes should appear in `git status`.
