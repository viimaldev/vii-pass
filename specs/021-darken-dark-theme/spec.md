# Feature Specification: Darker, Less Colorful Dark Theme

**Feature Branch**: `topic/vii-1025-darken-dark-theme`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "Dark theme shows too much of color than dark theme. I want to reduce the color a bit and darken the UI more. The change needed only in dark theme"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Darker overall surfaces in dark theme (Priority: P1)

A user who has selected the Dark theme (or whose Auto theme resolves to dark) opens the application and sees a noticeably darker interface: page backgrounds, panels, cards, menus, and dialogs all sit on deeper, darker surfaces than today, giving a true "dark mode" feel instead of the current medium-gray appearance.

**Why this priority**: This is the core of the request — the dark theme currently reads as "gray and colorful" rather than dark. Darkening the base surfaces delivers the primary visible value on its own.

**Independent Test**: Switch the theme to Dark and visit the sign-in page and the vault page. Compare surface darkness against the current release: every major surface (page background, auth card, header, section tab bar, user menu panel, dialogs) must be visibly darker, while all text remains clearly readable.

**Acceptance Scenarios**:

1. **Given** the app is in dark theme, **When** the user views any page (sign-in, register, reset, vault), **Then** the page background and primary surfaces appear distinctly darker than the current medium-gray dark palette.
2. **Given** the app is in dark theme, **When** the user opens overlaid surfaces (user menu, entry dialog, section dialog), **Then** those surfaces use the same darker palette and remain visually distinct from the page behind them.
3. **Given** the app is in light theme, **When** the user views any page, **Then** the appearance is byte-for-byte unchanged from today.

---

### User Story 2 - Reduced color intensity in dark theme (Priority: P2)

A user in dark theme sees colored elements (section-colored tabs and accents, primary action colors, decorative background artwork) rendered with less vividness — colors are muted/dimmed so the interface feels calm and dark rather than saturated and bright.

**Why this priority**: The second half of the request. Even with darker surfaces, bright colored accents would still dominate visually; muting them completes the intended look. It builds on P1 but is independently observable.

**Independent Test**: In dark theme, view a vault with several sections using vivid section colors. Colored elements (selected tab fill, colored accents, decorative page artwork) must appear visibly less saturated/bright than in the current release, while the same elements in light theme are unchanged.

**Acceptance Scenarios**:

1. **Given** a section with a vivid color (e.g., bright red or lime) and dark theme active, **When** the user views the section tab bar, **Then** the colored elements appear muted/dimmed compared to today while still clearly indicating which section is selected.
2. **Given** dark theme is active, **When** the user views the decorative page background artwork, **Then** the artwork is dimmed further than today so it recedes behind the content.
3. **Given** light theme is active, **When** the user views the same colored elements, **Then** they render exactly as they do today (full intensity).

---

### User Story 3 - Readability and states preserved in the darker theme (Priority: P3)

A user in the darkened dark theme can still read all text comfortably, distinguish interactive elements and their states (hover, focus, disabled, selected), and perceive status colors (errors, success) — nothing becomes invisible or ambiguous as a result of darkening and desaturation.

**Why this priority**: A guardrail story — darkening must not sacrifice legibility or usability. It is verified across everything the first two stories change.

**Independent Test**: In dark theme, walk through sign-in (including a failed attempt showing an error), the vault (hover/focus buttons, select tabs, open menus/dialogs), and confirm every text/control state is clearly distinguishable.

**Acceptance Scenarios**:

1. **Given** dark theme, **When** the user reads any text (body, muted/secondary, error messages, button labels), **Then** the text meets accessible contrast against its darkened background.
2. **Given** dark theme, **When** the user hovers or keyboard-focuses any interactive element, **Then** the hover/focus indication remains clearly visible against the darker surfaces.
3. **Given** dark theme, **When** an error or destructive action indicator is shown, **Then** it is still immediately recognizable as such despite reduced color intensity.

---

### Edge Cases

- **Extremely vivid or very dark section colors**: muting must not make a selected tab indistinguishable from unselected ones, and an already-dark section color must not disappear into the darkened surfaces.
- **Auto theme transitions**: when Auto resolves from light to dark (time or system change), the new darker palette applies immediately and consistently — no mixed old/new dark values.
- **High-contrast / forced-colors mode**: users relying on the operating system's forced colors are unaffected by this change (existing guards continue to apply).
- **Print**: printed output continues to use light-appropriate styling, unaffected by the darker dark theme.
- **Chord card interiors**: the entry cards are intentionally light and section-colored today; in dark theme their colors are muted and slightly deepened but the cards stay clearly lighter than the page (see FR-009) — worst-case section colors must keep interior text readable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In dark theme, all base UI surfaces (page background, cards/panels, header, tab bar, menus, dialogs, form fields) MUST be rendered noticeably darker than the current dark palette.
- **FR-002**: In dark theme, colored UI accents (section colors on tabs and related accents, primary/action colors) MUST be rendered with reduced intensity (muted/dimmed) compared to today.
- **FR-003**: In dark theme, the decorative page background artwork MUST be dimmed more strongly than today so it visually recedes.
- **FR-004**: The light theme MUST be completely unchanged — every surface, color, and state in light theme renders identically to the current release.
- **FR-005**: Theme selection behavior (Auto/Dark/Light choice, persistence, live Auto switching) MUST be unchanged; only the dark theme's appearance changes.
- **FR-006**: All text in the darkened dark theme MUST retain accessible contrast (WCAG AA) against its background, including muted/secondary text, error text, and text over colored elements.
- **FR-007**: Interactive states (hover, focus, selected, disabled, busy) MUST remain clearly distinguishable in the darkened dark theme.
- **FR-008**: Existing accessibility guards (forced-colors mode, print styling, reduced-motion behavior) MUST continue to work unchanged.
- **FR-009**: Chord entry cards in dark theme MUST render with dark interiors (muted section-color ramps over a dark base) and a light (near-white) foreground, while remaining AA-readable for any section color. (Revised 2026-07-22 during implementation — the initial "muted but still light" treatment was judged too dull; see contracts/dark-theme-ui.md §C4.)

### Key Entities

*(No data entities involved — this is a purely visual/appearance change.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a side-by-side comparison of the vault and sign-in pages in dark theme (before vs. after), reviewers identify the new version as "darker and less colorful" in 100% of comparisons.
- **SC-002**: 100% of text elements sampled across sign-in, vault, menus, and dialogs in dark theme meet WCAG AA contrast ratios.
- **SC-003**: Light theme screenshots taken before and after the change are pixel-identical across all pages and states.
- **SC-004**: Users can complete every existing flow (sign in, view vault, add/edit/delete entries, switch sections, open menus, sign out) in dark theme with no state or control becoming invisible or ambiguous — 100% task completion in a walkthrough at mobile, tablet, and desktop widths.

## Assumptions

- "Darken the UI more" means moving the dark palette from its current medium-gray character toward a deeper dark-gray character — not pure black (pure black backgrounds cause smearing/eye-strain issues and are not implied by the request).
- "Reduce the color a bit" means muting/dimming color intensity in dark theme only, not removing color: section identity, selected states, and status colors must remain recognizable.
- The change is purely visual; no behavior, data, routes, or theme-selection logic changes.
- Both admin and normal roles see the identical darkened dark theme (consistent with all prior theming work).
- Decorative background artwork files themselves are not edited; only how much they are dimmed in dark theme changes.
- Mobile, tablet, and desktop all receive the same darkened palette; responsive layouts are unaffected.
