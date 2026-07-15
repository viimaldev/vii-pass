# Data Model: Button Style Unification & Section-Color Primary Actions

**Feature**: 017-button-style-unification | **Date**: 2026-07-15

## Entities

**None.** This feature is purely presentational — no new or modified data entities,
collections, fields, API payloads, or shared types. `backend/` and `shared/` are
untouched.

## Derived/Transient Values (frontend only, not persisted)

| Value | Source | Consumer | Notes |
|---|---|---|---|
| `sectionColor` (hex string) | Existing `Section.color` — add mode: the selected section; edit mode: the section owning `chord.sectionId` | New optional prop on `AddChordDialog`, set inline as `--section-color` on the primary button | Already-persisted data; no schema change |
| `--section-color-fg` (`#ffffff` \| `#1b1f24`) | Computed at render by `readableTextColor(sectionColor)` (WCAG relative luminance) | `.btn-section` label color | Pure function of the hex; never stored |

## State Transitions

None. No behavioral state changes (FR-011); dialog open/close, busy, and read-only
flows are unchanged.
