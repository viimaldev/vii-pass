# Phase 0 Research: UI Fixes & Polish

All Technical Context items are known (this is a polish pass over existing, well-understood
surfaces). The research below records the design decisions that resolve the few open
choices in the spec's Assumptions.

## Decision 1 — Brand shown as text "Vii Pass"

- **Decision**: Render the brand as the plain text string **"Vii Pass"** everywhere the spec
  mentions a "logo" (browser `<title>`, auth card header). No image asset introduced.
- **Rationale**: Spec explicitly says "For now Vii Pass text"; avoids adding/serving an asset
  and keeps the change dependency-free. A future image swap is a localized edit.
- **Alternatives considered**: Add an SVG/PNG logo now — rejected as premature (YAGNI) and
  out of scope.

## Decision 2 — Auth pages have no header chrome; brand line on the card

- **Decision**: Keep the login/signup pages rendering outside the protected app shell and
  ensure no navbar/header is present; add a "Vii Pass" brand line as the first element inside
  each auth card, above the existing "Sign in" / "Sign up" heading.
- **Rationale**: `LoginPage`/`RegisterPage` already render standalone (`page-bg` + card) — the
  header belongs only to authenticated surfaces. The brand line gives identity without
  reintroducing navigation the signed-out user cannot use.
- **Alternatives considered**: A slim public header — rejected (adds chrome the user asked to
  remove and duplicates the brand).

## Decision 3 — Translucency via CSS `color-mix`/rgba, foreground kept opaque

- **Decision**: Give the authenticated header and the chord dialog surface a **~40% opacity
  surface fill** using an rgba/`color-mix` background on the surface element only, leaving all
  text/controls fully opaque. The header sits over the decorative `page-bg` so the background
  shows through.
- **Rationale**: Applying opacity to a background color (not the element's `opacity`) keeps
  child content at full contrast, preserving WCAG 2.1 AA (Constitution III). Reuses the
  feature-005 background mechanism unchanged.
- **Alternatives considered**: Element-level `opacity: 0.4` — rejected because it fades the
  text too and fails contrast. A backdrop-blur — rejected as unnecessary and less predictable
  across browsers.
- **Note**: "~40%" is a target; the exact alpha may be nudged slightly if a specific
  header/text combination dips below AA contrast.

## Decision 4 — Fluid chord grid: `minmax(350px, 1fr)` space-filling

- **Decision**: Replace the fixed-width branch (`minmax(350px, 450px)`) with a single
  space-filling rule: `grid-template-columns: repeat(auto-fill, minmax(min(350px, 100%), 1fr))`
  so cards are ≥350px and stretch (`1fr`) to consume the row with no trailing gap; on
  sub-350px phones the `min(350px, 100%)` prevents overflow.
- **Rationale**: Directly implements FR-007/FR-008 (min 350px, no empty space) with a single
  responsive CSS rule and no media-query branch that capped width at 450px.
- **Alternatives considered**: `auto-fit` + fixed max — rejected because the 450px cap
  reintroduces the empty-space defect; JS-measured columns — rejected as over-engineering.

## Decision 5 — Icon-only delete in dialog header + confirmation

- **Decision**: Move the edit dialog's delete from a footer text button to an **icon-only
  button in the dialog header** (with an accessible `aria-label`/tooltip), and gate deletion
  behind a confirmation step before `onDelete` runs.
- **Rationale**: Matches the requested layout, reduces footer clutter, and prevents accidental
  irreversible loss (FR-009/FR-010). The `VaultModal` header currently only renders a title,
  so it gains an optional header-action slot.
- **Alternatives considered**: Keep footer delete — rejected (spec asks for header). A second
  full modal for confirmation — acceptable, but a lightweight inline confirm within the same
  dialog is simpler and keeps focus context; either satisfies FR-010 (chosen: reuse the app's
  existing confirmation pattern).

## Decision 6 — Section tab width bounds + ellipsis + native tooltip

- **Decision**: Constrain each section tab label to `min-width: 100px; max-width: 150px` with
  `text-overflow: ellipsis`, and expose the full name via the native `title` attribute
  (tooltip) on hover/focus.
- **Rationale**: Pure CSS + a `title` attribute satisfies FR-011/FR-012 with zero new deps and
  keyboard/hover parity. The tab already uses `white-space: nowrap`.
- **Alternatives considered**: A JS tooltip library / Bootstrap tooltip JS — rejected (adds a
  dependency and JS for a native-attribute-solvable need).

## Decision 7 — Duplicate section names rejected in the service

- **Decision**: In `createSection`, before insert, check for an existing section for the same
  `userId` whose trimmed, lowercased name equals the new one; if found, throw `AppError(409,
  'section_exists', 'A section with that name already exists.')`. Trim the stored name.
- **Rationale**: Enforcing at the service layer (single write path) guarantees the invariant
  regardless of client. Case-insensitive + trimmed matches the project's username uniqueness
  convention. A partial unique index is possible but a scoped `findOne` is simplest and
  sufficient at personal scale.
- **Alternatives considered**: A MongoDB partial/collation unique index — more robust under
  concurrency but heavier; deferred (personal-scale, single-user writes make races
  negligible). Client-only check — rejected (bypassable, violates boundary-validation rule).

**Output**: All decisions resolved; no NEEDS CLARIFICATION remain.
