# UI Contract: Section Tab Strip (Redesign)

**Feature**: 008-section-tab-redesign | **Date**: 2026-07-10

This feature exposes no API/network contract (presentation-only). The relevant contract is
the **UI/DOM + visual contract** of the section tab strip, which consumers (users, and any
downstream styling) rely on. It documents what MUST hold after the redesign.

## Component

`SectionTabs` → renders into `frontend/src/styles/tokens.css` classes.

## DOM / accessibility contract (MUST remain stable)

- Container: `<div class="section-tabs" role="tablist" aria-label="Credential sections">`.
- Each tab: element with `role="tab"`, `aria-selected` reflecting selection, `tabIndex`
  (0 for selected, -1 otherwise), class `section-tab` (+ `is-selected` / `is-dragging`),
  a `title` tooltip with the full section name, and a `.section-tab__label` child.
- Trailing add control: `<button class="section-tab section-tab--add" aria-label="Add a
  section">` shown only when `sections.length < MAX_SECTIONS` (10).
- Color: each tab sets `--section-color` from `section.color`.
- New: each base tab MAY set a `--tab-z` (or equivalent) inline custom property for base
  stacking order. This is additive and MUST NOT remove any existing attribute.

## Visual contract (MUST match `specs/designs/tab.png`)

| Aspect | Requirement | Maps to |
|--------|-------------|---------|
| Overlap | Each tab partially sits **behind** the tab to its right | FR-001 |
| Corners | Only the **top-right** corner rounded; others square | FR-002 |
| Shadow | Soft shadow cast toward the **right** edge of each tab | FR-003 |
| Selected | Active tab layered **in front** of neighbors, fully legible | FR-004 |
| Color | Tab background derives from stored `section.color` | FR-005 |
| Responsive | Strip stays horizontally scrollable; labels truncate w/ ellipsis on narrow screens; overlap intact | FR-007 |
| A11y | tablist/tab roles, keyboard select, `title` tooltip for full name, legible contrast | FR-008 |

## Behavioral contract (MUST be unchanged)

- Click or Enter/Space on a tab selects that section.
- Double-click a tab opens its edit dialog.
- Dragging one tab onto another reorders sections (full ordered id list sent as today).
- The "+" tab opens the create-section dialog and hides at `MAX_SECTIONS`.
- No change to network requests, payloads, or persistence.

## Verification

Manual, side-by-side with `specs/designs/tab.png`, at ~320px (mobile), tablet, and desktop
widths. See `quickstart.md`.
