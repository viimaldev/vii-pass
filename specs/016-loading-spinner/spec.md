# Feature Specification: Loading Spinner Indicator

**Feature Branch**: `016-loading-spinner`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "I want to implement the loading progress bar. I have added loading.svg. In that I want to use only this spinner progress bar. You can create the same or use the svg to show this spinner wherever we show the loading text. In pages, I want to show this on center of the window. For buttons, show that next to text."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See a spinner while a page is loading (Priority: P1)

As a signed-in (or signing-in) user, whenever a whole page or the vault content is
still being fetched, I see the circular dotted spinner centered in the visible
window instead of a plain "Loading…" text line, so the wait feels polished and
clearly communicates that the app is working.

**Why this priority**: Page-level waits are the most visible loading moments in the
app (session bootstrap, first vault load). Replacing bare text with the branded
spinner delivers the core visual value of this feature on its own.

**Independent Test**: Sign in (or refresh while signed in) on a throttled network
and observe that every page-level wait shows the circular dotted spinner centered
horizontally and vertically in the viewport, with no leftover "Loading…" body text.

**Acceptance Scenarios**:

1. **Given** a signed-in user refreshes the app, **When** the session is still being
   restored, **Then** the protected-route wait shows the spinner centered in the
   window (not top-left text).
2. **Given** a user lands on the home page, **When** the vault (sections/entries) is
   still loading, **Then** the spinner is shown centered in the visible window and
   disappears as soon as content renders.
3. **Given** any page-level spinner is visible, **When** loading completes, **Then**
   the spinner is removed and no layout jump pushes content around.

---

### User Story 2 - See a spinner inside busy buttons (Priority: P2)

As a user submitting any action (sign in, create account, unlock, save, delete,
reset password, sign out), while the action is in flight the button shows a small
version of the same spinner immediately next to its progress text (e.g., spinner +
"Signing in…"), so I get consistent in-place feedback.

**Why this priority**: Button busy states already exist app-wide with text-only
feedback; adding the spinner is a consistency upgrade that builds on the P1
spinner asset but is not required for it.

**Independent Test**: Trigger each busy-capable button on a throttled network and
verify a small spinner appears beside the busy text, the button stays disabled,
and the spinner vanishes when the action finishes or fails.

**Acceptance Scenarios**:

1. **Given** the login form, **When** the user submits and the request is in
   flight, **Then** the button shows the small spinner next to "Signing in…" and is
   disabled.
2. **Given** any dialog Save/Delete button (entry or section), **When** the action
   is pending, **Then** the spinner appears beside the busy label and disappears on
   completion or error (button returns to its idle label).
3. **Given** the user menu Log out action, **When** sign-out is pending, **Then**
   the spinner shows beside "Signing out…".

---

### User Story 3 - Loading feedback stays accessible and comfortable (Priority: P3)

As a user relying on assistive technology or with reduced-motion preferences, I
still receive clear loading feedback: screen readers announce the wait as before,
and the spinner respects my motion preferences.

**Why this priority**: The app already provides accessible loading announcements;
this story guarantees the visual upgrade never regresses them. It refines P1/P2
rather than standing alone in user value.

**Independent Test**: With a screen reader, confirm each loading state is still
announced; with reduced motion enabled at the OS level, confirm the indicator does
not spin aggressively (static or gently pulsing alternative).

**Acceptance Scenarios**:

1. **Given** a screen reader user hits a page-level wait, **When** the spinner is
   shown, **Then** a textual loading status is still announced (the spinner itself
   is decorative and not read out).
2. **Given** a user with reduced-motion preference enabled, **When** any spinner is
   shown, **Then** continuous rotation animation is suppressed or replaced with a
   subtle non-motion alternative while feedback remains visible.
3. **Given** either theme (light or dark), **When** a spinner is shown, **Then** it
   remains clearly visible against the background.

---

### Edge Cases

- Very fast operations: the spinner may appear and disappear within a fraction of a
  second — this brief flash is acceptable; no artificial minimum display time is
  required.
- Failed operations: when a pending action errors, the spinner disappears and the
  existing error message behavior is unchanged.
- Small screens (~320px): the centered page spinner must remain fully visible with
  no horizontal scrolling; in-button spinners must not wrap the label to an
  unreadable layout.
- High-contrast / forced-colors environments: the spinner must not become invisible;
  falling back to the existing textual status alone is acceptable.
- The supplied artwork file contains a larger scene; only the circular
  dotted-spinner motif is used — the rest of the artwork must never appear in
  loading states.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The product MUST provide a single, reusable circular dotted spinner
  visually matching the spinner motif in the supplied `loading.svg` artwork (a ring
  of round dots with graduated opacity suggesting rotation). Only that motif is
  used — never the surrounding artwork.
- **FR-002**: Every page-level loading state that today renders loading text
  (session restore wait, vault/sections loading, entries loading) MUST instead show
  the spinner centered both horizontally and vertically within the visible window.
- **FR-003**: Every button busy state that today swaps its label to progress text
  (sign in, create account, unlock, save entry/section, delete entry/section, reset
  password steps, sign out) MUST additionally show a small spinner immediately next
  to that progress text, sized to fit the button without changing its height.
- **FR-004**: The spinner MUST animate to convey ongoing activity (rotation and/or
  sequential dot fading), and MUST honor the user's reduced-motion preference by
  suppressing or substantially toning down continuous animation.
- **FR-005**: Existing accessible loading semantics MUST be preserved: waits remain
  announced to assistive technology as they are today, buttons keep their
  busy/disabled behavior, and the spinner graphic itself is decorative (hidden from
  the accessibility tree).
- **FR-006**: The spinner MUST be clearly visible in both light and dark themes and
  MUST degrade safely (no invisible or garbled indicator) under forced-colors and
  print conditions.
- **FR-007**: Introducing the spinner MUST NOT cause layout shift, horizontal
  scrolling, or content jumps at mobile (~320px), tablet, and desktop widths.
- **FR-008**: The spinner MUST appear in every location that currently shows
  loading/progress text — no surface keeps a text-only wait, and no new loading
  states are invented.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the app's existing loading/busy states (page-level and
  button-level) display the circular dotted spinner; zero text-only waits remain.
- **SC-002**: On every page-level wait, the spinner is visually centered in the
  viewport at mobile (~320px), tablet, and desktop widths with no horizontal
  scrolling introduced.
- **SC-003**: All spinners across the app are visually identical in design (one
  motif, scaled) — a reviewer comparing any two loading states sees the same
  indicator.
- **SC-004**: Screen-reader users receive a loading announcement on 100% of the
  surfaces that announced loading before this change (no accessibility
  regressions).
- **SC-005**: With reduced motion enabled, no loading state shows continuous
  spinning animation.

## Assumptions

- On pages, the spinner **replaces** the visible loading text (the textual status
  remains available to assistive technology); on buttons, the spinner is shown
  **beside** the existing progress text, per the user's instruction.
- "Center of the window" means centered in the visible viewport (both axes), not
  merely centered within a content card.
- The spinner motif is recreated to match the artwork (or extracted from it);
  either approach is acceptable as long as the rendered result matches the supplied
  design and excludes the rest of the artwork.
- The indicator is an indeterminate activity spinner, not a determinate progress
  bar — no percentage or progress measurement is required (operations are short
  network calls with no progress signal).
- This is a purely visual/front-of-house change: no data, permissions, or service
  behavior changes; loading states themselves (when they start/stop) are unchanged.
- Both admin and normal roles see identical loading indicators.
