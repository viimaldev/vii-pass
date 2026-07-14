# Data Model: Section Color Theming for Chords & Unified Buttons

**Feature**: specs/014-section-color-theming | **Date**: 2026-07-14

This feature is **purely presentational**: it introduces **no new stored entities, no
new fields, no schema or index changes, and no API payload changes**. Backend and
shared-types workspaces are untouched.

## Existing entities (referenced, unchanged)

### Section (`sections` collection — feature 006)

| Field | Type | Role in this feature |
|-------|------|----------------------|
| `color` | `string` (`^#[0-9a-fA-F]{6}$`) | **The only input.** Already validated at creation/edit; now also drives every chord card's gradient inside the section. |
| all other fields | — | Unchanged, unused by this feature. |

### Chord (`chords` collection — features 006/009/010)

No fields are read or written by this feature beyond what the card already renders.
A chord's visual color is **derived** from its parent section at render time — it is
never denormalized onto the chord document.

## Derived (runtime-only) visual state

These exist only as CSS custom properties in the browser; nothing is persisted.

| Variable | Set by | Value |
|----------|--------|-------|
| `--section-color` | `ChordGrid` container inline style (from `HomePage` via vault context `sections` + `selectedId`) | The selected section's stored `color`. Same variable the section tabs already set per tab. |
| `--chord-header-top` / `--chord-header-bottom` | `tokens.css` (light default + `[data-bs-theme='dark']` override) | `color-mix()` of `--section-color` toward white (light) / black (dark), inside the audited contrast bands. |
| `--chord-body-top` / `--chord-body-bottom` | `tokens.css` (theme-scoped) | Light tint (light theme) / dark shade (dark theme) of `--section-color`. |
| `--chord-header-fg` | `tokens.css` (theme-scoped) | Header foreground: `var(--color-text)` in light, `#ffffff` in dark. |

## State transitions

| Trigger | Effect | Mechanism |
|---------|--------|-----------|
| Section selected | Grid re-renders with the new section's chords AND the new `--section-color` in the same commit | React render (atomic → FR-006) |
| Theme resolved value changes (manual or Auto flip) | All ramp variables re-resolve | `[data-bs-theme]` attribute change (feature 013); zero JS in this feature (FR-005) |
| Section color edited | Sections state updates → `HomePage` derives the new color → grid restyles | Existing `VaultContext.setSections` flow |
| Vault locked / read-only role | No effect on coloring | Treatment is role- and lock-independent (FR-010) |

## Validation rules

None added. `Section.color` validation (6-digit hex) already exists in
`backend/src/schemas/sections.schema.ts` and is sufficient: every value it admits falls
inside the audited contrast bands by construction (see research Decision 3).
