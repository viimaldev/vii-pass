# Feature Specification: UI Fixes & Polish

**Feature Branch**: `topic/vii-1008-ui-fixes-polish`

**Created**: 2026-07-10

**Status**: Draft

**Input**: User description: "Let's fix the following issues. Page title should be Vii Pass. No header on the login page and signup page. Both should have Vii Pass logo (For now Vii Pass text) on the dialog, then sign in or sign up. After login header also should have the background, header transparency may be 40%. Similarly add Chord also should have white background with 40% transparency. Let's not fix the chord width to 450, min width should be 350 and based on the available space it calculates its own. No empty space. Let's have delete button in the edit header itself, icon alone is enough. Chord delete also needs to ask the confirmation. Section title should have minimum width of 100px, max of 150. Beyond that ellipsis and tooltip is needed. No duplicate section can be added."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consistent branded page title (Priority: P1)

As a user, every browser tab and window for the application shows the product name "Vii Pass" so I can identify the app at a glance across tabs, bookmarks, and history.

**Why this priority**: Trivial to implement, immediately visible on every surface, and establishes brand consistency that underpins the rest of the polish work.

**Independent Test**: Open the application in a browser and confirm the tab/window title reads "Vii Pass" on the login, signup, and post-login pages.

**Acceptance Scenarios**:

1. **Given** the app is loaded on any route, **When** the user looks at the browser tab, **Then** the title displays "Vii Pass".
2. **Given** the user navigates between login, signup, and home, **When** each route renders, **Then** the tab title remains "Vii Pass".

---

### User Story 2 - Clean, branded authentication screens (Priority: P1)

As a signed-out user, when I visit the login or signup screen I see a focused dialog with the "Vii Pass" brand (shown as text for now) at the top, followed by the sign-in or sign-up form — with no application header/navigation chrome present on these unauthenticated pages.

**Why this priority**: The authentication screens are the first impression and are currently cluttered with a header that does not belong on unauthenticated pages. This directly affects usability and brand perception.

**Independent Test**: Sign out (or open the app while signed out), visit both the login and signup routes, and confirm no top header is shown and each dialog displays the "Vii Pass" brand text above the form.

**Acceptance Scenarios**:

1. **Given** the user is on the login page, **When** the page renders, **Then** no application header/navigation bar is displayed.
2. **Given** the user is on the login page, **When** the dialog renders, **Then** the "Vii Pass" brand text appears at the top of the dialog above the sign-in form.
3. **Given** the user is on the signup page, **When** the page renders, **Then** no application header is displayed and the "Vii Pass" brand text appears at the top of the dialog above the sign-up form.
4. **Given** either authentication page, **When** displayed on a mobile-width viewport (~320px), **Then** the brand text and form remain legible and usable.

---

### User Story 3 - Translucent branded chrome over the background (Priority: P2)

As a signed-in user, I see the decorative page background behind the top header, with the header rendered as a translucent (approximately 40% opacity) surface. The "Add Chord" panel/dialog likewise uses a white surface at approximately 40% opacity so the background remains subtly visible.

**Why this priority**: Ties the post-login experience to the background feature (005) for a cohesive look, but depends on the header and add-chord surfaces already existing.

**Independent Test**: Sign in, confirm the decorative background shows behind a translucent header, then open the Add Chord surface and confirm its white background is translucent so the page background is faintly visible.

**Acceptance Scenarios**:

1. **Given** the user is signed in, **When** the home page renders, **Then** the decorative page background is visible behind the top header.
2. **Given** the top header is shown, **When** it renders, **Then** its background surface is translucent at approximately 40% opacity while its text/controls remain fully legible.
3. **Given** the user opens the Add Chord surface, **When** it renders, **Then** its background is white at approximately 40% opacity while its content remains legible.

---

### User Story 4 - Fluid, space-filling chord layout (Priority: P2)

As a signed-in user, chord cards are no longer locked to a fixed 450px width. Each card has a minimum width of 350px and grows to fill the available horizontal space so the grid leaves no awkward empty gaps.

**Why this priority**: Improves use of screen real estate across viewport sizes and removes visible empty space, a noticeable layout defect.

**Independent Test**: Resize the browser across mobile, tablet, and desktop widths and confirm chord cards never shrink below 350px, expand to consume available width, and leave no large empty area at the end of a row.

**Acceptance Scenarios**:

1. **Given** the chord grid is displayed, **When** rendered at any viewport width, **Then** each chord card is at least 350px wide.
2. **Given** the available row width exceeds the space needed for whole cards at 350px, **When** the grid lays out, **Then** cards grow to fill the available width rather than leaving trailing empty space.
3. **Given** a narrow (mobile) viewport, **When** the grid renders, **Then** cards stack/wrap appropriately and remain usable without horizontal scrolling.

---

### User Story 5 - Inline delete with confirmation (Priority: P2)

As a signed-in user editing a chord, I can delete that chord using an icon-only delete control located in the edit dialog's header. Deleting a chord always prompts me to confirm before the chord is removed.

**Why this priority**: Streamlines the edit workflow and prevents accidental, irreversible data loss.

**Independent Test**: Open a chord's edit dialog, confirm an icon-only delete control is present in the dialog header, trigger it, confirm a confirmation prompt appears, and verify the chord is only deleted after confirming.

**Acceptance Scenarios**:

1. **Given** the chord edit dialog is open, **When** it renders, **Then** an icon-only delete control appears in the dialog header.
2. **Given** the user activates the delete control, **When** it is triggered, **Then** a confirmation prompt is shown before any deletion occurs.
3. **Given** the confirmation prompt is shown, **When** the user confirms, **Then** the chord is deleted.
4. **Given** the confirmation prompt is shown, **When** the user cancels, **Then** the chord is not deleted and the edit dialog state is preserved.

