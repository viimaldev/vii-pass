# Feature Specification: Chord Credential Fields

**Feature Branch**: `topic/vii-1010-chord-credential-fields`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "Let's design chord functionality. As this is the credentials manager, I need the following options. 1. Title (Mandatory), duplicates not allowed 2. URL (Optional) - This URL won't be shown in UI. It is mapped with title in hidden. On hovering title, link cursor will show. On clicking title, the URL will open in new window. In the end, before edit button, we have copy button as well to copy the link alone 3. Option type drop down (username, email, password, other, other sensitive) - Value text box 4. Option type drop down (username, email, password, other, other sensitive) - Value text box 5. Option type drop down (username, email, password, other, other sensitive) - Value text box. After that save and cancel as usual. In 3,4,5 we will have defined icons for each options. We will show the icon in the Chord UI. After that the value. If it is password or other sensitive, we will not show that in UI and will have eye and copy icon in the end. For username and email and other, we will have only copy."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a chord with real credential fields (Priority: P1)

A signed-in user opens a section in their vault and adds a new chord. The add form asks for a mandatory Title, an optional URL, and three option rows — each row pairing a type selector (username, email, password, other, other sensitive) with a free-text value. The user saves and the new chord appears in the section showing its title and, for each filled row, the type's icon followed by the value (masked when the type is sensitive).

**Why this priority**: This replaces the placeholder fields with the product's core purpose — actually storing credentials. Nothing else in this feature matters until a chord can hold a title and typed values.

**Independent Test**: Can be fully tested by adding a chord with a title, a URL, and a mix of sensitive and non-sensitive rows, then confirming the saved chord renders the title, per-type icons, visible values for non-sensitive types, and masked values for sensitive types.

**Acceptance Scenarios**:

1. **Given** an open section, **When** the user adds a chord with Title "GitHub", a URL, row 1 = username "octocat", row 2 = password "s3cret", row 3 left empty, and saves, **Then** the chord appears in the section showing "GitHub", the username icon with "octocat" visible, and the password icon with the value masked.
2. **Given** the add form, **When** the user attempts to save without a Title, **Then** the save is rejected with a clear message and nothing is created.
3. **Given** a section already containing a chord titled "GitHub", **When** the user tries to save another chord titled "github" (any letter casing) in that same section, **Then** the save is rejected with a clear duplicate-title message and nothing is created. The same title in a different section is allowed.
4. **Given** the add form with values entered, **When** the user cancels, **Then** no chord is created and no entered data is retained.

---

### User Story 2 - Use a chord card: copy, reveal, and open the link (Priority: P2)

