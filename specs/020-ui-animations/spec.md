# Feature Specification: UI Micro-Animations

**Feature Branch**: `topic/vii-1024-ui-animations`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "I want to include some animations in the application. 1. Hovering the buttons: Background should change linearly from right to left for 500ms, not immediately change the full background. 2. Hovering the chord should glow the card slowly. 3. Rendering chords one by one with some stylish animation. 4. Focusing text box: Outlines should be changing linearly from left to right. 5. Create dialogs should have zoom in transition, i.e. New section, new chord."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Buttons respond with a sweeping hover effect (Priority: P1)

As a signed-in or signed-out user, when I move my pointer over any rectangular action button (sign in, create account, unlock, dialog save/cancel, add-entry tile, sign out, etc.), the button's hover background does not snap on instantly — instead it sweeps in linearly from the right edge toward the left edge over roughly half a second, giving the interface a polished, tactile feel.

**Why this priority**: Buttons are the most frequently touched interactive element across every page; this effect delivers the broadest, most visible improvement for the least behavioral risk.

**Independent Test**: Can be fully tested by hovering any button on the login page and on the vault surface and observing the background fill travel right-to-left over ~500ms; moving the pointer away reverses/removes the effect without leaving artifacts.

**Acceptance Scenarios**:

1. **Given** any rectangular action button in its resting state, **When** the pointer enters the button, **Then** the hover background visibly progresses from the right edge to the left edge over approximately 500ms rather than appearing at once.
2. **Given** a button mid-sweep, **When** the pointer leaves before the sweep completes, **Then** the background returns to the resting state smoothly with no stuck partial fill.
3. **Given** a button, **When** it is activated (clicked/tapped/Enter) at any point during the sweep, **Then** the action fires immediately — the animation never delays or blocks the click.
4. **Given** a disabled or busy (spinner) button, **When** the pointer hovers it, **Then** no hover sweep plays.

---

### User Story 2 - Credential cards glow on hover (Priority: P2)

As a signed-in user browsing my vault, when I hover a credential (chord) card, the card gradually takes on a soft glow that fades in slowly, helping me confirm which card I am about to interact with; the glow fades back out when I move away.

**Why this priority**: The vault grid is the core surface of the product; a gentle glow improves scannability and perceived quality, but it touches only one component so it ranks below the app-wide button effect.

**Independent Test**: Hover a chord card in the vault and observe a gradual glow appearing around/on the card; move away and observe it fading out; card content, layout, and neighboring cards are unaffected.

**Acceptance Scenarios**:

1. **Given** a chord card at rest, **When** the pointer enters the card, **Then** a soft glow fades in gradually (perceptibly slow, not instant).
2. **Given** a glowing card, **When** the pointer leaves, **Then** the glow fades out smoothly back to the resting appearance.
3. **Given** a glowing card, **When** the glow is active, **Then** the card's size, position, and the layout of surrounding cards do not shift.
4. **Given** any theme (light or dark) and any section color, **When** a card glows, **Then** the card content remains fully legible.

---

### User Story 3 - Credential cards appear one by one (Priority: P2)

As a signed-in user, when my vault's credential cards are first displayed (initial load or switching to another section), the cards do not all pop in at once — they appear one after another with a brief, stylish entrance animation, making the vault feel alive and responsive.

**Why this priority**: A staggered entrance is a signature "delight" moment shown on every vault visit, but it is decorative and must never slow access to credentials, so it shares P2 with the card glow.

**Independent Test**: Sign in (or switch sections) with several credentials present and observe cards entering sequentially with a short animated entrance; with many cards, the full sequence still completes quickly and every card is reachable immediately.

**Acceptance Scenarios**:

1. **Given** a section containing multiple credential cards, **When** the grid is first rendered (initial vault load or section switch), **Then** cards animate in one after another in their display order rather than all simultaneously.
2. **Given** a section with many cards, **When** the staggered entrance plays, **Then** the total time before the last card is fully visible remains short (all cards visible within about 1.5 seconds), and cards are interactive as soon as they appear.
3. **Given** the entrance animation is playing, **When** the user interacts with an already-visible card or control, **Then** the interaction works normally — the animation never blocks input.
4. **Given** a single mutation (adding, editing, deleting, or reordering one card), **When** the grid updates, **Then** the full one-by-one sequence does NOT replay for the whole grid.

