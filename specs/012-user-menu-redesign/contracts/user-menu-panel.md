# UI Contract: Account Menu Panel

**Feature**: 012-user-menu-redesign | **Date**: 2026-07-14

There are **no API contract changes** in this feature (no routes, payloads, or shared
types touched). This document instead specifies the user-facing contract of the
redesigned menu panel so implementation and review have a fixed target.

## Trigger (unchanged)

| Aspect | Contract |
|--------|----------|
| Element | `<button class="user-menu__avatar">` in the navbar |
| Content | Single uppercase initial (displayName → username → `?` fallback) |
| ARIA | `aria-haspopup="menu"`, `aria-expanded={open}`, `aria-label="Account menu for {displayName}"` |
| Behavior | Toggles panel; panel closes on outside click and Escape |

## Panel structure (new)

```text
.user-menu__panel [role="menu"] [aria-label="Account"]
├── .user-menu__header                      (identity header, divider below)
│   ├── .user-menu__badge                   circular, ~40px, initial only — NO image
│   └── (text column)
│       ├── .user-menu__name                displayName — larger (~1.05rem), bold (700)
│       └── .user-menu__id                  username — small, muted, text-break
├── button.dropdown-item.user-menu__item [role="menuitem"]   "Change theme"
│   ├── inline SVG icon (palette), aria-hidden="true"
│   └── label text
└── button.dropdown-item.user-menu__item [role="menuitem"]   "Log out"
    ├── inline SVG icon (box-arrow-right), aria-hidden="true"
    └── label text ("Signing out…" while busy, aria-busy="true", disabled)
```

## Behavioral contract

| Item | Contract |
|------|----------|
| Change theme (FR-005/006) | Focusable, activatable, **no effect**: no theme change, no navigation, no error, menu stays open. Not `disabled`. |
| Log out (FR-004) | Identical logic to today: sets busy → `logout()` → redirect `/login` → panel closes. Only presentation (icon) changes. |
| Row order | Change theme above Log out; identity header always first. |
| Icons (SC-002) | Every actionable row has a leading 16×16 `currentColor` SVG, consistent left alignment/gap. |
| Overflow (FR-009) | Long displayName/username wrap (`text-break`/`overflow-wrap`) inside panel `max-width: min(280px, 100vw - var(--space-4))` — no horizontal viewport overflow. |
| Responsive (FR-008/SC-004) | No clipping at 320px / 768px / 1280px; rows ≥40px tall (touch). |
| Keyboard (FR-007/SC-005) | Open via Enter/Space on trigger, Tab through rows, activate via Enter/Space, Escape closes — all preserved. |
| Roles | Panel content identical for `admin` and `normal` sessions. |

## Visual contract (from design tokens only)

- Badge: `--color-primary` background, white bold initial, `border-radius: 50%`.
- Name: `--color-text`, weight 700, ~1.05rem.
- Username: `--color-text-muted`, Bootstrap `small` scale.
- Divider: `1px solid --color-border` (existing `border-bottom` idiom).
- Spacing: header padding `--space-3`; row gap `--space-2`; no hardcoded colors.
