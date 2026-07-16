# Feature Specification: App Logo Branding

**Feature Branch**: `018-logo-branding`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "I have included logo folder. Full logo in Sign in, create account, reset, home page. Logo to the page title."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Full logo on the authentication pages (Priority: P1)

A visitor arriving at the Sign in, Create account, or Reset password page sees the official full Vii Pass logo (the "V"-with-keyholes mark followed by the "PASS" wordmark) at the top of the form card, in place of today's plain text "Vii Pass" label. The logo instantly communicates which product they are using and gives the entry pages a polished, branded identity.

**Why this priority**: The authentication pages are the first thing every user (including signed-out returning users) sees. They currently carry only a plain-text brand label, so this delivers the most visible branding value and is the core of the request.

**Independent Test**: Open each of the three signed-out pages (Sign in, Create account, Reset password) and confirm the full logo image is displayed where the text brand used to be, at an appropriate size, on both mobile and desktop widths.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor, **When** they open the Sign in page, **Then** the full Vii Pass logo is displayed at the top of the sign-in card instead of the plain text "Vii Pass" brand label.
2. **Given** a signed-out visitor, **When** they open the Create account page, **Then** the same full logo is displayed in the same position and at a consistent size.
3. **Given** a signed-out visitor, **When** they open the Reset password page, **Then** the same full logo is displayed in the same position and at a consistent size.
4. **Given** any of these pages viewed on a narrow mobile screen (~320px), **When** the page renders, **Then** the logo scales down to fit the card without overflowing, distorting, or pushing the form below the fold unreasonably.

---

### User Story 2 - Full logo on the home page (Priority: P2)

A signed-in user on the home (vault) page sees the full Vii Pass logo in the application header, replacing the current plain-text "Vii Pass" brand, so the branded identity carries through into the signed-in experience.

**Why this priority**: The home page is where users spend their time after signing in; consistent branding matters, but it is secondary to the first-impression entry pages.

**Independent Test**: Sign in and confirm the home page header shows the full logo instead of the text brand, correctly sized within the existing header on mobile and desktop.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** the home page renders, **Then** the full Vii Pass logo appears in the header where the text brand "Vii Pass" appeared before.
2. **Given** the home page header, **When** viewed at mobile width, **Then** the logo shrinks to fit the header height without colliding with the account menu control or wrapping the header onto multiple lines.
3. **Given** either light or dark theme is active, **When** the home page renders, **Then** the logo remains clearly visible and undistorted.

---

### User Story 3 - Logo in the browser tab (Priority: P3)

Any visitor sees the Vii Pass logo mark as the browser tab icon next to the page title, so the app is recognizable among open tabs and bookmarks.

**Why this priority**: A tab icon is a small but expected touch of polish; it affects recognition rather than any in-page task.

**Independent Test**: Load any page of the app and confirm the browser tab shows the Vii Pass logo mark beside the "Vii Pass" title; bookmark the page and confirm the icon appears there too.

**Acceptance Scenarios**:

1. **Given** any page of the application, **When** it loads in a browser, **Then** the browser tab displays the Vii Pass logo mark (the standalone "V" symbol) as its icon alongside the existing "Vii Pass" title text.
2. **Given** the app is bookmarked, **When** the bookmark list is viewed, **Then** the logo mark appears as the bookmark icon.

---

### Edge Cases

- What happens if a logo image fails to load (network hiccup, missing file)? The page must still identify the product — meaningful alternative text ("Vii Pass") is announced/shown in place of the image, and layout must not break.
- On very narrow screens (~320px), the wide full logo must scale down proportionally rather than overflow or crop.
- In dark theme, the logo artwork (dark and light blues on a transparent background) must remain legible against the darker page surfaces; the artwork itself is not altered per theme.
- Screen-reader users must still perceive the brand: the logo image carries the accessible name "Vii Pass" wherever it replaces text.
- Users with images disabled or on failed loads still get the textual fallback via alternative text.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Sign in, Create account, and Reset password pages MUST display the full Vii Pass logo (mark + wordmark) at the top of their form card, replacing the current plain-text "Vii Pass" brand label.
- **FR-002**: The home page header MUST display the full Vii Pass logo in place of the current plain-text "Vii Pass" brand.
- **FR-003**: The logo MUST be presented at a consistent visual size and position across the three authentication pages, and MUST preserve its original aspect ratio everywhere it appears (no stretching or squashing).
- **FR-004**: The logo MUST scale responsively: it fits within its container at all supported viewport widths from ~320px mobile up to desktop, without overflow, cropping, or causing horizontal scrolling.
- **FR-005**: Everywhere the logo image replaces brand text, it MUST expose the accessible name "Vii Pass" (alternative text) so screen readers and failed-image states still identify the product.
- **FR-006**: The browser tab (favicon) MUST show the Vii Pass logo mark (the standalone "V" symbol) for all pages of the application, appearing in tabs and bookmarks.
- **FR-007**: The existing browser page title text "Vii Pass" MUST be retained unchanged; the logo is added as the tab icon beside it.
- **FR-008**: The logo images MUST be served from the existing logo assets provided in the project (full logo for in-page use, square mark for the tab icon); no new artwork is created for this feature.
- **FR-009**: The logo MUST remain clearly visible in both light and dark themes without altering the artwork files.
- **FR-010**: Adding the logo MUST NOT change any existing page behavior: form flows, navigation, header controls (account menu), and layout structure remain functionally unchanged.

### Key Entities

- **Full logo**: The horizontal brand image combining the "V"-with-keyholes mark and the "PASS" wordmark; used on Sign in, Create account, Reset password, and the home page header.
- **Logo mark**: The standalone square "V"-with-keyholes symbol; used as the browser tab / bookmark icon.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the four target surfaces (Sign in, Create account, Reset password, Home) display the full logo in place of the text brand.
- **SC-002**: At every viewport width from 320px to desktop, no target page shows logo overflow, distortion, or horizontal scrolling introduced by the logo.
- **SC-003**: The browser tab icon shows the Vii Pass mark on 100% of app pages after a normal page load.
- **SC-004**: With images unavailable, every surface still presents the text "Vii Pass" via the image's alternative text — zero surfaces lose brand identification.
- **SC-005**: All existing user flows (sign in, register, reset, vault use) complete exactly as before — zero functional regressions attributable to this change.

## Assumptions

- The provided assets in the project's logo folder are final: the wide "full logo" image for in-page branding and the square "logo" mark for the tab icon; no resizing/re-cutting of source artwork is in scope beyond normal display scaling.
- "Logo to the page title" means adding the logo as the browser tab icon (favicon) next to the existing title text, not replacing or renaming the title.
- The logo on the home page header is a static brand image (same role the text brand has today); adding new navigation behavior (e.g., click-to-home) is out of scope.
- The signed-out pages' textual link references to "Vii Pass" in body copy (e.g., "New to Vii Pass?") remain as text and are unchanged.
- The artwork works acceptably on both themes as-is; no theme-specific logo variants are required.
- This is a visual/branding change only: no data, permissions, or API behavior is affected.