Looking at a saved chord, the user interacts with it: each non-sensitive row (username, email, other) offers a copy control; each sensitive row (password, other sensitive) is masked and offers an eye control to reveal/hide plus a copy control. When the chord has a URL, hovering the title shows a link cursor, clicking the title opens the URL in a new window, and a copy-link control (placed at the end of the card's controls, before the edit control) copies the URL alone.

**Why this priority**: Storing credentials is only useful if they can be retrieved quickly and safely. Copy/reveal/open-link are the retrieval half of the feature but depend on User Story 1 existing.

**Independent Test**: Can be fully tested on a chord saved with a URL and mixed row types — verify copy places the exact value on the clipboard, the eye toggles masking, the title opens the URL in a new window, and the copy-link control copies just the URL.

**Acceptance Scenarios**:

1. **Given** a chord with a username row, **When** the user activates that row's copy control, **Then** the exact stored value is placed on the clipboard and brief confirmation feedback is shown.
2. **Given** a chord with a masked password row, **When** the user activates the eye control, **Then** the value becomes visible; activating it again re-masks it.
3. **Given** a chord with a masked sensitive row, **When** the user activates its copy control without revealing it, **Then** the real value (not the mask) is copied.
4. **Given** a chord saved with a URL, **When** the user hovers the title, **Then** a link cursor is shown; **When** the user clicks the title, **Then** the URL opens in a new window; the URL text itself is never displayed on the card.
5. **Given** a chord saved with a URL, **When** the user activates the copy-link control (positioned before the edit control), **Then** only the URL is copied.
6. **Given** a chord saved without a URL, **When** the user views the card, **Then** the title is plain (no link cursor, no navigation) and no copy-link control is shown.

---

### User Story 3 - Edit an existing chord (Priority: P3)

The user opens an existing chord for editing. The form is pre-filled with the current title, URL, and the three option rows (types and values, with sensitive values handled safely). The user changes any of them and saves; the same validation rules apply as for creation. Cancel discards the changes.

**Why this priority**: Keeps stored credentials current (password rotations, renamed accounts). Valuable but builds directly on the create/display behavior of the first two stories.

**Independent Test**: Can be fully tested by editing a saved chord — changing its title, URL, and a row's type/value — and confirming the card reflects the changes, and that a duplicate title or empty title is rejected.

**Acceptance Scenarios**:

1. **Given** a saved chord, **When** the user opens edit, **Then** the form shows the current title, URL, and all three rows' types and values.
2. **Given** the edit form, **When** the user changes the password row's value and saves, **Then** the card shows the row still masked and copying yields the new value.
3. **Given** two chords "GitHub" and "GitLab" in the same section, **When** the user edits "GitLab" and renames it "GitHub", **Then** the save is rejected with a duplicate-title message and the original chord is unchanged.
4. **Given** the edit form with modifications, **When** the user cancels, **Then** the chord keeps all its previous values.

---

### Edge Cases

- Duplicate title check must ignore letter casing and surrounding whitespace ("GitHub" = " github ").
- Renaming a chord to its own current title (e.g., only changing casing) is allowed — a chord never conflicts with itself.
- A chord with all three rows empty is still valid (title-only chord); the card shows just the title and any URL controls.
- A URL that lacks a scheme (e.g., "example.com") is accepted and opened as a secure web address; a value that cannot be interpreted as a web address is rejected at save time with a clear message.
- Very long titles and values must not break the card layout (truncate/wrap gracefully); copy always copies the full stored value.
- If the clipboard is unavailable (browser denies access), the copy control shows a failure message rather than silently doing nothing.
- Revealed sensitive values return to masked when the user hides them, and are never revealed by default when the card first renders or re-renders (e.g., after switching sections or reloading).
- Two rows on the same chord may use the same type (e.g., two "other sensitive" rows).
- Existing chords created during the placeholder era have no title; they are not preserved (see Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A chord MUST have a Title. Saving (create or edit) with an empty or whitespace-only Title MUST be rejected with an actionable message.
- **FR-002**: Chord Titles MUST be unique **within their section** — saving a chord whose title duplicates another chord's title in the same section (compared case-insensitively, ignoring leading/trailing whitespace) MUST be rejected with an actionable message. The same title MAY exist in different sections.
- **FR-003**: A chord MAY have a URL. The URL MUST never be displayed as text on the chord card; it is associated with the title invisibly.
- **FR-004**: When a chord has a URL, hovering its title MUST show a link cursor and activating (clicking) the title MUST open the URL in a new window/tab, without navigating the vault away.
- **FR-005**: When a chord has a URL, the card MUST offer a copy-link control, positioned at the end of the card's controls immediately before the edit control, that copies only the URL to the clipboard.
- **FR-006**: When a chord has no URL, the title MUST behave as plain text (no link cursor, no navigation) and the copy-link control MUST be absent.
- **FR-007**: The chord form (create and edit) MUST present exactly three option rows. Each row MUST pair a type selector offering exactly: username, email, password, other, other sensitive — with a free-text value input. Rows are optional: a row with an empty value is simply unused.
- **FR-008**: Each option type MUST have a defined, distinct icon. On the chord card, each filled row MUST display its type's icon followed by the value.
- **FR-009**: Values of type password and other sensitive MUST be masked on the chord card (never rendered as plain text by default) and MUST provide an eye control that toggles reveal/hide, plus a copy control.
- **FR-010**: Values of type username, email, and other MUST be shown in plain text on the chord card with a copy control only (no eye control).
- **FR-011**: Copy controls MUST place the exact stored value (or URL) on the clipboard and give brief visible confirmation of success or failure.
- **FR-012**: Revealed sensitive values MUST re-mask when toggled and MUST always start masked whenever the card is (re)rendered.
- **FR-013**: The form MUST provide Save and Cancel actions consistent with the vault's existing add/edit dialogs; Cancel MUST discard all input without persisting anything.
- **FR-014**: The edit form MUST be pre-filled with the chord's current title, URL, and all three rows' types and values; the same validation rules as creation apply, except a chord's title never conflicts with itself.
- **FR-015**: All chord data MUST remain private to its owner: every read and write is scoped to the signed-in user, and no user can see or modify another user's chords.
- **FR-016**: The chord card and form MUST remain fully usable on mobile, tablet, and desktop widths, with touch-friendly copy/eye/link controls.

### Key Entities

- **Chord**: A credential entry owned by one user, living in one section, holding: Title (required, unique within its section), URL (optional, hidden), and exactly three option rows. Retains its existing ordering position within its section.
- **Option Row**: One of the three slots on a chord: a type — one of username, email, password, other, other sensitive — plus a text value (may be empty/unused). Types password and other sensitive are treated as secrets for display purposes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a fully populated chord (title, URL, three rows) in under 60 seconds from opening the add form.
- **SC-002**: A user can copy any stored value or the link from a chord card in at most 2 interactions (e.g., locate row → activate copy), with visible confirmation in under 1 second.
- **SC-003**: Sensitive values (password, other sensitive) are never visible on screen without an explicit reveal action by the user — 100% of renders start masked.
- **SC-004**: 100% of duplicate-title and missing-title save attempts are rejected with a message that tells the user exactly what to fix.
- **SC-005**: All chord interactions (create, edit, copy, reveal, open link) work at mobile (~320px), tablet, and desktop widths without loss of function or overlapping controls.
- **SC-006**: Clicking a chord title with a URL opens the correct destination in a new window 100% of the time, and never navigates the vault itself away.

## Assumptions

- Existing chords carry only placeholder fields (explicitly temporary) and no titles; they are **not migrated** — placeholder data may be discarded, and the vault starts clean with the new chord shape. If any real data was entered into placeholders, users re-enter it.
- The three option rows are fixed at exactly three (no adding/removing rows in this feature); a row left empty is valid and is simply not displayed on the card.
- Two or more rows on the same chord may share the same type; no per-type limit.
- A URL entered without a scheme is treated as a secure web address; obviously non-web values are rejected at save time.
- Copying a masked sensitive value does not require revealing it first.
- Opening the URL happens in a new window/tab that has no control over the vault window (standard safe new-window behavior).
- Reordering of chords within a section (existing behavior) is unchanged by this feature.
- Value and title lengths follow sensible limits consistent with existing field limits in the vault; exact limits are a planning detail.
- Protection of stored values at rest follows the vault's existing storage approach; strengthening at-rest encryption is a separate feature, not part of this scope.
