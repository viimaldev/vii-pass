# Quickstart: Section Color Theming for Chords & Unified Buttons

**Feature**: specs/014-section-color-theming | **Date**: 2026-07-14

Manual verification walkthrough (no unit tests — Constitution Principle II).

## 0. Prerequisites

- Feature 013 (theme support) merged into this branch — `frontend/src/theme/ThemeContext.tsx`
  must exist and the user menu must show the Auto/Dark/Light selector.
- Local stack running against the preview DB:

  ```powershell
  npm run dev:node   # from repo root → API :8787 + SPA :5173
  ```

- A signed-in admin account (e.g. register a fresh one; password 3–10 chars).

## 1. Section color reaches the cards (US1 — P1)

1. Create two sections with clearly different colors (e.g. green `#1a7f37` and purple
   `#6f42c1`) and add one chord to each (title + a username + a password field).
2. In **light** theme, for each section tab:
   - Card **header** shows a top-to-bottom linear gradient of the section color blended
     toward **white**; header title/icons are dark and readable.
   - Card **body** shows a subtle light tint gradient of the same color; field icons,
     values, and masked dots readable.
3. Switch to **dark** theme (user menu → moon):
   - Header gradient re-blends toward **black**, foreground flips to white.
   - Body becomes a dark shade of the section color; text stays readable.
4. Switch between the two section tabs: cards always match the active tab's color, never
   the previous one.
5. The default **Mine** section's cards use its stored color the same way.

## 2. Extreme colors stay readable (FR-004)

1. Create sections colored `#000000`-near (darkest picker value), near-white, and a neon
   (`#00ff00`). Add a chord to each.
2. In both themes confirm: header title, eye/copy/edit buttons, body values, masked
   dots, and the muted field icons are all clearly readable; focus outlines (Tab through
   the card) are visible over both gradients.

## 3. Unified buttons (US2 — P2)

1. Visit every surface: `/login`, `/register`, `/reset`, vault home, create/edit section
   dialog, add/edit chord dialog, user menu.
2. Confirm **no button label is bold** — including the **selected section tab** and the
   **avatar trigger initial** (both previously bold).
3. Confirm variants are told apart by design/size (filled primary vs outline cancel vs
   filled danger vs icon-only), in both themes.
4. Confirm no button took on the section color (add tile/tab still faint primary).
5. DevTools spot-check: computed `font-weight` of a few buttons = 400.

## 4. Live correctness (US3 — P3)

1. With cards visible, flip theme Light → Dark → Auto: every visible card re-blends
   instantly, no reload, no flash of stale color.
2. If OS theme can be toggled: set app to Auto, flip the OS theme — cards follow.
3. Create a brand-new section with a new color, add a chord — the first card is tinted
   correctly immediately.

## 5. Degradation & roles

1. **Print preview** (Ctrl+P) on the vault: card content legible.
2. **Forced colors** (DevTools → Rendering → emulate `forced-colors: active`): cards
   readable, focus indicators visible, no invisible text.
3. Sign in with the **normal** (read-only) username: identical card coloring, minus the
   mutation controls.
4. Locked vault (clear IndexedDB key or fresh browser profile → refresh): masked cards
   still carry the section gradients.

## 6. Responsive spot-check (Constitution III)

At 320px, 768px, and 1280px widths: card gradients render correctly, no horizontal
overflow, icon buttons hit ≥44px targets on touch emulation, tabs strip still scrolls.

## 7. Gates

```powershell
npm run typecheck      # all 3 workspaces
npm run lint
npm run build --workspaces --if-present
```

All must pass; backend/ and shared/ diffs must be empty.
