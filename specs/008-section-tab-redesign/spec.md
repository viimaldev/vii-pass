# Feature Specification: Section Tab Visual Redesign

**Feature Branch**: `topic/vii-1009-section-tab-redesign`

**Created**: 2026-07-10

**Status**: Draft

**Input**: User description: "I want to design the section tab UI more impressive way. Find the design from './specs/designs/tab.png'. I want exact same way in the sections UI. Only right upper rounded corners, sections behind each, right shadow"

## Overview

The credential vault currently shows color-coded section tabs as separate, evenly
spaced pill-shaped buttons. This feature restyles that same tab strip to match the
supplied reference design (`specs/designs/tab.png`): a classic overlapping "browser/file
folder" tab bar where each tab is a slanted panel that tucks **behind** the tab to its
right, has a rounded **upper-right corner only**, and casts a soft shadow toward the
right edge. The goal is purely visual polish — the existing tab behaviors (selecting,
adding, editing, reordering, color coding) stay exactly the same.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Overlapping tab visual style (Priority: P1)

As a user viewing my credential vault, I want the section tabs to appear as an
attractive, overlapping stack of angled tabs (like the reference design) so the header
looks more polished and clearly communicates that tabs belong to a single grouped strip.

**Why this priority**: This is the core intent of the request — matching the reference
design. Without it the feature delivers no value.

**Independent Test**: Open the home/vault page with two or more sections. Confirm each
tab overlaps the next, each tab's upper-right corner is rounded while its other corners
are not, and a shadow is visible along each tab's right edge — matching
`specs/designs/tab.png`.

**Acceptance Scenarios**:

1. **Given** a vault with three or more sections, **When** the tab strip renders, **Then**
   each tab visually overlaps (sits partly behind) the tab immediately to its right.
2. **Given** any section tab, **When** it is displayed, **Then** only its top-right corner
   is rounded and its remaining corners are square (matching the reference design).
3. **Given** any section tab, **When** it is displayed, **Then** a soft shadow is cast
   toward its right side, reinforcing the layered/behind-each-other look.
4. **Given** the tab strip, **When** compared side-by-side with `specs/designs/tab.png`,
   **Then** the overlap direction, corner rounding, and right-edge shadow visually match.

---

### User Story 2 - Selected tab reads as "on top" (Priority: P2)

As a user, I want the currently selected section tab to clearly stand out and appear to
sit in front of the other tabs, so I always know which section I'm viewing.

**Why this priority**: Overlapping tabs can obscure which one is active; preserving clear
active-state feedback keeps the redesign usable, not just pretty.

**Independent Test**: Select each tab in turn and confirm the active tab visually rises
above/in front of its neighbors and remains fully legible.

**Acceptance Scenarios**:

1. **Given** several sections, **When** one tab is selected, **Then** it renders in front
   of (above the stacking order of) the adjacent tabs and is fully visible.
2. **Given** a selected tab, **When** viewed, **Then** its label and color remain clearly
   distinguishable from unselected tabs.

---

### User Story 3 - Existing tab behaviors preserved (Priority: P2)

As a user, I want all the existing tab interactions to keep working after the restyle so
nothing I rely on breaks.

**Why this priority**: The request is visual-only; regressions in behavior would be a
net loss.

**Independent Test**: Exercise select, double-click to edit, drag-to-reorder, the add
("+") tab, and keyboard selection, and confirm each still works.

**Acceptance Scenarios**:

1. **Given** the redesigned tabs, **When** a user clicks or keyboard-activates a tab,
   **Then** that section is selected as before.
2. **Given** the redesigned tabs, **When** a user double-clicks a tab, **Then** its edit
   dialog opens as before.
3. **Given** the redesigned tabs, **When** a user drags one tab onto another, **Then** the
   sections reorder as before.
4. **Given** fewer than the maximum number of sections, **When** the strip renders, **Then**
   the trailing add ("+") control is still present and opens the create dialog.

---

### Edge Cases

- **Single section**: With only one tab there is nothing to overlap; the lone tab still
  shows the rounded upper-right corner and right-edge shadow.
- **Many sections / narrow screen**: On small (mobile ~320px) viewports the overlapping
  strip must remain horizontally scrollable and each tab's label must stay readable
  (truncating with an ellipsis as today) without breaking the overlap layout.
- **Reordering while overlapped**: During drag, the dragged tab's stacking must not leave
  a permanent gap or visual artifact once dropped.
- **Selected tab at the far right/left**: The active-on-top effect must work regardless of
  the selected tab's position in the strip.
- **Color contrast**: Tab label text must remain legible against every section color even
  when tabs overlap and cast shadows.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The section tab strip MUST render tabs as an overlapping sequence where each
  tab partially sits behind the tab to its right, matching `specs/designs/tab.png`.
- **FR-002**: Each section tab MUST have only its top-right corner rounded; the top-left,
  bottom-left, and bottom-right corners MUST be square.
- **FR-003**: Each section tab MUST cast a soft shadow toward its right edge to reinforce
  the layered appearance.
- **FR-004**: The currently selected tab MUST appear in front of (above the stacking order
  of) neighboring tabs and remain fully legible.
- **FR-005**: The redesign MUST preserve each tab's existing color coding derived from the
  section's assigned color.
- **FR-006**: All existing tab interactions — select (click and keyboard), double-click to
  edit, drag-to-reorder, and the trailing add ("+") control — MUST continue to function
  unchanged.
- **FR-007**: The tab strip MUST remain responsive and mobile-first: on small viewports it
  MUST stay horizontally scrollable and keep tab labels legible (truncating long names
  with an ellipsis) without breaking the overlap layout.
- **FR-008**: Section labels MUST remain accessible via tooltip/title for full names when
  truncated, and the tab strip MUST retain its existing accessibility roles (tablist/tab
  semantics and keyboard operability).
- **FR-009**: The change MUST be visual/presentation-only; no changes to how sections are
  stored, ordered, created, edited, or deleted.

### Key Entities

- **Section tab**: A visual representation of a user's credential section, carrying the
  section's name (label) and assigned color, and reflecting selected/unselected state.
  This feature changes only its visual presentation, not its data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user comparing the live section tab strip with `specs/designs/tab.png`
  confirms the overlap direction, top-right-only rounded corners, and right-edge shadow
  match the reference.
- **SC-002**: 100% of existing tab interactions (select, edit, reorder, add, keyboard
  selection) continue to work after the redesign with no regressions.
- **SC-003**: The tab strip renders correctly and remains usable across mobile (~320px),
  tablet, and desktop widths, with labels legible at every width.
- **SC-004**: For any selected section, users can identify the active tab at a glance in
  under 1 second because it clearly sits in front of the others.

## Assumptions

- The reference image `specs/designs/tab.png` is the single source of truth for the target
  look; final colors continue to come from each section's stored color rather than the
  fixed colors shown in the sample image.
- "Sections behind each" means tabs overlap left-to-right, each tab tucking behind its
  right-hand neighbor (as depicted in the reference), with the selected tab lifted to the
  front.
- This feature is limited to the section tab strip; the chord tiles/rows shown beneath the
  tabs in the reference image are out of scope.
- No backend, data-model, or API changes are required; the work is confined to the
  frontend presentation of the existing section tabs.
- Existing responsive, accessibility, and design-token conventions in the project continue
  to apply.
