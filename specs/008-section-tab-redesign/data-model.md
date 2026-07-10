# Phase 1 Data Model: Section Tab Visual Redesign

**Feature**: 008-section-tab-redesign | **Date**: 2026-07-10

## Applicability

This feature is **presentation-only**. It introduces **no new entities, fields, collections,
or state**, and does not change how sections are stored, ordered, created, edited, or
deleted (FR-009).

## Existing entities referenced (unchanged)

- **Section** (existing, collection `sections`): user-scoped document with `id`, `userId`,
  `name`, `color`, integer `position` (ordering), `isDefault`. This feature reads only the
  already-available `name` (label), `color` (tab color), and the selected state derived in
  the frontend `VaultContext`. No schema, validation, or persistence changes.

## Client-side presentational state (unchanged behavior)

- **Selected section id**: existing `selectedId` from `VaultContext`; drives the
  `is-selected` class and the elevated stacking of the active tab. Not persisted by this
  feature.
- **Drag id**: existing local `dragId` state in `SectionTabs` for drag-reorder. Unchanged.

## Derived presentation-only value (new, non-persisted)

- **Base stacking order (`--tab-z`)**: a CSS custom property computed at render time as a
  function of the tab's index in the ordered `sections` array (e.g. `sections.length -
  index`). Purely visual; not stored, not sent to the API.

**Conclusion**: No data-model changes. No migrations. No contract changes to any API.
