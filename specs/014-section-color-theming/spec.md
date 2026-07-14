# Feature Specification: Section Color Theming for Chords & Unified Buttons

**Feature Branch**: `topic/vii-1015-section-color-theming`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "I want to use the colors chosen for section in the chords as well. Use cases: Linear color background for header and body. Header linear with black (if dark theme), white if light theme. Chord body background linear with section color irrespective of theme. May be more black for dark theme, more light for light theme. All the buttons should follow the section theme except the color. Unique by design, size. No bold fonts. This applicable for all the buttons for all the pages."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chord cards carry their section's color (Priority: P1)

When a user picks a color for a section, every chord (credential card) inside that
section visually carries that color. The card's header shows a smooth linear gradient
that blends the section color toward black when the app is in dark theme, or toward
white when in light theme. The card's body shows a linear gradient derived from the
same section color in both themes — leaning darker in dark theme and lighter in light
theme — so the whole card reads as "belonging" to its color-coded section at a glance.

**Why this priority**: This is the core request — today the section color only appears
on the section tab, so cards look identical across sections. Carrying the color onto
the cards makes the vault instantly scannable and is the visible value of the feature.

**Independent Test**: Create two sections with clearly different colors, add a chord to
each, and confirm each card's header and body gradients visibly reflect its own
section's color — in both light and dark themes — while all text, icons, and controls
on the card remain fully readable and usable.

**Acceptance Scenarios**:

1. **Given** a section with a chosen color and the app in light theme, **When** the user views a chord in that section, **Then** the card header shows a linear gradient blending the section color with white, and the card body shows a lighter linear gradient derived from the section color.
2. **Given** the same section and the app in dark theme, **When** the user views the same chord, **Then** the card header shows a linear gradient blending the section color with black, and the card body shows a darker linear gradient derived from the section color.
3. **Given** two sections with different colors, **When** the user switches between their tabs, **Then** the chord cards shown always match the active section's color with no stale coloring from the previous section.
4. **Given** any user-chosen section color (including very light or very dark ones), **When** a chord card is displayed, **Then** the title, field icons, masked/revealed values, and buttons on the card remain readable and meet accessibility contrast expectations in both themes.
5. **Given** the default "Mine" section, **When** the user views its chords, **Then** its cards receive the same gradient treatment using that section's color.

---

### User Story 2 - One consistent button style everywhere (Priority: P2)

Every button across every page (sign-in, registration, password reset, vault, dialogs,
menus) follows a single consistent design language: uniform look and sizing rules, no
bold font weight anywhere on buttons. Buttons keep their own functional colors (e.g.,
primary action, destructive action) — they do not take on the section color — and are
distinguished from one another by their design and size rather than by bold text.

**Why this priority**: Visual consistency of interactive controls is the second half of
the request. It affects every page but is independent of the card-gradient work and can
ship separately.

**Independent Test**: Walk through every page and dialog of the app and confirm all
buttons share the same design system (shape, sizing scale, non-bold text) and that no
button uses bold font weight.

**Acceptance Scenarios**:

1. **Given** any page of the app, **When** the user inspects any button, **Then** its label is not rendered in a bold font weight.
2. **Given** buttons of different purposes (primary, secondary, destructive, icon-only), **When** displayed together, **Then** they are visually distinguishable by their design and size — not by bold text.
3. **Given** the vault with a colored section active, **When** the user looks at buttons inside cards, tabs, and dialogs, **Then** the buttons retain their standard colors and do not adopt the section color.
4. **Given** any theme (light or dark), **When** buttons are displayed, **Then** the unified button style holds in both themes with readable labels and visible focus states.

---

### User Story 3 - Colors stay correct through theme and section changes (Priority: P3)

The colored treatment reacts instantly to context changes: switching the theme
(light/dark/auto) immediately re-blends every visible card gradient toward the correct
base (black or white), and creating a new section with a new color immediately shows
correctly tinted cards — all without a page reload.

**Why this priority**: Correct live behavior rounds out the experience but only matters
once Story 1 exists.

**Independent Test**: With chords visible, toggle the theme from the user menu and
confirm every card's gradients re-blend correctly at once; create a new section with a
distinct color, add a chord, and confirm its card is tinted correctly right away.

**Acceptance Scenarios**:

