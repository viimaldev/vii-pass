# Quickstart: Darker, Less Colorful Dark Theme — Manual Verification

**Feature**: 021-darken-dark-theme | **Date**: 2026-07-21

## Prerequisites

```powershell
# From repo root — install (if needed) and start the dev servers
npm install
npm run dev   # or the workspace's usual frontend+backend dev command
```

Open the app in a browser. You will switch themes via the user menu (avatar →
theme radio icons: Auto / Dark / Light).

## 1. Capture "before" reference (optional but recommended)

On `main`, in **Dark** theme, screenshot: sign-in page, vault page (several sections
with vivid colors — e.g. bright red, lime, blue), open user menu, open entry dialog.
Keep for the SC-001 side-by-side.

## 2. Dark theme is darker (US1 / FR-001)

1. Sign in, switch to **Dark**.
2. Verify each surface is clearly darker than the reference: page background, auth
   cards (sign out and check login/register/reset too), home header, section tab bar
   shell, user menu panel, entry & section dialogs, form fields.
3. Confirm no surface is pure black except the dialog header/footer lattice bands,
   and page vs. card vs. menu remain visually distinguishable.

## 3. Colors are muted (US2 / FR-002, FR-003)

1. With vivid section colors, check the tab bar: colored fills are visibly less
   saturated than the reference, selected tab still obviously selected.
2. Chord cards: interiors still light, but ramps visibly muted (less vivid, slightly
   deeper) vs. reference.
3. Entry dialog Save button (`.btn-section`): muted section color fill, white label
   still legible.
4. Page background artwork (login + home): dimmer than reference; content clearly
   dominant.
5. Extreme colors edge case: set one section to near-black and one to pure lime —
   selected/unselected tabs must remain distinguishable for both; near-black card
   interior text still readable.

## 4. Readability & states (US3 / FR-006, FR-007)

1. Contrast spot-checks (DevTools color picker or a contrast tool) — all ≥4.5:1:
   - body text on page bg; muted text on surface; link/primary text on bg
   - error alert text on its tint (trigger a failed sign-in); success equivalents
   - button labels on `.btn-primary` and `.btn-section` fills
   - chord-card interior text on the deepest body band (near-black section color)
2. Keyboard-tab through: sign-in form, tab bar, cards, menus, dialogs — focus ring
   clearly visible on every stop.
3. Hover every button/tab/menu row — hover states visible; disabled/busy states
   distinguishable (save with spinner, disabled submit).

## 5. Light theme unchanged (FR-004 / SC-003)

1. Switch to **Light**. Walk sign-in, register, reset, vault, menus, dialogs.
2. Everything must render exactly as on `main` (compare screenshots if in doubt).

## 6. Auto mode & guards (FR-005, FR-008)

1. Switch to **Auto**; flip the OS color scheme dark↔light — resolved theme follows
   immediately and the dark result uses the NEW palette everywhere (no mixed values).
2. Refresh in dark — no flash of the old/medium palette (pre-paint script untouched).
3. Windows High Contrast / forced-colors: backgrounds stripped, system colors apply.
4. Print preview (light + dark): art stripped, print styling unchanged.
5. `prefers-reduced-motion: reduce`: unchanged behavior (no motion changes in this
   feature).

## 7. Responsive sweep (Constitution III / SC-004)

At 320px, ~768px, and desktop widths, in dark theme: complete sign-in → view vault →
switch sections → add/edit/delete an entry → open user menu → sign out. No state or
control invisible or ambiguous at any width.

## 8. Gates

```powershell
npm run lint        # zero errors
npm run typecheck   # zero errors (no TS changes expected)
npm run build       # clean build
```
