# Feature Specification: Dual Usernames with Roles & Security-Question Password Reset

**Feature Branch**: `topic/vii-1012-dual-user-roles`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "I want to change the user registration form. For my application I need 2 usernames with same password. While creating it should ask Admin Username, Username, Display Name, Password, and Security question to choose one from 5 in dropdown. It will be used to reset password incase forgottern. By entering Admin user name and security question, by answering correctlty, it will show the reset password dialog. User can login using either admin user or normal user. Both should work. The difference between Admin and normal user is that the normal user can only view and copy values. No access for edit chord, move chords, add new chord, edit section, move section, add section. Admin user can do all the options available now. For both usernames, password should be same."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register an account with two usernames and a security question (Priority: P1)

A new user creates a single account by providing an Admin Username, a (normal) Username, a Display Name, one Password shared by both usernames, and a security question chosen from a fixed list of 5 questions along with their answer. Both usernames belong to the same account and open the same credential vault.

**Why this priority**: Registration is the entry point for everything else in this feature — the dual identities, the shared password, and the recovery data are all captured here. Nothing else in this feature can exist without it.

**Independent Test**: Complete the registration form with valid values for all five inputs (plus the security answer) and confirm the account is created, then sign in with the Admin Username and the chosen password and see the vault. Delivers a working account even before role restrictions or reset exist.

**Acceptance Scenarios**:

1. **Given** a visitor on the registration form, **When** they fill Admin Username, Username, Display Name, Password, select one of the 5 security questions, provide an answer, and submit, **Then** the account is created and they are signed in (as they are today after registering).
2. **Given** the registration form, **When** the Admin Username and Username are identical (ignoring letter case), **Then** registration is rejected with a clear message that the two usernames must be different.
3. **Given** an existing account that already uses a given username (as either its admin or its normal username), **When** a new registration tries to use that same name for either of its usernames, **Then** registration is rejected with a "username already taken" message.
4. **Given** the registration form, **When** no security question is selected or the answer is left blank, **Then** submission is blocked with an inline message identifying the missing field.
5. **Given** the registration form, **When** either username or the password violates the existing format rules (username: 3–30 alphanumeric characters; password: 3–10 characters), **Then** the same inline validation behavior users see today is applied to each field.

---

### User Story 2 - Sign in with either username; normal username is view/copy-only (Priority: P2)

A user signs in with either their Admin Username or their normal Username, using the one shared password. Signed in via the Admin Username, they can do everything available today (add/edit/move chords, add/edit/move sections). Signed in via the normal Username, they can only look at the vault: open sections, view chord cards, reveal masked values, and copy values — every action that changes anything is unavailable.

**Why this priority**: The role split is the core behavioral value of the feature — a "safe" read-only identity for everyday lookup and a privileged identity for management. It depends on P1 accounts existing.

**Independent Test**: Register one account, sign in with the Admin Username and create a section and a chord; sign out; sign in with the normal Username and confirm the section and chord are visible, values can be revealed and copied, and no add/edit/move controls for chords or sections are offered or accepted.

**Acceptance Scenarios**:

1. **Given** a registered account, **When** the user signs in with the Admin Username and the shared password, **Then** sign-in succeeds and all existing vault capabilities are available.
2. **Given** the same account, **When** the user signs in with the normal Username and the same shared password, **Then** sign-in succeeds and the same vault content is shown.
3. **Given** a session started with the normal Username, **When** the user views the vault, **Then** controls for adding, editing, and reordering chords and for adding, editing, and reordering sections are not offered.
4. **Given** a session started with the normal Username, **When** a change request (add/edit/move chord or section) is submitted by any means (e.g., a crafted request bypassing the interface), **Then** the system refuses it and the vault remains unchanged.
5. **Given** a session started with the normal Username, **When** the user reveals a masked value or copies any value, **Then** these read actions work exactly as they do for the admin identity.
6. **Given** a sign-in attempt with either username and a wrong password, **Then** the same non-leaky "incorrect username or password" behavior seen today applies.