---

### User Story 4 - Text boxes trace their outline on focus (Priority: P3)

As a user filling in any text input (login, registration, entry dialog fields, unlock prompt, reset flow), when a text box receives focus, its outline/indication draws in linearly from the left edge toward the right, giving a clear, animated cue of where my cursor is.

**Why this priority**: Focus states already exist and are functional; this is a refinement of an existing affordance, so it is lower priority than net-new hover/entrance effects.

**Independent Test**: Click or Tab into any text input across the app and observe the focus outline progressing left-to-right; Tab away and the effect clears; keyboard-only navigation still always shows a clearly visible focus indication.

**Acceptance Scenarios**:

1. **Given** an unfocused text input, **When** it receives focus (pointer or keyboard), **Then** the focus outline animates linearly from the left edge to the right edge.
2. **Given** a focused input, **When** focus leaves, **Then** the focus styling clears without visual artifacts.
3. **Given** a keyboard-only user tabbing through a form, **When** each field receives focus, **Then** a clearly visible focus indication is present at all times — the animation never leaves a moment where focus is invisible or ambiguous.
4. **Given** an input in an error state, **When** it receives focus, **Then** the animated focus cue and the error styling are both distinguishable.

---

### User Story 5 - Dialogs zoom in when opened (Priority: P3)

As a signed-in user, when I open a creation or editing dialog (new section, new credential entry, edit variants, delete confirmations that use the same dialog surface), the dialog appears with a quick zoom-in transition (scaling up from slightly smaller to full size) instead of popping in instantly.

**Why this priority**: Dialogs are opened less frequently than buttons/cards are hovered; the transition is a finishing touch on an already-working flow.

**Independent Test**: Open the "new section" and "new entry" dialogs and observe them scaling up smoothly into place; the dialog is fully usable the moment it settles, and closing/canceling works as before.

**Acceptance Scenarios**:

1. **Given** the vault surface, **When** the user opens a create dialog (new section or new entry), **Then** the dialog animates in with a zoom/scale-up effect settling at full size.
2. **Given** an opening dialog, **When** the zoom transition completes, **Then** focus lands in the dialog exactly as it does today and all controls are immediately usable.
3. **Given** a dialog mid-transition, **When** the user presses Escape or activates Cancel, **Then** the dialog closes correctly with no stuck overlay.

---

### Edge Cases

