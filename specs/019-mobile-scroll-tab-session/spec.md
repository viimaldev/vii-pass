# Feature Specification: Mobile Single-Scroll Layout & Tab-Scoped Sessions

**Feature Branch**: `topic/vii-1022-mobile-scroll-tab-session`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "I want to fix the following issues. 1. In mobile screen, there is second scroll bar for the page. If you scroll down, there is white page in the bottom. I don't want that, scroll bar should be available only within the chord container. 2. I want the session alive only for the tab. If the tab is closed without logging out, session should be killed. If there is an active tab, another tab can be open using the same session"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Single scroll region on mobile (Priority: P1)

A signed-in user opens their vault on a mobile phone. The page fits the screen exactly: the header and section tabs stay in place, and only the list of entries (the chord container) scrolls when it has more content than fits. There is no second, page-level scrollbar, and scrolling never reveals an empty white area below the app content.

**Why this priority**: This is a visible defect on every mobile visit today — a double scrollbar and a blank white region below the content make the app feel broken and violate the project's mobile-first mandate. It affects all users on the primary surface (the vault).

**Independent Test**: Can be fully tested by opening the vault on a mobile-sized viewport (~320–575px wide) with more entries than fit on screen, and confirming that (a) only the entries container scrolls, (b) the page/body itself does not scroll, and (c) no white area appears below the content at any scroll position.

**Acceptance Scenarios**:

1. **Given** a signed-in user on a mobile-sized screen with more entries than fit the viewport, **When** they scroll, **Then** only the entries container scrolls while the header and section tabs remain fixed in place, and no page-level scrollbar is shown.
2. **Given** a signed-in user on a mobile-sized screen, **When** they scroll the entries container to its end, **Then** no blank/white region is revealed below the app content — the visible page always ends with app content or background.
3. **Given** a signed-in user on a mobile-sized screen with few entries (content shorter than the viewport), **When** they view the page, **Then** no scrollbar appears anywhere and no white area is visible below the content.
4. **Given** a signed-in user on a tablet or desktop screen, **When** they use the vault, **Then** the existing behavior (entries-container-only scrolling) is preserved with no regression.

---

### User Story 2 - Session ends when the tab is closed (Priority: P2)

A user signs in, uses the vault, and then closes the browser tab without signing out. When they later open the app again (new tab, same browser), they are required to sign in again — the old session is no longer usable.

**Why this priority**: This is a security improvement for a password manager: an abandoned session must not remain usable after the user walks away and closes the tab. It is second only to the visible layout defect because today's behavior (session survives tab close) is by design, not broken.

**Independent Test**: Can be fully tested by signing in, closing the tab (without signing out), opening the app in a new tab, and confirming the sign-in page is shown and vault data is not accessible without re-authenticating.

**Acceptance Scenarios**:

1. **Given** a signed-in user with a single open tab, **When** they close that tab without signing out and later open the app again, **Then** they are presented with the sign-in page and must authenticate before seeing any vault data.
2. **Given** a signed-in user, **When** they refresh the page or navigate within the same tab, **Then** their session remains active and no re-authentication is required.
3. **Given** a signed-in user who closes their entire browser, **When** they reopen the browser and visit the app, **Then** they are required to sign in again.
4. **Given** a session that ended because its last tab was closed, **When** any request is made using that session's credentials, **Then** the system rejects it as unauthenticated.

---

### User Story 3 - Additional tabs share the active session (Priority: P3)

While a user has the app open and signed in, they open the app in a second tab (or duplicate the tab). The second tab is signed in immediately with the same session — no re-authentication. Closing one of the tabs while another remains open does not end the session.

**Why this priority**: Multi-tab convenience completes the tab-scoped session model. It depends on the session model from User Story 2 and refines it, so it comes after.

**Independent Test**: Can be fully tested by signing in, opening the app in a second tab, confirming immediate signed-in access there, closing the first tab, and confirming the second tab keeps working.

**Acceptance Scenarios**:

1. **Given** a signed-in user with one open tab, **When** they open the app in a second tab in the same browser, **Then** the second tab is signed in with the same session without prompting for credentials.
2. **Given** a signed-in user with two open tabs, **When** they close one tab, **Then** the remaining tab continues to work with the session uninterrupted.
3. **Given** a signed-in user with two open tabs, **When** they close both tabs and later reopen the app, **Then** they are required to sign in again.
4. **Given** a signed-in user with two open tabs, **When** they sign out in one tab, **Then** the session is ended everywhere and the other tab no longer has access to vault data.

