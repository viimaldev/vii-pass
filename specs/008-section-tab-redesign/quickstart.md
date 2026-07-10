# Quickstart: Section Tab Visual Redesign

**Feature**: 008-section-tab-redesign | **Date**: 2026-07-10

## What changes

The section tab strip in the vault header is restyled to match `specs/designs/tab.png`:
overlapping tabs (each behind the one to its right), **top-right corner rounded only**, and
a **right-edge shadow**. The selected tab is lifted to the front. Behavior is unchanged.

## Files touched

- [frontend/src/styles/tokens.css](../../frontend/src/styles/tokens.css) — `.section-tabs`
  and `.section-tab*` rule block (overlap margins, `border-radius: 0 var(--radius) 0 0`,
  right-offset `box-shadow`, `z-index` stacking).
- [frontend/src/components/SectionTabs.tsx](../../frontend/src/components/SectionTabs.tsx) —
  optionally add a `--tab-z` inline style per tab for base stacking order. No behavior change.

## Run locally

```powershell
cd frontend
npm install   # if not already
npm run dev
```

Open the app, log in, and view the vault. Ensure at least 3 sections exist (add via the "+"
tab) to see the overlap clearly.

## Verify

1. **Overlap** — each tab sits partly behind the tab to its right (FR-001).
2. **Corners** — only the top-right corner of each tab is rounded (FR-002).
3. **Shadow** — a soft shadow falls toward each tab's right edge (FR-003).
4. **Selected on top** — click each tab; the active one clearly layers in front and stays
   legible (FR-004).
5. **Color** — each tab keeps its section's stored color (FR-005).
6. **Behaviors** — click/keyboard select, double-click edit, drag-reorder, and "+" add all
   still work (FR-006).
7. **Responsive** — at ~320px the strip scrolls horizontally, labels truncate with an
   ellipsis, and the overlap layout holds (FR-007). Repeat at tablet and desktop widths.
8. **A11y** — Tab/arrow keyboard operation works; truncated names show full text on hover
   via the `title` tooltip; label text stays legible over every color (FR-008).
9. **Compare** side-by-side with `specs/designs/tab.png` — overlap direction, top-right
   rounding, and right-edge shadow match (SC-001).

## Lint

```powershell
npm run lint
```

Must be clean before considering the change done.
