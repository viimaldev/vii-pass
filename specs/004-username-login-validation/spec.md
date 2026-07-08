# Feature Specification: Username-Based Login Validation

**Feature Branch**: `004-username-login-validation` (git: `topic/vii-1004-username-login-validation`, story `vii:1004`)

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "I want to change the validation for login. I don't want username should be email and password limit should be 12 characters. Please find the requirements below. Username: It can be any alphanumeric value, but it should be unique name in the database. Length should be 3 or more than that. No special characters. Password: Length 3-10. This needs to be adjusted in register page."

## Overview

Today, an account is identified by an **email address**, and passwords must be at least
**12 characters** long. This feature changes the account identity and credential rules so
that:

- The login identifier becomes a **username** — any alphanumeric value, unique across all
  accounts, at least 3 characters long, with **no special characters** — instead of an
  email address.
- The password rule changes from "at least 12 characters" to a **3–10 character** length.

These rules are collected and enforced on the **registration page**, and the sign-in
experience is updated to match (users log in with their username, not an email). The change
is about identity and validation only; it does not alter how sessions, personalization, or
protected access work.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register with a username instead of an email (Priority: P1)

A new visitor opens the registration page and creates an account by choosing a **username**
(an alphanumeric name, at least 3 characters, no special characters) and a **password**
(3–10 characters). There is no email field. On success, the account is created with the
password stored only in hashed form, and the user is signed in and taken to the home page.

**Why this priority**: This is the heart of the change and the minimum viable slice — the
new identity model (username replaces email) and the new password rule both live on the
registration page. Without it, none of the other behavior can exist.

**Independent Test**: On the registration page, submit a valid, previously unused username
and a password of length 3–10 and confirm an account is created (password stored hashed
only), no email was required, and the user reaches the authenticated home page.

**Acceptance Scenarios**:

1. **Given** the registration page, **When** a new user submits a unique alphanumeric
   username of 3 or more characters and a password of 3–10 characters, **Then** an account
   is created with the password stored only in hashed form and the user is signed in and
   taken to the home page.
2. **Given** the registration page, **When** the user views the form, **Then** it presents a
   **Username** field (not an Email field) and a password field whose guidance reflects the
   3–10 character rule.
3. **Given** a newly registered user, **When** they later sign in with that same username and
   password, **Then** authentication succeeds.

---

### User Story 2 - Sign in with a username (Priority: P2)

An existing user opens the sign-in page and authenticates using their **username** and
password rather than an email address. Correct credentials grant access; incorrect
credentials are rejected with a single, generic message that does not reveal which field was
wrong.

**Why this priority**: An account is only useful if it can be signed into. Sign-in must use
the same identifier that registration now issues (a username), so this builds directly on
US1 to make the account usable.

**Independent Test**: With an account already created under the new rules, submit the correct
username and password on the sign-in page and confirm access is granted; submit an unknown
username or a wrong password and confirm access is refused with a single generic error and
no session is created.

**Acceptance Scenarios**:

1. **Given** a registered, active user and the sign-in page, **When** the user submits their
   correct username and password, **Then** a valid session is established and the user is
   taken to the home page.
2. **Given** the sign-in page, **When** the user submits an unknown username or an incorrect
   password, **Then** the attempt is rejected with a single generic message that does not
   reveal which field was wrong, and no session is created.
3. **Given** the sign-in page, **When** the user submits an empty username or empty password,
   **Then** accessible inline validation is shown and no authentication request proceeds.

---

### User Story 3 - Guided validation and rejection of invalid input (Priority: P3)

While registering, a user who enters an invalid username or password receives clear,
accessible, inline feedback and is prevented from creating an invalid or duplicate account.
This covers usernames that are too short, contain disallowed characters, or are already
taken, and passwords that are too short or too long.

**Why this priority**: Enforcing the rules — and communicating them well — is what makes the
new policy trustworthy and prevents bad or duplicate data. It builds on US1 by covering the
unhappy paths.

**Independent Test**: On the registration page, submit each class of invalid input (username
under 3 characters, username containing a special character, an already-registered username,
a password under 3 or over 10 characters) and confirm each is rejected with a clear,
specific, accessible message and that no account is created.

**Acceptance Scenarios**:

1. **Given** the registration page, **When** the user submits a username shorter than 3
   characters, **Then** it is rejected with a clear message and no account is created.
2. **Given** the registration page, **When** the user submits a username containing any
   non-alphanumeric character (for example a space, symbol, or punctuation), **Then** it is
   rejected with a clear message and no account is created.
3. **Given** a username that is already registered, **When** the user submits the form,
   **Then** registration is refused with a clear "username already taken" message and no
   duplicate account is created.
4. **Given** the registration page, **When** the user submits a password shorter than 3 or
   longer than 10 characters, **Then** it is rejected with a clear message and no account is
   created.
5. **Given** any of the above rejections, **When** the error is shown, **Then** it is
   presented as accessible inline feedback that identifies which rule was violated without
   exposing sensitive details.

---

### Edge Cases

- **Boundary lengths (username)**: A username of exactly 3 characters is accepted; a username
  of 2 characters is rejected.
- **Boundary lengths (password)**: A password of exactly 3 or exactly 10 characters is
  accepted; a password of 2 or 11 characters is rejected.
- **Case-only differences**: A username that differs from an existing one only by letter case
  (for example "Alice" vs "alice") is treated as the same name and rejected as a duplicate.
- **Surrounding whitespace**: Leading and trailing whitespace is removed before validation;
  after trimming, the username must still be purely alphanumeric (internal spaces are not
  allowed).
- **Empty submissions**: An empty username or empty password is rejected with inline guidance
  before any server request is made.