---

### User Story 3 - Reset a forgotten password via the security question (Priority: P3)

A user who forgot the shared password starts a reset by entering their Admin Username. The account's chosen security question is presented; if the user answers correctly, a reset dialog appears where they set a new password. The new password immediately applies to both usernames, and everything previously stored in the vault remains readable after the reset.

**Why this priority**: Recovery is critical for a password manager but only matters once accounts (P1) and daily use (P2) exist. It also removes the current "forgotten password = vault lost" limitation.

**Independent Test**: Register an account, store a chord, sign out, run the reset flow with the Admin Username and the correct security answer, set a new password, then sign in with each username using the new password and confirm the stored chord's values are still readable.

**Acceptance Scenarios**:

1. **Given** a signed-out user on the reset entry point, **When** they enter their Admin Username, **Then** the security question chosen at registration is displayed.
2. **Given** the security question is displayed, **When** the user submits the correct answer (letter case and surrounding spaces ignored), **Then** the reset-password dialog is shown.
3. **Given** the reset-password dialog, **When** the user sets a valid new password, **Then** the new password works for sign-in with both usernames and the old password no longer works for either.
4. **Given** a completed reset, **When** the user signs in with the new password, **Then** all previously stored credentials (chord values, links) are still readable — the reset does not wipe or corrupt the vault.
5. **Given** the security question is displayed, **When** the user submits a wrong answer, **Then** the reset dialog is not shown and the response does not reveal what the correct answer might be.
6. **Given** the reset entry point, **When** a normal Username (not the Admin Username) or an unknown name is entered, **Then** the flow behaves identically from the requester's perspective (a question is still shown or a generic message given) so that it never confirms whether a name exists or which role it has.
7. **Given** repeated wrong answers, **When** the attempt limit is reached, **Then** further attempts are temporarily refused.

---

### Edge Cases

