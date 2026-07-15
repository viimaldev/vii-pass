# Feature Specification: Button Style Unification & Section-Color Primary Actions

**Feature Branch**: `017-button-style-unification`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "I want to update the UI much better. Let's use primary button of Chord creation is the section color and secondary is gray as it is. No need of transparency for buttons. Gap between buttons should increase a little. Buttons style should be like section style. Upper right corner alone rounded, copy the same style. All the buttons, including sign in, register should be reflecting this. Hover color of eye and copy chord values should be light edit icons hover color in dark theme. For light theme, let's leave as it is."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unified button shape across the app (Priority: P1)

As a user moving through the application — signing in, registering, resetting a password, managing sections and entries — I see one consistent button shape everywhere: the same distinctive silhouette as the section tabs, where only the upper-right corner is rounded and the other three corners are square. The app feels like one coherent product instead of a mix of styles.

**Why this priority**: This is the core of the request — a single visual language for every button. It touches the most surfaces and delivers the biggest perceived quality lift on its own.

**Independent Test**: Visit each surface (sign in, register, password reset, home vault, entry create/edit dialog, section create/edit dialog, user menu) and confirm every button shows the section-tab corner treatment (upper-right corner rounded only), with no leftover uniformly-rounded buttons.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor on the sign-in page, **When** they view the "Sign in" button, **Then** it has only its upper-right corner rounded, matching the section-tab silhouette.
2. **Given** a visitor on the registration page, **When** they view the "Create account" button, **Then** it shows the same corner treatment.
3. **Given** a signed-in user with a dialog open (create/edit entry, create/edit section), **When** they view the dialog's action buttons, **Then** all of them share the same corner treatment.
4. **Given** any button in the app, **When** its shape is compared to a section tab, **Then** the rounded-corner treatment visibly matches (same corner, comparable curvature).

---

### User Story 2 - Section-colored primary action in the entry dialog (Priority: P2)

As a signed-in user creating or editing an entry inside a section, the dialog's primary action button (save/create) is filled with the color of the section I'm working in, while the secondary action (cancel) stays gray as it is today. Both buttons use solid, fully opaque fills — no see-through backgrounds — and the spacing between the buttons is slightly wider so they read as clearly separate actions.

**Why this priority**: Ties the strongest call-to-action to the section context the user is already in, reinforcing the section-color theming introduced for tabs and cards. Depends visually on Story 1's shape but is independently verifiable.

**Independent Test**: Open the create-entry dialog from two sections with clearly different colors and confirm the primary button matches each section's color, the secondary stays gray, fills are opaque, and the gap between buttons is visibly wider than before.

**Acceptance Scenarios**:

1. **Given** a section colored red, **When** the user opens the create-entry dialog, **Then** the primary (save) button is filled with that red.
2. **Given** a section colored teal, **When** the user opens the create-entry dialog from it, **Then** the primary button is teal — the color follows the active section.
3. **Given** the create/edit entry dialog, **When** the user views the secondary (cancel) button, **Then** it remains gray, unchanged from today.
4. **Given** any dialog action row, **When** the user views the buttons, **Then** no button has a translucent/transparent fill and the space between adjacent buttons is slightly larger than before.
5. **Given** a section with a very light or very dark color, **When** the primary button adopts it, **Then** the button label remains clearly readable (accessible contrast preserved).

---

### User Story 3 - Brighter eye/copy hover feedback in dark theme (Priority: P3)

As a user in dark theme hovering over the eye (reveal) or copy controls on an entry's values, the control brightens to the same hover color the edit icon uses, so all card controls give the same clear hover feedback. In light theme, nothing changes — the current hover behavior stays exactly as it is.

**Why this priority**: A focused polish fix for dark-theme discoverability; smallest scope and no dependency on the other stories.

**Independent Test**: In dark theme, hover the eye and copy controls on an entry card and compare against hovering the edit control — the hover color matches. Switch to light theme and confirm hover behavior is unchanged from today.

**Acceptance Scenarios**:

1. **Given** dark theme is active, **When** the user hovers the eye control on a sensitive value, **Then** it takes on the same hover color as the edit icon.
2. **Given** dark theme is active, **When** the user hovers the copy control on any value, **Then** it takes on the same hover color as the edit icon.
3. **Given** light theme is active, **When** the user hovers the eye or copy controls, **Then** the hover appearance is identical to the current behavior (no change).
4. **Given** dark theme and keyboard navigation, **When** the eye or copy control receives keyboard focus, **Then** it is at least as visible as the hover state (focus feedback not weaker than hover).

