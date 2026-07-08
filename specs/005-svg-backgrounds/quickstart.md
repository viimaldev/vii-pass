# Quickstart: SVG Background Placeholders

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-07-08

This walkthrough verifies the feature end to end once implemented: **decorative backgrounds appear
on login and home → they adapt across desktop/tablet/mobile → they are drop-in replaceable → they
degrade gracefully → they stay invisible to assistive tech**. It assumes the vii-pass monorepo is
installed (`npm install` at the repo root).

---

## 1. Prerequisites

- Node 18+ and repo dependencies installed (`npm install` at the repo root).
- No new environment variables and no database are required for this feature.
- Local dev env files already present (per repo setup): `frontend/.env.local` with
  `VITE_API_BASE_URL="http://localhost:8787"` and `backend/.dev.vars` (only needed so the app boots
  and login works; the backgrounds themselves need no backend).

---

## 2. Run the app locally

From the repo root:

```powershell
npm run dev:node
```

This starts the Node API (`http://localhost:8787`) and the Vite SPA (`http://localhost:5173`)
without Wrangler. Open **http://localhost:5173**.

> The background assets are static files under `frontend/public/backgrounds/`; Vite serves them at
> `/backgrounds/*`. You can confirm one loads directly at
> **http://localhost:5173/backgrounds/login-desktop.svg**.

---

## 3. Verify the backgrounds (US1 — FR-001/FR-002/FR-005/FR-009)

1. Unauthenticated, visiting `/` redirects to **/login**. Confirm a **decorative background** is
   visible behind the sign-in card, and the heading, inputs, and button remain fully legible.
2. Sign in (or register) to reach the **home** page. Confirm a decorative background is visible
   behind the welcome card and the text stays legible.
3. Interact with the form and the account menu. Confirm the background **never** blocks clicks,
   focus, or the dropdown — content sits above it at all times.

**Accessibility spot-check (FR-009 / SC-007)**

- Tab through the login form. Confirm the background adds **no** extra focus stops and the focus
  order is unchanged.
- In DevTools → Elements → Accessibility tree (or a screen reader), confirm the background element
  exposes **no** image/role and is not announced (CSS backgrounds are absent from the a11y tree).

---

## 4. Verify responsiveness (US2 — FR-006/FR-008/SC-001/SC-002)

Open DevTools → device toolbar (responsive mode) and check the login and home pages at:

| Width | Expectation |
|-------|-------------|
| **~320px** (small phone) | Background fills its area with **no distortion** and **no horizontal scrollbar**; all card content visible/readable. |
| **~768px** (tablet) | Desktop background shown, scaled via `cover`, no gaps. |
| **≥1200px** (desktop) | Background crisp (SVG), anchored `center top`, no empty bands even on wide screens. |

**Confirm the two mobile strategies:**

- **Login (alternate file)**: at ≤575px the network panel shows `login-mobile.svg` requested; above
  575px it shows `login-desktop.svg`.
- **Home (cover-crop)**: at all widths only `home-desktop.svg` is requested; on a narrow viewport it
  is cropped by `cover` with no distortion (no separate mobile file exists — by design).

---

## 5. Verify drop-in replaceability (US3 — FR-003/SC-004)

1. In `frontend/public/backgrounds/`, replace `home-desktop.svg` with any other SVG saved under the
   **same filename** (keep a backup).
2. With `npm run dev:node` running, reload the home page. Confirm the new graphic appears **without
   any code, markup, or layout change**.
3. Restore the original placeholder file.

**Reuse on a new container (SC-005)** — optional: apply `class="page-bg page-bg--home"` to any test
container and confirm it receives the same background treatment using only the documented classes,
with no bespoke CSS.

---

## 6. Verify graceful degradation (edge cases — FR-011)

1. **Load failure**: temporarily rename `login-desktop.svg` (or block it in DevTools → Network →
   block request URL) and reload `/login`. Confirm the surface falls back to the on-brand
   `--color-surface` color and the page stays fully usable (no broken-image icon, no layout shift).
   Restore the file afterward.
2. **Print**: open the browser Print preview for either page and confirm the decorative background is
   **not** printed (content remains clean).
3. **Forced colors / high contrast**: enable a high-contrast/forced-colors mode and confirm the
   background image yields to the system palette while text stays readable.

---

## 7. Quality gates

From the repo root, confirm the change is clean:

```powershell
npm run typecheck
npm run lint
npm run build --workspaces --if-present
```

All three MUST pass (TypeScript strict across workspaces, ESLint/Prettier clean, and the frontend
Vite build succeeds with the new assets copied into `dist/backgrounds/`).

---

## 8. Success criteria mapping

| Check | Success Criterion |
|-------|-------------------|
| Backgrounds on login & home across 320px→desktop, no overlap/scroll | SC-001 |
| ~320px renders without distortion, all content readable | SC-002 |
| Foreground text ≥ WCAG AA over its surface (content on opaque cards) | SC-003 |
| Replace a file in one folder → page updates, zero code change | SC-004 |
| New container styled via documented classes only | SC-005 |
| No time-to-interactive regression; page usable if asset fails | SC-006 |
| Backgrounds produce no screen-reader announcements / focus entries | SC-007 |
