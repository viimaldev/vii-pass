# Quickstart: UI Micro-Animations — manual verification

**Feature**: specs/020-ui-animations | **Date**: 2026-07-20

Frontend-only feature; no backend/DB setup beyond the normal dev loop.

## 1. Run the app

```powershell
# From repo root — Node API (:8787) + Vite SPA (:5173), preview DB
npm run dev:node
```

Sign in with a dev account (e.g. `themeadmin` / `abc123`) or register a fresh one.

## 2. Button hover sweep (US1)

1. On `/login`, hover **Sign in**: the darker fill should travel from the RIGHT edge to the
   LEFT over ~500ms — never an instant full swap.
2. Move the pointer away mid-sweep: fill retracts smoothly toward the right; no stuck band.
3. Click during the sweep: sign-in fires immediately (wrong password is fine — you only
   need the request to fire).
4. Repeat on: register **Create account**, dialog **Save**/**Cancel** (`.btn-section` +
   `.btn-secondary`), the **＋ add-entry tile**, and user-menu **Log out** row.
5. While a button shows the busy spinner (throttle network if needed), hover it: NO sweep.
6. Rapidly sweep the pointer across the dialog footer buttons 10×: no flicker/stuck states.

## 3. Chord card glow (US2)

1. On the vault, hover a chord card: a soft section-colored glow fades in over ~500ms.
2. Move away: it fades out symmetrically.
3. Watch the neighboring cards: zero movement (no layout shift).
4. Switch to dark theme (user menu) and to a section with a different color: glow follows
   the section color; card interior legibility unchanged.

## 4. Staggered entrance (US3)

1. Refresh the vault page: cards appear one after another (60ms apart, rising fade).
2. Switch sections: the sequence replays for the new section's cards.
3. In a section with many entries (create ~10 test entries if needed): last card fully
   visible well within 1.5s; click the FIRST card's copy button while later cards are still
   entering — it works.
4. Add one entry: only the new card animates in; the rest do NOT replay.
5. Edit, delete, and drag-reorder an entry: NO entrance replay on any of them.
6. Switch to an empty section: clean empty state, no animation artifacts.

## 5. Focus trace (US4)

1. Click into the login username field: a 2px primary-colored line draws LEFT → RIGHT along
   the bottom over ~300ms; the normal focus ring is present INSTANTLY (before/while the
   line draws).
2. Tab rapidly through register's six fields: every field shows visible focus at all
   times; the trace never lags focus visibility.
3. Trigger a validation error (bad username), focus the invalid field: danger border and
   primary trace are both distinguishable.
4. Blur a field: the line clears without artifacts.

## 6. Dialog zoom (US5)

1. Open the **new section** dialog (＋ tab): panel zooms in from ~94% scale, backdrop fades.
2. Open the **new entry** dialog (＋ tile): same zoom.
3. Press Escape the instant it starts opening: closes cleanly, no stuck backdrop.
4. Verify autofocus lands in the first field exactly as before.

## 7. Accessibility & degradation

1. **Reduced motion** (DevTools → Rendering → emulate `prefers-reduced-motion: reduce`):
   re-run §2–§6 — hover/focus/open states still change VISIBLY but with zero motion
   (no sweep travel, no glow fade, no stagger, no trace draw, no zoom).
2. **Forced colors** (emulate `forced-colors: active`): buttons/inputs show UA-native
   hover/focus; nothing illegible.
3. **Touch check** (DevTools device emulation, touch): tap a button and a card — no hover
   sweep/glow left stuck after the tap.
4. **Print preview**: vault prints without glow shadows; existing print guards intact.

## 8. Responsive + themes sweep

At 320px, 768px, and 1280px, in light AND dark theme: repeat one spot-check from each of
§2–§6. No horizontal scroll, no layout shift caused by any animation.

## 9. Gates & scope checks

```powershell
npm run typecheck
npm run lint
npm run build --workspaces --if-present
git diff --stat backend/ shared/    # MUST be empty
```

Also confirm: no new dependencies in any `package.json`; the only component diffs are
`ChordGrid.tsx` and `HomePage.tsx`; all other changes live in `tokens.css`.
