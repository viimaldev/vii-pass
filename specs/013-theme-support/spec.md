# Feature Specification: Theme Support (Auto / Dark / Light)

**Feature Branch**: `topic/vii-1014-theme-support`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "I want to implement the theming support in this application. Basically I need 3 types of themes. 1. Auto - Based on the system theme set. Or browser theme set. Or light in day time and dark in night. 6AM - 6 PM - light. 2. Dark - Medium gray background. 3. Light - Light background. In the user menu we will have three icons. First auto and dark and light. By default auto will be set, if no user defined theme."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pick a theme from the user menu (Priority: P1)

A signed-in user opens the account menu and sees a theme selector with three icon
choices in this order: Auto, Dark, Light. They tap one and the entire application
immediately switches to that appearance — no page reload, no sign-out. The currently
active choice is clearly indicated so the user always knows which mode is selected.

**Why this priority**: This is the core of the feature — without a working selector
that visibly changes the app's appearance, nothing else (auto resolution, persistence)
has any user-facing value. It also replaces the existing non-functional "Change theme"
placeholder in the user menu, which currently does nothing.

**Independent Test**: Sign in, open the user menu, click each of the three icons in
turn, and confirm the app's background/appearance changes instantly for Dark and Light,
and that the selected icon is visually marked as active.

**Acceptance Scenarios**:

1. **Given** a signed-in user with the user menu open, **When** they view the menu,
   **Then** they see three theme icons in the order Auto, Dark, Light, and exactly one
   is marked as the current selection.
2. **Given** the app is in Light appearance, **When** the user selects the Dark icon,
   **Then** the app immediately shows a medium-gray background across all visible
   surfaces without a reload, and Dark is marked as selected.
3. **Given** the app is in Dark appearance, **When** the user selects the Light icon,
   **Then** the app immediately shows a light background, and Light is marked as
   selected.
4. **Given** any theme is selected, **When** the user navigates between pages (vault,
   login after sign-out), **Then** the chosen appearance is applied consistently on
   every surface.
5. **Given** a user signed in with the normal (view-only) role, **When** they open the
   user menu, **Then** the theme selector is present and fully functional, identical to
   the admin experience.

---

### User Story 2 - Auto mode follows the environment (Priority: P2)

A user who has never chosen a theme (or who explicitly picks Auto) gets an appearance
that matches their environment: if their device or browser declares a light/dark
preference, the app follows it; if no such preference can be detected, the app uses
the local time of day — light from 6:00 AM up to 6:00 PM, dark otherwise.

**Why this priority**: Auto is the default experience for every user, so its behavior
defines the first impression — but it only becomes observable once the theme switching
mechanism from Story 1 exists.

**Independent Test**: With the app in Auto mode, change the operating system's
appearance setting between light and dark and confirm the app follows it. On a device
with no declared preference, verify the app is light during 6 AM–6 PM local time and
dark outside that window.

**Acceptance Scenarios**:

1. **Given** Auto mode is active and the device declares a dark preference, **When**
   the user loads the app, **Then** the app renders with the dark appearance.
2. **Given** Auto mode is active and the device declares a light preference, **When**
   the user loads the app, **Then** the app renders with the light appearance.
3. **Given** Auto mode is active and the app is open, **When** the device's declared
   preference changes (e.g., OS switches from light to dark), **Then** the app updates
   its appearance without requiring a reload.
4. **Given** Auto mode is active and the device declares no preference, **When** the
   local time is between 6:00 AM and 6:00 PM, **Then** the app renders light; outside
   that window it renders dark.
5. **Given** the user has explicitly selected Dark or Light, **When** the device's
   declared preference changes, **Then** the app's appearance does NOT change — the
   explicit choice wins over the environment.

---

### User Story 3 - The choice sticks (Priority: P3)

A user who picks a theme gets the same appearance the next time they open the app on
that device — across page refreshes, sign-outs, and sign-ins. A user who has never
picked anything gets Auto.

**Why this priority**: Persistence turns the selector from a per-visit toggle into a
real preference. It depends on Stories 1–2 existing but is a distinct, independently
verifiable behavior.

**Independent Test**: Select Dark, refresh the page — still dark. Sign out and back in
— still dark. Clear the stored preference (fresh device/browser profile) — the app is
in Auto mode.

**Acceptance Scenarios**:

1. **Given** a user selected Dark, **When** they refresh the page, **Then** the app
   loads directly in the dark appearance and the menu shows Dark as selected.
2. **Given** a user selected Light and signed out, **When** they view the sign-in page
   and later sign back in, **Then** the light appearance is applied throughout.
3. **Given** a first-time visitor with no stored preference, **When** they load the
   app, **Then** Auto mode is active and marked as selected in the menu.
4. **Given** a user selected a theme on device A, **When** they sign in on device B
   where they never chose a theme, **Then** device B uses Auto (the preference is
   per device, not synced to the account).

---

### Edge Cases

- **Time boundary while open**: Auto mode with no system preference, and the clock
  crosses 6:00 PM while the app is open — the appearance updates to dark without the
  user having to reload (at the latest on the next navigation or interaction).
