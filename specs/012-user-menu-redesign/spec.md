# Feature Specification: User Menu Redesign

**Feature Branch**: `topic/vii-1013-user-menu-redesign`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "I want to update the user menu. It is very congested now. I want to update the design like attached. No profile, only initial. Display name as big and bold, user name smaller. Logout with icon. Change theme option in the user menu. No implementation for onclick change theme for now."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Roomier, clearer account menu (Priority: P1)

A signed-in user opens the account menu from the corner avatar and sees a well-spaced, card-like panel: an identity header showing their initial in a circular badge next to their display name (large, bold) with their username underneath in smaller, muted text — followed by clearly separated menu rows, each with a leading icon. The menu no longer feels cramped.

**Why this priority**: The stated problem is that the current menu is congested. The redesigned identity header and spacing is the core value of this feature; without it, nothing else matters.

**Independent Test**: Sign in, open the user menu, and visually verify the identity header (initial badge, large bold display name, smaller username below) and generous spacing between all rows.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they open the user menu, **Then** the panel shows a header with a circular badge containing the first letter of their display name (no photo/profile image anywhere), their display name rendered noticeably larger and bold, and their username rendered smaller and visually secondary beneath it.
2. **Given** the redesigned menu is open, **When** the user inspects the layout, **Then** the identity header is visually separated from the action rows (e.g., by a divider and padding), and every row has comfortable vertical spacing and a consistent left-aligned icon-plus-label arrangement.
3. **Given** a user whose display name is long, **When** they open the menu, **Then** the name wraps or truncates gracefully without breaking the panel layout.

---

### User Story 2 - Log out with a recognizable icon (Priority: P2)

The user finds the Logout action as a menu row with a leading logout icon and can sign out exactly as before.

**Why this priority**: Logout already exists and must keep working; this story only restyles it. It is essential to the redesign but is a smaller change than the header.

**Independent Test**: Open the menu, verify the Logout row shows an icon and label, click it, and confirm the user is signed out and returned to the login screen.

**Acceptance Scenarios**:

1. **Given** the user menu is open, **When** the user looks at the Logout row, **Then** it displays a logout icon followed by the "Log out" label.
2. **Given** the user clicks Logout, **When** sign-out is in progress, **Then** the row indicates busy state and, on completion, the user is redirected to the login screen (existing behavior preserved).

---

### User Story 3 - Theme option placeholder (Priority: P3)

The user sees a "Change theme" row (with icon) in the menu. Selecting it does nothing yet — it is a visual placeholder for a future feature.

**Why this priority**: Explicitly requested but intentionally non-functional for now; lowest risk and lowest value until theme switching ships.

**Independent Test**: Open the menu and confirm a "Change theme" row with an icon is present; activating it produces no theme change and no error.

**Acceptance Scenarios**:

1. **Given** the user menu is open, **When** the user views the menu items, **Then** a "Change theme" row with a leading icon appears above the Logout row.
2. **Given** the user activates the "Change theme" row, **When** the click/keypress completes, **Then** no theme change occurs, no error is shown, and the application remains fully usable.

---

### Edge Cases

- Display name is empty or whitespace: the initial badge falls back to the first letter of the username (existing fallback behavior preserved).
- Very long display name or username: text wraps or truncates within the panel; the panel never overflows the viewport horizontally.
- Narrow mobile viewport (~320px): the panel stays fully visible and readable, and all rows remain comfortable touch targets.
- Keyboard users: the menu remains fully operable via keyboard (open, navigate items, activate, close with Escape) exactly as today.
- Normal-role (read-only) users: the menu content is identical — none of the menu items are role-dependent.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The user menu panel MUST display an identity header consisting of a circular badge showing the user's initial (first letter of display name, falling back to username), the display name in a larger bold style, and the username in a smaller secondary style below the display name.
- **FR-002**: The system MUST NOT display any profile photo or image in the user menu — the initial badge is the only avatar representation.
- **FR-003**: The identity header MUST be visually separated from the actionable menu rows (divider and padding), and rows MUST have increased spacing compared to the current congested layout.
- **FR-004**: The Logout row MUST display a leading logout icon next to its label and MUST retain existing sign-out behavior, including busy state during sign-out and redirect to the login screen on completion.
- **FR-005**: The menu MUST include a "Change theme" row with a leading icon, positioned above the Logout row.
- **FR-006**: Activating "Change theme" MUST have no functional effect in this release (no theme change, no navigation, no error) — it is a visual placeholder only.
- **FR-007**: All existing menu accessibility behaviors MUST be preserved: keyboard operability, appropriate menu semantics, close on outside click and Escape, and descriptive labels for assistive technology.
- **FR-008**: The redesigned menu MUST render correctly and remain fully usable at mobile (~320px), tablet, and desktop widths, with touch-friendly row heights.
- **FR-009**: Long display names or usernames MUST NOT break the panel layout; text MUST wrap or truncate gracefully.

### Key Entities

- **User identity (existing)**: display name and username already available to the menu; no data model changes required.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the menu open, a user can identify their display name and username within 2 seconds — the display name is visibly the most prominent text in the panel.
- **SC-002**: 100% of menu rows (Change theme, Log out) display a leading icon with a consistent alignment and spacing.
- **SC-003**: Sign-out success rate from the redesigned menu is unchanged from the current menu (no regression in logout flow).
- **SC-004**: The menu renders without layout overflow or clipped content at 320px, 768px, and 1280px viewport widths.
- **SC-005**: All menu interactions are completable using only a keyboard.

## Assumptions

- The attached reference image guides the general style (identity header on top, icon-led rows, divider before logout); only the elements the user listed are in scope — Account Settings, Manage Projects, and Help Center rows from the reference image are NOT added.
- "No profile, only initial" means no photo/avatar image support; the existing initial-letter badge concept is kept and reused inside the panel header.
- The "Change theme" row gets a theme-appropriate icon (e.g., a palette/moon-style glyph consistent with the icon set already used in the app); exact glyph choice is an implementation detail.
- No new data, settings, or persistence are introduced — theme selection state is out of scope until theme switching is implemented.
- Menu contents are identical for admin and normal roles; the redesign does not interact with role-based visibility rules.
- The trigger button in the navbar (corner initial avatar) keeps its current behavior; the redesign concerns the opened panel.