- **Non-ASCII letters**: Accented or non-Latin letters (for example "café" or "naïve") are
  treated as disallowed characters under the alphanumeric rule and are rejected.
- **Excessively long username**: A username beyond the maximum accepted length (see
  Assumptions) is rejected with a clear message.
- **Email-style input in the username field**: An email address entered as a username is
  rejected because it contains disallowed characters (for example "@" and ".").

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST use a **username** as the sole login identifier for both
  account creation and sign-in, replacing the previous email-based identifier.
- **FR-002**: The system MUST NOT require or accept an email address as the login credential;
  the registration and sign-in flows MUST NOT depend on an email address.
- **FR-003**: The system MUST require a username to consist only of alphanumeric characters
  (letters and digits) and MUST reject any username containing spaces, symbols, punctuation,
  or other special characters.
- **FR-004**: The system MUST require a username to be at least 3 characters long (after
  surrounding whitespace is removed).
- **FR-005**: The system MUST enforce that every username is unique across all accounts and
  MUST reject registration when the chosen username already exists.
- **FR-006**: The system MUST treat usernames as case-insensitive for both uniqueness and
  sign-in, so that names differing only by letter case refer to the same account.
- **FR-007**: The system MUST require a registration password to be between 3 and 10
  characters in length, inclusive, and MUST reject passwords shorter than 3 or longer than 10
  characters.
- **FR-008**: The registration page MUST present a **Username** input in place of the former
  **Email** input, and MUST present password guidance that reflects the 3–10 character rule
  (replacing the former 12-character guidance).
- **FR-009**: The registration page MUST validate the username and password against the rules
  above and surface accessible, inline feedback that identifies the specific rule violated
  before the form is submitted to the server.
- **FR-010**: When a username is too short, contains disallowed characters, or is already
  taken, the system MUST reject the registration with a clear, specific, non-leaky message
  and MUST NOT create an account.
- **FR-011**: The system MUST continue to store passwords only in hashed form and MUST never
  store or display a password in plaintext.
- **FR-012**: The sign-in page MUST accept a **username** (not an email) plus a password, and
  MUST continue to reject invalid credentials with a single generic message that does not
  reveal which field was wrong or whether the username exists.
- **FR-013**: The system MUST preserve the existing personalization experience (the welcome
  message and the corner user menu) for authenticated users after the identity change.

### Key Entities *(include if feature involves data)*

- **User Account**: A registered user of the application. Identified by a unique **username**
  (alphanumeric, at least 3 characters, unique case-insensitively) instead of an email
  address. Retains a display name used for personalization and a password stored only in
  hashed form. Email is no longer part of the account's login identity.
- **Credentials**: The username-and-password pair a person submits when registering or
  signing in. Governed by the username format/length/uniqueness rules and the 3–10 character
  password rule at registration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can create an account using only a username and a password — with no
  email requested anywhere in the flow — in under 1 minute.
- **SC-002**: 100% of registration attempts using a username shorter than 3 characters,
  containing any non-alphanumeric character, or duplicating an existing username (including
  case-only differences) are rejected with a clear message and create no account.
- **SC-003**: 100% of registration attempts using a password shorter than 3 or longer than 10
  characters are rejected, while every password of length 3–10 is accepted.
- **SC-004**: No account can be created or signed into using an email address as the login
  identifier; email does not appear anywhere in the registration or sign-in flow.
- **SC-005**: A registered user signs in successfully on the first attempt when they supply
  the correct username and password, with no reference to email anywhere in the experience.
- **SC-006**: Every invalid username or password entered on the registration page produces
  accessible inline feedback identifying the violated rule before the form is submitted to
  the server, in 100% of cases.

## Assumptions

- **Username replaces email entirely.** The user asked that the identifier not be an email,
  so email is removed from the login identity and is no longer collected during registration
  or used to sign in. (No email-based features such as email verification or password-reset
  by email exist today, so nothing depends on it.)
- **Display name is retained.** The change is scoped to the login identifier and password
  rules; the existing separate display name (shown in the welcome message and user menu) is
  kept and still collected at registration. If the intent is instead for the username to also
  serve as the displayed name, that can be adjusted during clarification.
- **Case-insensitive usernames.** To prevent confusing collisions (for example "Alice" vs
  "alice"), usernames are unique and matched without regard to letter case, consistent with
  how the email identifier was normalized previously.
- **Alphanumeric means ASCII letters and digits.** "Alphanumeric, no special characters" is
  interpreted as the ASCII sets A–Z, a–z, and 0–9 only — no spaces, punctuation, symbols,
  underscores, hyphens, or accented/non-Latin letters — to keep the rule unambiguous.
- **Username maximum length.** The requirement specifies a minimum of 3 with no stated
  maximum; a reasonable upper bound of 30 characters is assumed to prevent abuse and keep the
  name usable in the interface. This bound can be adjusted during clarification.
- **No migration of pre-existing accounts.** The application is early in its lifecycle (login
  and accounts were introduced only in the immediately preceding features), so this change
  assumes there are no production accounts created under the old email-based scheme that need
  to be migrated. If such accounts exist, a migration approach is out of scope for this
  specification.
- **Password length is used as specified, with a noted security trade-off.** The 3–10
  character password rule is applied exactly as requested. Because this product is a password
  manager whose guiding principles emphasize strong credentials, allowing passwords as short
  as 3 characters materially weakens account security compared with the previous 12-character
  minimum; this trade-off is intentional per the request and is flagged here for visibility.
- **Sign-in validation stays lightweight.** As today, sign-in only requires a non-empty
  username and a non-empty password; the full format and length rules are enforced at
  registration, and credential correctness at sign-in is determined by lookup.
