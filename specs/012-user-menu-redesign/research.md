# Research: User Menu Redesign

**Feature**: 012-user-menu-redesign | **Date**: 2026-07-14

No NEEDS CLARIFICATION markers remained in the Technical Context — this is a small,
frontend-only restyle. The decisions below lock in the approach.

## Decision 1 — Icon strategy: inline Bootstrap-Icons SVG paths

- **Decision**: Embed the two needed icons (`palette` for Change theme,
  `box-arrow-right` for Log out) as inline SVG constants inside `UserMenu.tsx`,
  `aria-hidden="true"`, `fill="currentColor"`, 16×16 viewBox.
- **Rationale**: This is the repo's established iconography pattern
  (`frontend/src/components/chordFieldTypes.tsx` and other components already inline
  Bootstrap-Icons paths). Zero new dependencies (constitution V / repo convention:
  "no new deps"), icons inherit text color for automatic contrast, and only two
  glyphs are needed — an icon library would be over-engineering.
- **Alternatives considered**:
  - `bootstrap-icons` npm package (font or React wrapper) — rejected: adds a
    dependency and bundle weight for two glyphs.
  - Reusing/extending `chordFieldTypes.tsx` — rejected: that module is deliberately
    chord-field-specific; sharing its private `svg()` helper for menu icons would
    couple unrelated concerns for ~10 saved lines.

## Decision 2 — Styling: extend the existing `.user-menu__*` block in tokens.css

- **Decision**: Add `.user-menu__header`, `.user-menu__badge`, `.user-menu__name`,
  `.user-menu__id`, and `.user-menu__item` rules to the existing user-menu section of
  `frontend/src/styles/tokens.css`, built entirely from existing design tokens
  (`--space-*`, `--color-*`, `--radius`).
- **Rationale**: Constitution III prohibits one-off styles; the file already hosts the
  `.user-menu` / `.user-menu__avatar` / `.user-menu__panel` rules, so the new classes
  live beside their siblings. Bootstrap utilities alone can't express the badge circle
  and row min-height cleanly without utility soup in JSX.
- **Alternatives considered**:
  - Pure Bootstrap utility classes in JSX (`d-flex gap-2 py-2 fw-bold fs-6 …`) —
    rejected: harder to keep consistent, no place to encode the 40px touch-target
    minimum, and diverges from how the panel is already styled.
  - CSS module for UserMenu — rejected: the repo has no CSS-module convention; all
    component CSS lives in `tokens.css`.

## Decision 3 — "Change theme" placeholder semantics

- **Decision**: Render Change theme as a real `<button role="menuitem">` with an empty
  (commented) click handler; it does not close the menu, navigate, or toggle anything.
  No `disabled` attribute.
- **Rationale**: The spec (FR-005/FR-006) wants the row visible and activatable with no
  effect. A disabled button would be skipped by some AT and communicates "unavailable"
  rather than "coming soon"; a non-interactive `<div>` would break the menu's keyboard
  traversal. A real button keeps focus order correct today and becomes the natural
  mount point when theme switching ships (clean extension point, YAGNI-compliant).
- **Alternatives considered**:
  - `disabled` button — rejected: unfocusable in most browsers, confusing AT
    announcement, and gray styling fights the reference design.
  - Hiding the row until the theme feature exists — rejected: user explicitly asked
    for the row now.

## Decision 4 — Identity header layout (badge + two-line text)

- **Decision**: Horizontal flex header: 40px circular initial badge (primary
  background, white bold letter — same visual language as the 28px navbar trigger)
  next to a column with the display name (`~1.05rem`, weight 700) above the username
  (Bootstrap `small` + `--color-text-muted`, `text-break`). Divider (`border-bottom`)
  separates header from rows.
- **Rationale**: Mirrors the attached reference (avatar left, name big, identifier
  small below) while honoring "no profile, only initial". Reusing the trigger's badge
  styling keeps the design system coherent. `text-break` + the panel's existing
  `max-width` clamp satisfy FR-009 (long names) and FR-008 (320px viewport).
- **Alternatives considered**:
  - Centered/stacked header (badge above name) — rejected: taller panel, doesn't match
    the reference image.
  - Larger 48px+ badge — rejected: pushes the panel wider than its 280px clamp allows
    comfortable name wrapping at 320px viewports.

## Decision 5 — Scope guard: reference-image rows not requested are excluded

- **Decision**: Only the identity header, Change theme, and Log out appear. Account
  Settings, Manage Projects, and Help Center from the reference screenshot are NOT
  added.
- **Rationale**: The user enumerated exactly what to take from the image; adding dead
  navigation rows would violate YAGNI and create broken affordances.
- **Alternatives considered**: Adding disabled placeholder rows for the other items —
  rejected: not requested, pure clutter (the very problem this feature fixes).
