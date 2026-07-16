# Quickstart: App Logo Branding

**Feature**: 018-logo-branding | **Date**: 2026-07-16

Manual verification guide (Constitution II: no unit tests — verify by hand).

## Prerequisites

```powershell
npm install          # repo root — workspaces
npm run dev          # starts backend (wrangler dev) + frontend (vite, http://localhost:5173)
```

Assets must exist: `frontend/public/logo/full_logo.png`, `frontend/public/logo/logo.png`.

## 1. Auth pages (User Story 1 — P1)

1. Open `http://localhost:5173/login` while signed out.
2. ✅ The full Vii Pass logo (mark + "PASS" wordmark) appears at the top of the card
   where the text "Vii Pass" used to be; the "Sign in" heading sits below it.
3. Repeat for `/register` and `/reset` — ✅ same logo, same size, same position.
4. DevTools → toggle device toolbar → 320 px width:
   ✅ logo scales down inside the card, no overflow/horizontal scroll, no distortion.
5. DevTools → Network → disable cache, block `full_logo.png` (or rename it briefly):
   ✅ the text "Vii Pass" (alt) shows in its place; the form still renders normally.

## 2. Home page header (User Story 2 — P2)

1. Sign in; land on `/`.
2. ✅ The header's left brand slot shows the full logo instead of text; header height,
   section tabs, and account-menu positions look unchanged.
3. Click the logo: ✅ navigates home and refreshes the vault (existing brand-link
   behavior).
4. Mobile width (~320–420 px): ✅ logo shrinks/holds at header height, no collision
   with tabs or the account menu, header stays on one line.

## 3. Browser tab icon (User Story 3 — P3)

1. Hard-reload any page (Ctrl+Shift+R).
2. ✅ The browser tab shows the "V" mark icon next to the title "Vii Pass".
3. ✅ Title text is still exactly "Vii Pass".
4. Bookmark the page: ✅ the mark appears as the bookmark icon.

## 4. Themes (FR-009)

1. Account menu → theme radios → **Dark**:
   ✅ logo on the home header is clearly visible (light-toned via CSS filter).
2. Sign out → `/login` in dark theme: ✅ logo clearly visible on the auth card.
3. Switch to **Light**: ✅ original artwork colors, unfiltered.

## 5. Accessibility

1. Screen reader (or DevTools accessibility pane) on `/login`:
   ✅ the logo image has accessible name "Vii Pass".
2. Home header: ✅ the brand link's accessible name is "Vii Pass".
3. Keyboard-tab through the header: ✅ focus order unchanged (skip link → brand link →
   tabs → account menu).

## 6. Regression sweep (FR-010 / SC-005)

- Sign in, create account, reset password, add/edit/delete a chord: ✅ all flows work
  exactly as before.
- `npm run lint` at repo root: ✅ zero errors.
- `npm run build` (frontend): ✅ builds clean; `dist/logo/*.png` present.