- Admin Username and normal Username identical (ignoring case) → rejected at registration (US1, scenario 2).
- A username requested at registration collides with any existing username of any account, in either role → rejected as taken; the message does not reveal which account or role holds it.
- Security answer entered with different letter case or extra surrounding spaces than at registration → still accepted (comparison is case-insensitive and trimmed).
- Reset attempted with the normal Username or a non-existent name → indistinguishable, non-leaky behavior; never reaches the reset dialog.
- Repeated wrong security answers → attempts are limited/throttled to prevent guessing.
- Password reset completes while a session for either username is still active elsewhere → all previously active sessions for the account are ended; users must sign in again with the new password.
- Normal-role session submits a change request directly (bypassing the interface) → refused; vault unchanged (US2, scenario 4).
- User forgets both the password **and** the security answer → the account and vault remain unrecoverable (accepted limitation, consistent with the product's zero-knowledge stance).
- Existing single-username accounts created before this feature → not carried over; users register anew under the new scheme (see Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The registration form MUST collect exactly: Admin Username, Username (normal), Display Name, Password, a security question selected from a fixed list of 5 predefined questions, and the answer to that question. All are required.
- **FR-002**: One account MUST own both usernames, and both MUST share the single password chosen at registration; the account MUST have exactly one vault visible to both identities.
- **FR-003**: Both usernames MUST follow the existing username rules (3–30 ASCII alphanumeric characters, unique case-insensitively, stored consistently), MUST differ from each other (case-insensitively), and MUST be unique across all usernames of all accounts regardless of role. The existing password policy (3–10 characters) is unchanged.
- **FR-004**: Sign-in MUST succeed with either username plus the shared password, and MUST establish which role (admin or normal) the session carries based on which username was used.
- **FR-005**: A session signed in with the Admin Username MUST retain every capability available today (view, reveal, copy, add/edit/reorder chords, add/edit/reorder sections).
- **FR-006**: A session signed in with the normal Username MUST be able to view sections and chords, reveal masked values, and copy values — and MUST NOT be able to add, edit, or reorder chords, nor add, edit, or reorder sections.
- **FR-007**: Role restrictions MUST be enforced by the system itself, not only by hiding controls: any change request made under a normal-role session MUST be refused even if submitted outside the normal interface, and the interface MUST NOT offer the restricted controls to the normal role.
- **FR-008**: The system MUST offer a password-reset flow reachable from sign-in that: (a) accepts an Admin Username, (b) presents that account's chosen security question, (c) on a correct answer shows a reset-password dialog, and (d) applies the new password to both usernames immediately, invalidating the old password.
- **FR-009**: The security answer comparison MUST ignore letter case and surrounding whitespace. The stored answer MUST NOT be retrievable in readable form by anyone, including operators.
- **FR-010**: The reset flow MUST NOT leak account information: entering a normal username, an unknown name, or a wrong answer MUST produce responses indistinguishable (to the requester) from valid-name flows, and wrong-answer attempts MUST be limited/throttled.
- **FR-011**: Completing a password reset MUST preserve access to everything already stored in the vault — previously saved credential values MUST remain readable after signing in with the new password.
- **FR-012**: Completing a password reset MUST end all previously active sessions for the account.
- **FR-013**: The list of 5 security questions MUST be fixed and identical for all users, presented in a dropdown; free-text custom questions are not supported.

### Key Entities

- **Account**: The single owning unit created at registration. Holds the display name, the shared password (in protected form), the chosen security question, the protected security answer, and the vault. Replaces today's one-username user record.
- **Identity (username + role)**: Each account has exactly two — one with the **admin** role (full capabilities) and one with the **normal** role (view/reveal/copy only). Usernames are globally unique across all identities of all accounts.
- **Security Question & Answer**: One of 5 fixed questions plus the user's answer, captured at registration and used solely to gate the password-reset dialog. Answer is stored protected and compared case-insensitively/trimmed.
- **Session**: Carries the role of the username used at sign-in; the role determines which vault operations are permitted for the session's lifetime.
- **Vault (sections & chords)**: Existing entities; unchanged shape. Access to mutating operations now depends on the session's role.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can complete the expanded registration (all six inputs) in under 3 minutes on the first attempt.
- **SC-002**: 100% of sign-in attempts with a valid username (either role) and the correct shared password succeed; both usernames of an account open the identical vault content.
- **SC-003**: 100% of mutation attempts (add/edit/reorder chord or section) made under a normal-role session are refused — verified by attempting every mutating operation both through the interface and directly.
- **SC-004**: A user who forgot the password can, knowing the Admin Username and security answer, set a new password and regain access to all previously stored credential values in under 2 minutes, with zero stored values lost or unreadable.
- **SC-005**: The reset flow reveals no information usable to confirm whether a given name exists or is an admin name, and unlimited answer guessing is not possible.

## Assumptions

- **Existing accounts are not migrated.** Consistent with prior identity-shape changes in this product, accounts created under the old single-username scheme are dropped per environment and users register anew. No dual-scheme coexistence period.
- **"View and copy" for the normal role includes revealing masked values** (the eye toggle) — the restriction is on *changing* data, not on *seeing* one's own data. Both identities belong to the same person/household who already knows the shared password.
- **The 5 security questions are a product-defined fixed list** (e.g., first pet's name, city of birth, mother's maiden name, first school, favorite teacher — final wording chosen at design time). Only one question is selected per account.
- **Password reset is only reachable via the Admin Username.** The normal username never grants access to the reset dialog, by design of the feature description.
- **Password changes are always account-wide** — there is never a state where the two usernames have different passwords.
- **A user who forgets both the password and the security answer cannot recover the account**; this residual risk is accepted and consistent with the product's protection stance.
- **Display Name remains a single value per account**, shown for whichever identity is signed in.
- **Standard non-leaky error behavior** (generic "incorrect username or password") continues to apply to sign-in for both usernames.