---

### Edge Cases

- Browser crash or device power loss (no orderly tab close): treated the same as closing the tab — the next visit requires sign-in.
- Browser "reopen closed tab" / session-restore features: a restored tab is not guaranteed to resume the old session; it is acceptable (and expected) that the user must sign in again.
- Mobile OS discards a background tab to save memory and later restores it: the user may be asked to sign in again; vault data must never be exposed without a valid session.
- The on-screen keyboard opens on mobile (viewport height shrinks): the layout must not gain a page-level scrollbar or reveal a white area.
- Small landscape viewports (e.g., 568×320): the single-scroll-region rule still applies.
- A tab left open past the existing session expiry: existing expiry behavior is unchanged — the session ends at expiry even though the tab is open.
- Signing out explicitly in any tab: unchanged — ends the session immediately for all tabs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On mobile-sized screens, vertical scrolling of vault content MUST occur only inside the entries (chord) container; the page/body itself MUST NOT present a scrollbar while using the vault.
- **FR-002**: No blank/white region may be revealed below the app content at any scroll position or viewport size; the app surface MUST always fill the visible viewport.
- **FR-003**: The single-scroll-region behavior MUST hold across mobile, tablet, and desktop widths (including small landscape orientations), with no regression to existing tablet/desktop behavior.
- **FR-004**: A session MUST remain usable only while at least one tab of the app is open in the browser; when the last open tab is closed without signing out, the session MUST end.
- **FR-005**: After a session has ended due to tab closure (or browser close/crash), any attempt to access the app MUST require the user to sign in again before any vault data is shown.
- **FR-006**: A session that ended due to tab closure MUST be rejected by the system if its credentials are subsequently presented (it must not silently grant access).
- **FR-007**: Refreshing the page or navigating within the same tab MUST NOT end the session.
- **FR-008**: While at least one tab holds an active session, opening the app in an additional tab in the same browser MUST reuse that session without re-authentication.
- **FR-009**: Closing one tab while at least one other tab of the app remains open MUST NOT end the session.
- **FR-010**: Explicit sign-out behavior is unchanged: it MUST end the session immediately for all tabs.
- **FR-011**: Existing session expiry/lifetime rules are unchanged; tab scoping only adds an earlier end-of-life trigger (last tab closed), never extends a session.

### Key Entities

- **Session**: The existing signed-in state for a user. Its lifetime is now additionally bounded by tab presence: it ends when the last app tab closes (or the browser closes), while continuing to support sharing across concurrently open tabs, page refreshes, and in-tab navigation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On viewports from 320px to 575px wide (portrait and landscape), the vault shows exactly one scrollable region (the entries container) and zero page-level scrollbars in 100% of tested states (empty vault, few entries, many entries, on-screen keyboard open).
- **SC-002**: No white/blank area below the app content is observable at any scroll position on any tested viewport size.
- **SC-003**: After closing the last app tab without signing out, 100% of subsequent visits require sign-in before any vault data is displayed.
- **SC-004**: With an active session in one tab, opening the app in a second tab shows the signed-in vault without a credential prompt in 100% of attempts.
- **SC-005**: Page refresh and in-app navigation within an open tab never trigger a sign-in prompt while the session is otherwise valid.
- **SC-006**: Tablet and desktop vault layout and scrolling behavior are unchanged (no visual or functional regression).

## Assumptions

- "Session should be killed" is interpreted as: the user must re-authenticate on their next visit, and the old session credentials must no longer be honored. Because a closing tab cannot reliably notify the system, the guarantee is enforced from the user's side of the boundary: a returning visitor after last-tab close is always treated as signed out, and any replayed stale session credentials are rejected.
- The mobile scroll defect concerns the signed-in vault surface (header + section tabs + entries grid); auth pages (sign-in/register/reset) are short forms and may scroll the page normally if they exceed the viewport.
- Desktop already confines scrolling to the entries container (existing behavior); this feature brings mobile to parity and removes the page-level overflow that causes the white area.
- Existing session expiry, sign-out, and multi-device behavior are out of scope and unchanged, except that tab closure now ends a session earlier than expiry would.
- "Tab" sharing applies within the same browser profile on the same device; sessions were never shared across browsers or devices and that does not change.
- Vault-unlock behavior (encryption) follows the session: when a session ends via tab closure, the next visit requires full sign-in, which re-establishes vault access as it does today.
