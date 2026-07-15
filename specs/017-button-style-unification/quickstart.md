# Quickstart: Verifying Button Style Unification

**Feature**: 017-button-style-unification | **Date**: 2026-07-15

Manual browser verification (no unit tests per Constitution Principle II).

## 1. Start the app

```powershell
# From repo root — Node API (:8787, preview DB) + Vite SPA (:5173), no wrangler
npm run dev:node
```

Open http://localhost:5173. Test account: `themeadmin` / `abc123` (normal-role login:
`themeuser`).

## 2. Shape sweep — every surface (US1)

On each surface, confirm every rectangular button shows ONLY the upper-right corner
rounded (visually matching a section tab), with unchanged height:

1. **/login** — "Sign in" button (full width).
2. **/register** — "Create account" button.
3. **/reset** — all 3 step submits + the final "Back to sign in" link-button.
4. **Home vault** — the "+" add-entry tile (upper-right-rounded), the "+" add-section
   tab (already tab-shaped), the unlock button (delete the IndexedDB key
   `vii-pass-vault` and reload to see it).
5. **Entry dialog** (open "+" tile) — Save + Cancel; edit an entry → Save/Cancel +
   delete-confirm's Cancel/"Delete entry".
6. **Section dialog** — Save + Cancel (+ delete-confirm variant).
7. **User menu** — hover the "Sign out" row: the hover highlight carries the same
   corner treatment. Avatar stays circular; theme icon buttons unchanged.

## 3. Section-colored primary (US2)

1. Create/select a section with a strong color (e.g. red). Open the add-entry dialog →
   **Save is filled with that red**, Cancel is solid gray (no transparency — drag the
   dialog over the page art if unsure).
2. Switch to a differently-colored section (e.g. teal) → reopen dialog → Save is teal.
3. Edit an existing entry from each section → Save follows the entry's own section
   color.
4. Extreme colors: temporarily set a section color to near-white (`#ffff66`) and
   near-black (`#111111`) → the Save label flips between dark and white text and stays
   clearly readable (≥4.5:1).
5. Gap: the space between Cancel and Save is visibly one step wider than before
   (0.75rem vs 0.5rem); no wrap at 320px (DevTools responsive mode).
6. Busy state: save an entry on a throttled network → the inline spinner + "Saving…"
   render on the colored button at unchanged height.

## 4. Dark-theme eye/copy hover (US3)

1. User menu → set theme **Dark**.
2. On a chord card, hover the **eye** on a sensitive value, then the **copy** control,
   then the **edit** (pencil) icon in the card header → all three show the SAME
   translucent dark wash.
3. Keyboard: Tab to the eye/copy controls → focus shows at least the hover wash plus
   the global focus outline.
4. Switch theme to **Light** → eye/copy hover shows the familiar light-gray block
   (pre-change appearance, unchanged).

## 5. Regression sweep

- Both themes: buttons keep AA label contrast (brand blue/gray variants unchanged
  except shape).
- 320 / 768 / 1280 px: no horizontal overflow, no wrapped action rows.
- Forced-colors emulation (DevTools → Rendering → `forced-colors: active`): buttons
  remain visible and usable.
- Print preview: pages don't render broken button chrome.
- Normal-role login (`themeuser`): the buttons that remain (no mutation controls) all
  carry the unified style.

## 6. Gates

```powershell
npm run typecheck   # all 3 workspaces
npm run lint
npm run build --workspaces --if-present
git diff --stat backend/ shared/   # MUST be empty
```