---

### Edge Cases

- Section with an extremely light (near-white) or dark (near-black) color: the section-colored primary button must still show readable label text; if a color would break readability, the label/foreground must adapt so contrast is preserved (same guarantee the section tabs already provide).
- Entry dialog opened for editing (not creating): the primary button follows the color of the section the entry belongs to.
- Buttons that span full width (e.g., sign-in/register submit): the corner treatment applies at any width without distorting the silhouette.
- Very narrow screens (~320px): the increased gap between buttons must not cause action rows to overflow or wrap awkwardly.
- Busy buttons with the inline spinner (feature 016): shape, fill, and gap changes must not alter button height or spinner alignment.
- Forced-colors / high-contrast mode: decorative fills may be overridden by the platform; buttons must remain usable and distinguishable.
- Read-only (normal role) users see fewer buttons; every button they do see follows the same unified style.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every button across the application — including sign in, create account, password reset steps, sign out, dialog actions, and vault controls — MUST use the section-tab corner treatment: only the upper-right corner rounded, the other three corners square, visually matching the existing section tabs.
- **FR-002**: The primary action button of the entry create/edit dialog MUST be filled with the color of the section the entry is being created in or belongs to.
- **FR-003**: The secondary action button (cancel) of the entry create/edit dialog MUST remain gray, unchanged from its current appearance.
- **FR-004**: Buttons MUST use solid, fully opaque background fills; translucent or transparent button backgrounds are not permitted for standard action buttons.
- **FR-005**: The spacing between adjacent buttons in action rows MUST be slightly increased from the current spacing, applied consistently wherever two or more buttons sit side by side.
- **FR-006**: When the section-colored primary button adopts any user-chosen section color, its label MUST remain readable at an accessible contrast level, adapting the label color if necessary.
- **FR-007**: In dark theme, the hover state of the eye (reveal) and copy controls on entry card values MUST use the same hover color as the entry card's edit control.
- **FR-008**: In light theme, the hover behavior of the eye and copy controls MUST remain exactly as it is today (no visual change).
- **FR-009**: Keyboard focus feedback on the eye and copy controls MUST be at least as visible as their hover state in both themes.
- **FR-010**: The updated button styling MUST hold across both light and dark themes, at all supported viewport widths (from ~320px up), and MUST NOT change button heights or break the existing busy-state spinner alignment.
- **FR-011**: The changes MUST be purely visual: no behavior, data, permissions, or interaction flows may change.

### Key Entities

*(No data entities involved — this feature is purely presentational.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of buttons across all application surfaces (sign in, register, reset, home vault, dialogs, user menu) display the unified upper-right-rounded corner style; zero buttons retain the old uniformly-rounded shape.
- **SC-002**: For any section color a user picks, the entry dialog's primary button displays that color with label text meeting accessible contrast (≥ 4.5:1).
- **SC-003**: In dark theme, hovering the eye, copy, and edit controls on an entry card produces the identical hover color across all three; in light theme, eye/copy hover appearance is pixel-identical to the pre-change behavior.
- **SC-004**: No action row overflows or misaligns at 320px, 768px, and 1280px viewport widths after the gap increase.
- **SC-005**: A user comparing any two surfaces of the app can identify a single consistent button style (shape, opacity, spacing) with no exceptions found in a full-surface visual sweep.

## Assumptions

- "Section style" refers to the existing section tabs' distinctive shape where only the upper-right corner is rounded; buttons copy that corner treatment (comparable curvature) while keeping their own sizes and paddings.
- "Primary button of Chord creation" means the confirm/save button of the entry create AND edit dialog (same dialog is reused for both); the color follows the currently active section. Other dialogs' primary buttons (e.g., section create/edit) keep their current brand-primary color unless later requested.
- This feature deliberately supersedes feature 014's "buttons never adopt the section color" rule for exactly one button: the entry dialog's primary action. All other buttons continue to not use section colors.
- "No need of transparency" refers to button background fills (e.g., hover washes or translucent fills); it does not prohibit the low-opacity *idle* state of the small icon controls on entry cards (eye/copy/edit), whose opacity treatment is an established affordance — only their dark-theme hover color changes per FR-007.
- "Gap should increase a little" is interpreted as a modest, consistent increase (on the order of one spacing step) applied to side-by-side button groups, not a layout redesign.
- The edit control's existing dark-theme hover color is the reference target for FR-007; it is itself unchanged.
- Scope is frontend presentation only; no server, API, or stored-data changes are expected.