- **Reduced motion preference**: When the user's system indicates a preference for reduced motion, all five animations are removed or reduced to instant/near-instant state changes — hover, focus, and dialog states still change visibly, just without movement.
- **Touch devices (no hover)**: Hover-driven effects (button sweep, card glow) must not get "stuck on" after a tap on touchscreens, and no functionality may depend on hover.
- **Rapid pointer movement**: Sweeping the pointer quickly across many buttons/cards must not queue up laggy or flickering animations.
- **Very large vaults**: The staggered entrance must cap its total duration so a section with dozens of cards does not make the user wait; late cards may share/compress their delay.
- **Empty section**: A section with zero cards shows its empty state without any orphaned entrance animation.
- **Forced-colors / high-contrast mode**: Decorative glows and sweeps must not break legibility or focus visibility in high-contrast environments; native indication takes precedence.
- **Focus during dialog zoom**: Focus placement must not be lost or misdirected if the user tabs while the dialog is still scaling in.
- **Theme switching mid-animation**: Changing theme while an animation plays must not leave mixed-theme artifacts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All rectangular action buttons across the application MUST animate their hover background as a linear sweep from the right edge to the left edge lasting approximately 500ms, instead of an instant background change.
- **FR-002**: The button hover sweep MUST reverse or clear smoothly when the pointer leaves mid-animation, and MUST never delay, block, or swallow activation (click, tap, Enter/Space).
- **FR-003**: Disabled and busy (in-progress) buttons MUST NOT play the hover sweep.
- **FR-004**: Credential (chord) cards MUST display a soft glow that fades in gradually on pointer hover and fades out on pointer exit, without changing the card's size or shifting surrounding layout.
- **FR-005**: The card glow MUST keep all card content legible in both light and dark themes and for any section color.
- **FR-006**: When a set of credential cards is first rendered (initial vault display or section switch), cards MUST animate in one at a time in display order with a brief entrance animation.
- **FR-007**: The staggered entrance MUST complete quickly regardless of card count (all cards visible within ~1.5 seconds) and cards MUST be interactive as soon as they are visible; single-card mutations MUST NOT replay the whole-grid sequence.
- **FR-008**: Text inputs MUST animate their focus indication linearly from the left edge to the right edge when receiving focus, and clear it cleanly on blur.
- **FR-009**: A clearly visible focus indication MUST be present at all times while an input is focused — the animation may embellish, but never replace or momentarily hide, focus visibility (keyboard accessibility preserved).
- **FR-010**: Create/edit dialogs (new section, new entry, and their edit/delete counterparts sharing the same dialog surface) MUST open with a zoom-in (scale-up) transition and remain fully functional the moment they settle, with focus behavior unchanged from today.
- **FR-011**: All animations introduced by this feature MUST be disabled or reduced to non-moving state changes when the user's system expresses a reduced-motion preference, while all state changes (hover, focus, open) remain visibly communicated.
- **FR-012**: All animations MUST be purely decorative: no functional behavior, data flow, timing of user actions, or existing keyboard/assistive-technology semantics may change.
- **FR-013**: Animations MUST NOT cause layout shifts, scrollbar flicker, or degraded interaction responsiveness on typical mobile devices and desktops.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of rectangular action buttons across all pages exhibit the right-to-left hover sweep at approximately 500ms; no button shows an instant full-background change on hover.
- **SC-002**: Hovering and un-hovering any button or card 10 times in rapid succession produces no stuck, flickering, or misrendered states.
- **SC-003**: In a section with 30+ credentials, every card is visible and interactive within 1.5 seconds of the grid rendering, and a user can activate the first card immediately without waiting for the sequence to finish.
- **SC-004**: Keyboard-only users can traverse every form and always see a visible focus indication on the focused field, with zero moments of invisible focus.
- **SC-005**: With a system-level reduced-motion preference enabled, no sweeping, glowing, staggering, tracing, or zooming motion plays anywhere in the app, while hover/focus/open states remain clearly distinguishable.
- **SC-006**: All existing flows (sign in, register, reset, unlock, create/edit/delete sections and entries, reorder, sign out) complete exactly as before — zero functional regressions attributable to animations.

## Assumptions

- The hover sweep applies to the same set of "rectangular action buttons" defined by the existing button-language contract (feature 017); circular avatar/badge controls and small icon-only controls (eye/copy, move arrows, tab close) are excluded.
- The card glow fade-in is "slow" relative to typical hover feedback — assumed on the order of 400–600ms in, with a comparable or slightly faster fade-out.
- The staggered card entrance plays on initial vault display and on section switches; per-card stagger is short (roughly 40–80ms apart) with the total capped (~1.5s) for large sections; adding/editing/deleting/reordering a single entry does not replay the full sequence (a single new card may animate in individually).
- The focus outline animation is brief (roughly 200–400ms) so fast keyboard tabbing never feels sluggish.
- The dialog zoom-in is quick (roughly 150–250ms) starting from a slightly reduced scale, applying to all dialogs built on the existing dialog surface (create, edit, and delete-confirmation variants for both sections and entries, plus the unlock prompt if it shares that surface).
- This feature is purely presentational: no server, data, session, or permission behavior changes; admin and normal roles see identical animations.
- Existing motion-related behaviors (e.g., the loading spinner's reduced-motion handling) remain unchanged; this feature only adds the five new animation classes of behavior.