1. **Given** chord cards visible in light theme, **When** the user switches to dark theme, **Then** all visible card headers re-blend toward black and bodies become darker variants of their section color, immediately and without reload.
2. **Given** the theme set to Auto, **When** the resolved theme changes (e.g., system preference flips), **Then** card gradients follow the newly resolved theme automatically.
3. **Given** a newly created section with a chosen color, **When** the user adds the first chord to it, **Then** the new card immediately shows that section's gradient treatment.

---

### Edge Cases

- Extremely light section colors in light theme (or extremely dark colors in dark theme) could make the gradient nearly invisible or wash out text — the blend must guarantee the card remains distinguishable from the page background and its content readable.
- Highly saturated or unusual section colors (neon, pure black, pure white if permitted) must not break text/icon contrast on the card.
- The "add chord" tile and any empty-state areas inside a section should harmonize with the section treatment without becoming confusing or illegible.
- High-contrast / forced-colors accessibility modes: decorative gradients must yield to the user's forced palette and never hide content or focus indicators.
- Printing: cards should remain legible when printed (gradients should not render content unreadable).
- Buttons rendered in a "busy"/disabled state must still follow the unified style (no bold, consistent sizing).
- Read-only (normal-role) users see the same card coloring; the treatment must not depend on which controls are present.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each chord card MUST display a linear-gradient header background that blends its section's chosen color toward black when the active theme is dark, and toward white when the active theme is light.
- **FR-002**: Each chord card MUST display a linear-gradient body background derived from its section's chosen color in both themes — blended darker in dark theme and lighter in light theme.
- **FR-003**: The gradient treatment MUST apply to all chord cards in every section, including the default "Mine" section, using each section's stored color.
- **FR-004**: All text, icons, masked and revealed values, links, and controls on a chord card MUST remain readable over the gradients for any user-choosable section color, in both themes, meeting the project's accessibility contrast expectations.
- **FR-005**: Card gradients MUST update immediately (without page reload) when the active theme changes, including when an Auto theme resolution flips.
- **FR-006**: Card gradients MUST always reflect the currently active section's color when switching between sections, with no stale coloring.
- **FR-007**: All buttons across all pages and dialogs MUST follow a single unified design language: consistent shape and sizing rules, with no bold font weight on any button label.
- **FR-008**: Buttons MUST NOT adopt the section color; they retain their standard functional colors (e.g., primary, destructive) while conforming to the unified design.
- **FR-009**: Button variants (primary, secondary, destructive, icon-only) MUST be distinguishable by design and size rather than font weight.
- **FR-010**: The color treatment MUST be purely visual: it must not alter any card functionality (reveal, copy, links, edit, reorder) or any stored data.
- **FR-011**: In forced-colors/high-contrast modes and when printing, the decorative gradients MUST degrade gracefully so content and focus indicators remain fully visible.
- **FR-012**: Focus indicators on buttons and card controls MUST remain clearly visible over the gradient backgrounds in both themes.

### Key Entities

- **Section**: Already stores a user-chosen color; that color now also drives the visual treatment of every chord card within the section. No new stored attributes.
- **Chord (card)**: Gains no new data; its visual presentation (header and body backgrounds) is derived from its parent section's color and the active theme.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With two or more differently colored sections populated, a user can identify which section a chord card belongs to by color alone, without reading the tab labels.
- **SC-002**: 100% of chord cards render with their section's gradient treatment in both light and dark themes, verified across at least three distinct section colors including one very light and one very dark color.
- **SC-003**: 100% of buttons across all pages and dialogs use non-bold labels and conform to the unified design; a full-app sweep finds zero exceptions.
- **SC-004**: Theme switches re-blend all visible card gradients instantly (perceived as immediate, no reload) in 100% of attempts.
- **SC-005**: All card text and controls meet the project's accessibility contrast expectations over the gradients for every tested section color in both themes.

## Assumptions

- "All the buttons should follow the section theme except the color" is interpreted as: buttons conform to the app-wide unified design language introduced here, but do **not** take on the section's color — they keep their standard functional colors. "Unique by design, size" is interpreted as: button variants are differentiated by design and size, not by bold text.
- The section color is the one already chosen at section creation; this feature adds no new color-picking or section-editing capability.
- The gradient blend amounts (how far toward black/white, how dark/light the body) are a design decision to be tuned during implementation, constrained by the readability requirements (FR-004).
- The existing theme system (Auto/Dark/Light) is the source of truth for which blend direction applies; this feature adds no new theme modes.
- This is a purely visual feature: no API, stored-data, or permission changes; admin and normal (read-only) roles see identical card coloring.
- Section tabs keep their existing color treatment; this feature extends the color onto cards rather than redesigning the tabs.