- **System preference change mid-session**: covered by Story 2 scenario 3 — Auto must
  react live; explicit Dark/Light must not.
- **Signed-out surfaces**: the stored preference (or Auto resolution) applies to the
  sign-in, registration, and password-reset pages even though the user menu (the only
  place to change it) is available only when signed in.
- **Storage unavailable**: if the device blocks local persistence (e.g., privacy
  mode), the app still works — it falls back to Auto each visit and selection still
  applies for the current visit.
- **Readability in every theme**: all text, controls, alerts, and the vault cards must
  remain readable (sufficient contrast) in both dark and light appearances, including
  the decorative page backgrounds, which must not make content illegible in dark mode.
- **Multiple tabs**: a theme change in one tab should not corrupt another open tab;
  at minimum, other tabs pick up the new preference on their next load.
- **High-contrast / forced-colors environments**: the theme system must not override
  or break operating-system forced-color accessibility modes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST offer exactly three theme modes: Auto, Dark, and
  Light.
- **FR-002**: The user menu MUST present the theme selector as three icon controls in
  the order Auto, Dark, Light, replacing the existing non-functional "Change theme"
  placeholder row.
- **FR-003**: The selector MUST clearly indicate which mode is currently active, and
  each icon MUST be identifiable (accessible name/label), keyboard-operable, and its
  selected state announced to assistive technology.
- **FR-004**: Selecting a mode MUST apply the corresponding appearance immediately to
  the whole application, without a page reload or sign-out.
- **FR-005**: Auto mode MUST resolve to light or dark using this precedence: (1) the
  device/browser declared appearance preference when available; (2) otherwise local
  time of day — light from 6:00 AM (inclusive) until 6:00 PM (exclusive), dark
  otherwise.
- **FR-006**: While Auto mode is active, the application MUST update its appearance
  when the device's declared preference changes, without requiring a reload; a
  time-of-day boundary crossing MUST be reflected no later than the next page load or
  user interaction.
- **FR-007**: When the user has explicitly chosen Dark or Light, environment changes
  (system preference or time of day) MUST NOT alter the appearance.
- **FR-008**: Auto MUST be the default mode whenever no stored user preference exists.
- **FR-009**: The chosen mode MUST persist on the device across page refreshes,
  sign-outs, and sign-ins; it is a per-device preference and is NOT synced to the
  account.
- **FR-010**: The Dark appearance MUST use a medium-gray background palette; the Light
  appearance MUST use a light background palette. In both, all text and interactive
  elements MUST remain readable with sufficient contrast (WCAG 2.1 AA, 4.5:1 for
  normal text).
- **FR-011**: The resolved appearance MUST apply to every user-facing surface,
  including signed-out pages (sign-in, registration, password reset) and the vault.
- **FR-012**: The theme selector MUST be identical in presence and behavior for both
  admin and normal roles.
- **FR-013**: If device persistence is unavailable, the application MUST still allow
  theme selection for the current visit and MUST default to Auto on subsequent visits
  without error.

### Key Entities

- **Theme Preference**: the user's chosen mode — one of Auto, Dark, or Light. Scoped
  to the device/browser, not the account. Absence of a stored value means Auto.
- **Resolved Appearance**: the effective visual scheme (light or dark) computed from
  the Theme Preference plus, in Auto mode, the device preference and local time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the vault page, a signed-in user can change the theme in at most 3
  interactions (open menu → click icon) and sees the new appearance within 1 second.
- **SC-002**: 100% of application surfaces (vault, sign-in, registration, password
  reset, dialogs, menus) render in the selected appearance with no mixed-theme
  artifacts.
- **SC-003**: A selected theme is restored correctly on 100% of page reloads and
  sign-in/sign-out cycles on the same device.
- **SC-004**: In Auto mode, the appearance matches the device's declared preference on
  100% of app loads where such a preference exists, and matches the 6 AM–6 PM rule
  when it does not.
- **SC-005**: All text meets WCAG 2.1 AA contrast (4.5:1 normal text) in both the dark
  and light appearances, verified on the vault and sign-in pages.
- **SC-006**: First-time visitors (no stored preference) get Auto mode on 100% of
  first loads.

## Assumptions

- The theme preference is stored per device/browser only; account-level sync across
  devices is out of scope for this feature.
- Auto precedence is: device/browser declared preference first; the 6 AM–6 PM local
  time rule is a fallback used only when no preference can be detected.
- "6 AM – 6 PM" uses the device's local clock, boundary semantics: 06:00 inclusive
  (light begins), 18:00 exclusive (dark begins).
- The existing "Change theme" placeholder row in the user menu (feature 012) is
  superseded by this three-icon selector; no other user-menu behavior changes.
- The theme selector lives only in the user menu (signed-in); signed-out pages honor
  the stored preference but offer no control to change it.
- The existing decorative page backgrounds remain; the dark appearance may adjust how
  they are presented (e.g., dimming) so long as content stays readable, but replacing
  the artwork is out of scope.
- Icon-only controls follow the app's existing icon conventions (inline vector icons,
  no new dependencies expected — implementation detail deferred to planning).
