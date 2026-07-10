# Phase 0 Research: Section Tab Visual Redesign

**Feature**: 008-section-tab-redesign | **Date**: 2026-07-10

All items in the spec were unambiguous; the only open questions were CSS technique
choices. Each is resolved below.

## Decision 1 — Overlap technique: negative margin + z-index

- **Decision**: Overlap adjacent tabs using a negative left margin on every tab after the
  first (e.g., `margin-left: calc(-1 * var(--space-4))`), and control layering with
  `z-index`. Base tabs get a descending z-index so each earlier tab sits **behind** its
  right-hand neighbor (matching "sections behind each" — left tucks under the right).
- **Rationale**: Negative margin is the simplest, most robust way to create physical
  overlap in a flex row without absolute positioning, and it keeps the existing horizontal
  scroll (`overflow-x: auto`) working. z-index cleanly expresses stacking order.
- **Alternatives considered**:
  - Absolute positioning each tab — breaks intrinsic width, complicates scroll and
    reorder; rejected.
  - CSS `mask`/clip-path folder shapes — heavier and harder to keep accessible/legible;
    rejected as over-engineering for the requested look.

## Decision 2 — Corner rounding: top-right only

- **Decision**: Set `border-radius: 0 var(--radius) 0 0` (TL, TR, BR, BL → only TR rounded)
  on `.section-tab`. Ensure `.section-tab--add` keeps a sensible shape consistent with the
  strip.
- **Rationale**: Directly satisfies FR-002 ("only its top-right corner rounded"). Using the
  existing `--radius` token keeps design-system consistency.
- **Alternatives considered**: Rounding top-left+top-right (typical browser tab) — rejected;
  the user explicitly asked for top-right only.

## Decision 3 — Right-edge shadow

- **Decision**: Apply a directional `box-shadow` offset to the right, e.g.
  `box-shadow: 4px 0 6px -2px rgba(0,0,0,0.25)`, so the shadow falls toward the right edge
  and reinforces the layered look (FR-003).
- **Rationale**: A single right-offset box-shadow reads as depth without a heavy blur and
  works over any section color. Keeps shadow visible even where tabs overlap.
- **Alternatives considered**: `filter: drop-shadow` — comparable but applies to whole
  element box and can double up across overlaps; box-shadow gives more predictable control.

## Decision 4 — Selected tab "on top"

- **Decision**: The selected tab receives an elevated `z-index` (above all base tabs) plus
  full opacity and its existing inset highlight, so it visually sits in front regardless of
  position (FR-004). Achieved with a `.section-tab.is-selected { z-index: … }` rule; no JS
  needed beyond the already-present `is-selected` class.
- **Rationale**: Meets the "selected reads as on top" requirement using existing state
  class; avoids per-item inline z-index computation in React.
- **Alternatives considered**: Computing per-index inline z-index in the component — more
  code; only needed for base descending order. Decision: set base descending z-index via a
  small inline `--tab-index` style or nth-child; see Decision 5.

## Decision 5 — Base descending stacking without heavy JS

- **Decision**: Provide each tab an incremental CSS custom property for stacking. Since the
  component already maps `sections` with an index available, pass
  `style={{ '--tab-z': sections.length - index }}` (or similar) and use
  `z-index: var(--tab-z)` on base tabs; the selected rule overrides with a high fixed
  z-index. This yields left-behind-right ordering with one tiny inline style.
- **Rationale**: Minimal, declarative, avoids brittle `nth-child` math for a dynamic list,
  and keeps the overlap correct as tabs reorder.
- **Alternatives considered**: `nth-child` z-index ramp — fragile with up to 10 dynamic
  items and reordering; rejected.

## Decision 6 — Responsiveness & accessibility preserved

- **Decision**: Keep `overflow-x: auto` scroll, `min-height: 40px` touch target, label
  truncation (`min/max-width` + ellipsis), `title` tooltip, and tablist/tab roles unchanged.
  Verify overlap does not clip labels by keeping horizontal padding and letting negative
  margin only consume slack.
- **Rationale**: Satisfies FR-007/FR-008 and constitution Principle III without new
  structure.
- **Alternatives considered**: none needed.

## Summary

No NEEDS CLARIFICATION remained. The redesign is achievable purely with CSS (negative
margin overlap, top-right border-radius, right-offset box-shadow, and z-index stacking) plus
a single inline CSS variable per tab for base stacking order in the existing component.