---

### User Story 6 - Bounded section titles with overflow handling (Priority: P3)

As a signed-in user, section titles/tabs have a minimum width of 100px and a maximum width of 150px. Titles longer than the maximum are truncated with an ellipsis and reveal the full title via a tooltip on hover/focus.

**Why this priority**: Keeps the section navigation tidy and predictable, but is a refinement rather than a core flow.

**Independent Test**: Create sections with short and very long names and confirm each tab is between 100px and 150px wide, long names show an ellipsis, and hovering/focusing a truncated tab reveals the full name in a tooltip.

**Acceptance Scenarios**:

1. **Given** a section with a short title, **When** its tab renders, **Then** the tab is at least 100px wide.
2. **Given** a section with a long title, **When** its tab renders, **Then** the tab is at most 150px wide and the title is truncated with an ellipsis.
3. **Given** a truncated section title, **When** the user hovers or focuses the tab, **Then** the full title is shown in a tooltip.

---

### User Story 7 - Prevent duplicate sections (Priority: P3)

As a signed-in user, I cannot create two sections with the same name; if I try, the system rejects the attempt and tells me the name already exists.

**Why this priority**: Prevents confusing, ambiguous organization but is an edge-case guard rather than a primary flow.

**Independent Test**: Create a section, then attempt to create another with the same name and confirm the second attempt is rejected with a clear message and no duplicate section is created.

**Acceptance Scenarios**:

1. **Given** a section named "Work" exists, **When** the user attempts to add another section named "Work", **Then** the attempt is rejected and no duplicate is created.
2. **Given** a duplicate attempt is rejected, **When** the rejection occurs, **Then** the user sees a clear message indicating the section name already exists.

### Edge Cases

- What happens when a section name differs only by letter casing or surrounding whitespace (e.g., "Work" vs "work" vs " Work ")? Assumed treated as a duplicate (case-insensitive, trimmed) consistent with existing username uniqueness conventions.
- How does the header translucency behave where no decorative background art has been supplied yet? The header remains translucent over the CSS fallback color and text stays legible.
- What happens on very wide desktop viewports where a single row could fit many 350px cards? Cards grow to fill width so no large trailing gap remains.
- What happens if the user rapidly triggers delete then cancels? No deletion occurs and the edit dialog remains usable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The browser tab/window title MUST display "Vii Pass" on all routes (login, signup, and post-login surfaces).
- **FR-002**: The login and signup pages MUST NOT display the application header/navigation chrome.
- **FR-003**: The login and signup dialogs MUST display the "Vii Pass" brand (rendered as text for now) at the top of the dialog, above the sign-in / sign-up form.
- **FR-004**: On authenticated surfaces, the decorative page background MUST be visible behind the top header.
- **FR-005**: The top header on authenticated surfaces MUST render as a translucent surface at approximately 40% opacity while keeping its text and controls fully legible.
- **FR-006**: The Add Chord surface MUST use a white background at approximately 40% opacity while keeping its content fully legible.
- **FR-007**: Chord cards MUST NOT use a fixed 450px width; each card MUST have a minimum width of 350px.
- **FR-008**: Chord cards MUST grow to fill the available horizontal space so the grid leaves no awkward trailing empty space, while remaining responsive and usable at mobile, tablet, and desktop widths.
- **FR-009**: The chord edit dialog MUST include an icon-only delete control in its header.
- **FR-010**: Deleting a chord MUST require an explicit user confirmation before the chord is removed; cancelling MUST leave the chord unchanged.
- **FR-011**: Section titles/tabs MUST have a minimum width of 100px and a maximum width of 150px.
- **FR-012**: Section titles exceeding the maximum width MUST be truncated with an ellipsis and expose the full title via a tooltip on hover/focus.
- **FR-013**: The system MUST reject creation of a section whose name duplicates an existing section (compared case-insensitively and with surrounding whitespace trimmed) and MUST inform the user that the name already exists, creating no duplicate.

### Key Entities *(include if feature involves data)*

- **Section**: A user-scoped grouping of chords; relevant attribute for this feature is its display name/title, which must be unique per user.
- **Chord**: A user-scoped credential entry displayed as a card; relevant to this feature via its card layout and its delete action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of application routes display the tab title "Vii Pass".
- **SC-002**: The login and signup pages display zero header/navigation bars and each shows the "Vii Pass" brand text above its form.
- **SC-003**: On authenticated surfaces, the decorative background is visible behind a header measured at approximately 40% opacity, and all header text/controls remain legible.
- **SC-004**: Across viewport widths from ~320px to large desktop, chord cards are never narrower than 350px and no row leaves a visible large empty gap after the last card.
- **SC-005**: 100% of chord delete attempts present a confirmation step, and no chord is deleted without confirmation.
- **SC-006**: Section tabs consistently measure between 100px and 150px wide; every truncated title reveals its full text via tooltip.
- **SC-007**: 100% of attempts to create a section with an existing name (case-insensitive, trimmed) are rejected with a clear message and produce no duplicate.

## Assumptions

- "Logo" for now means the plain text "Vii Pass"; no image asset is required in this feature.
- "Header transparency 40%" and "white background 40%" refer to the surface fill opacity (approximately 0.4 alpha) with content kept fully opaque and legible; exact alpha may be tuned slightly for contrast/accessibility.
- Duplicate section detection is case-insensitive and whitespace-trimmed, consistent with the project's existing username uniqueness convention.
- The decorative backgrounds from feature 005 already exist and are reused; no new background art is introduced here.
- The confirmation prompt for chord deletion can reuse the application's existing confirmation pattern/dialog rather than introducing a new component.
- Existing sections and chords data models are unchanged; this feature is presentation/validation focused.
