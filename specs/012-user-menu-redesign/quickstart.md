# Quickstart: User Menu Redesign

**Feature**: 012-user-menu-redesign | **Branch**: `topic/vii-1013-user-menu-redesign`

## What this feature does

Restyles the opened account menu: roomy identity header (initial badge + big bold
display name + smaller muted username), then icon-led rows — a non-functional
"Change theme" placeholder and the existing Log out (now with icon).

## Files touched

| File | Change |
|------|--------|
| [frontend/src/components/UserMenu.tsx](../../frontend/src/components/UserMenu.tsx) | Panel markup: header, icon rows, Change theme placeholder, inline SVG icons |
| [frontend/src/styles/tokens.css](../../frontend/src/styles/tokens.css) | New `.user-menu__header/badge/name/id/item` rules beside existing `.user-menu__*` block |

Nothing else changes — no backend, shared types, routes, or dependencies.

## Run locally

```powershell
# from repo root
npm install            # if not already done
npm run dev            # starts backend (wrangler dev) + frontend (vite) per root package.json
# frontend: http://localhost:5173
```

## Verify (manual — no unit tests per constitution)

1. **Sign in**, click the corner initial avatar.
2. **Header**: circular badge with initial (no photo), display name large + bold,
   username smaller/muted below, divider under the header.
3. **Rows**: "Change theme" (palette icon) above "Log out" (box-arrow-right icon);
   comfortable spacing — the panel no longer feels congested.
4. **Change theme**: click it → nothing happens (no error, no theme change, menu stays
   open). Tab to it and press Enter → same.
5. **Log out**: click → "Signing out…" busy state → redirected to `/login`.
6. **Keyboard**: trigger opens with Enter/Space; Escape closes; all rows reachable and
   activatable by keyboard only.
7. **Responsive**: DevTools at 320px, 768px, 1280px — panel never overflows the
   viewport; rows are ≥40px touch targets.
8. **Long values**: register a user with a long display name → name wraps/truncates
   inside the panel without breaking layout.
9. **Lint gate**: `npm run lint` from repo root is clean.

## Out of scope

- Actual theme switching (FR-006 — placeholder only).
- Account Settings / Manage Projects / Help Center rows from the reference image.
- Any change to the navbar trigger button behavior.
