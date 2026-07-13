# Feature Specification: Two-Level Credential Encryption

**Feature Branch**: `topic/vii-1011-credential-encryption`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "As this is the credential manager application, I want to secure the application. Let's bring the encoding and decoding logics. I need 2 level of encryption and decryption. 1. In Front end 2. In backend. No password should be visible in database and network payload in the browser. Just analyze what is the more secured way to protect the data."

## Overview

vii-pass stores users' credentials (chords), including passwords and other sensitive
values. Today those values travel to the server and are stored in the database in
readable form. This feature introduces **two independent layers of protection**:

1. **Level 1 — On the user's device**: secret values are converted to an unreadable form
   *before* they leave the browser, so no readable secret ever appears in the network
   payload (even when inspected with browser developer tools) and the server never
   receives readable secrets.
2. **Level 2 — On the server**: the server applies its own additional protection layer
   before persisting data, so a copy of the database alone (backup theft, misconfigured
   access, insider snooping) reveals nothing usable — even the client-protected form is
   not stored as-is.

The result: a readable password exists **only inside the user's unlocked browser
session**, at the moment the user chooses to reveal or copy it. It is never readable in
transit, never readable at rest, and never readable to anyone operating the server or
database.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secrets are unreadable in transit and at rest (Priority: P1)

As a vault user, when I save a credential, the secret values I enter must never be
visible in readable form anywhere outside my own screen — not in the network traffic my
browser sends, not in the database, and not to anyone who administers the system. When I
open my vault later, I can still see, reveal, and copy my credentials exactly as before.

**Why this priority**: This is the core promise of a password manager and the entire
point of the feature. Without it, no other story matters.

**Independent Test**: Save a chord containing a password. Inspect the browser's network
panel during save and load — no readable secret value appears in any request or response
body. Inspect the stored database record — no readable secret value appears. Then reveal
and copy the value in the UI — it matches what was entered.

**Acceptance Scenarios**:

1. **Given** a logged-in user with an unlocked vault, **When** they create or edit a
   chord with secret values, **Then** every request payload leaving the browser contains
   only unreadable representations of those values.
2. **Given** a saved chord, **When** its database record is inspected directly, **Then**
   no secret value is present in readable form, and the stored form differs from the form
   that traveled over the network (two distinct layers).
3. **Given** a logged-in user viewing their vault, **When** they reveal or copy a secret
   field on a chord card, **Then** the original readable value they entered is shown or
   copied, unchanged.
4. **Given** a user's vault data, **When** an operator reads the database or server logs,
   **Then** they cannot recover any secret value from what is stored or logged.

---

### User Story 2 - Vault unlock is tied to the user's sign-in (Priority: P2)

As a vault user, I unlock my protected data as part of signing in — I do not want a
second prompt or extra steps. When I sign out (or my session ends), my device retains
nothing that could unlock my data.

**Why this priority**: Level-1 protection requires unlocking on the device. If unlocking
is clumsy, users abandon the product; if unlock material outlives the session, the
protection is hollow.

**Independent Test**: Sign in, load the vault, confirm secrets are readable in the UI.
Sign out, then inspect browser storage — no material remains that could unlock the data.
Sign back in — vault opens and secrets are readable again with no extra prompt.

**Acceptance Scenarios**:

1. **Given** a registered user, **When** they sign in with their password, **Then** their
   vault becomes readable in that browser session without any additional prompt.
2. **Given** a signed-in user, **When** they sign out or their session expires, **Then**
   no unlock material remains in the browser, and previously loaded secrets are no longer
   recoverable on that device.
3. **Given** a user on a brand-new device/browser, **When** they sign in, **Then** their
   full vault is readable — nothing device-specific is required (vault works from
   anywhere in the world).

---

### User Story 3 - Changing the account password keeps the vault readable (Priority: P3)

As a vault user, if my password changes, all my previously saved credentials must remain
readable afterwards — a password change must never silently make my vault unreadable.

**Why this priority**: Password changes are rare but inevitable; corrupting the vault on
password change would be catastrophic. Lower priority only because the app does not yet
expose a change-password flow — this story defines the rule any future flow must obey.

**Independent Test**: With saved chords in the vault, change the account password through
whatever mechanism exists (including administrative reset, if any). Sign in with the new
password and confirm every previously saved secret is still readable.

**Acceptance Scenarios**:

1. **Given** a user with saved chords, **When** their password is changed, **Then** after
   signing in with the new password every previously saved secret is readable, unchanged.
2. **Given** a password change that fails partway, **When** the user signs in again,
   **Then** the vault is in a consistent state — either fully on the old credential or
   fully on the new one, never a mix that loses data.

---

### Edge Cases

- **Forgotten password**: With no recovery path in this feature, a forgotten password
  means the vault contents are unrecoverable (true zero-knowledge). A dedicated recovery
  mechanism is deferred to a future feature (see Assumptions); nothing in this design may
  preclude adding one later.
- **Tampered or corrupted stored data**: If a stored protected value fails integrity
  verification when opened, the user sees a clear per-field error ("This value could not
  be read") rather than garbage output or a crashed vault; other chords and fields remain
  usable.
- **Stale open tab after logout elsewhere**: A tab whose session has ended must fail
  closed — it cannot decrypt newly fetched data and must not expose previously decrypted
  values after the user navigates or refreshes.
- **Clipboard**: Copying a secret necessarily places the readable value on the clipboard;
  this is accepted, user-initiated behavior (already the case today) and is out of scope
  to restrict.
- **Existing plaintext chords**: Chords created before this feature contain readable
  values. Consistent with prior practice in this project, existing chord data is dropped,
  not migrated (see Assumptions).
- **Very slow or failed save**: If protection processing fails on the device, the save is
  aborted with a clear error — the app must never "fall back" to sending readable
  secrets.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Secret credential values MUST be transformed into an unreadable form on the
  user's device before any network transmission; readable secret values MUST never appear
  in any request or response body observable in the browser.
- **FR-002**: The server MUST apply a second, independent protection layer before
  persisting credential data, such that the stored form differs from the transmitted form
  and neither the database contents alone nor the transmitted payload alone yields
  readable secrets.
- **FR-003**: No secret value MUST be stored in readable form in the database, in server
  logs, or in any error message.
- **FR-004**: A signed-in user MUST be able to view, reveal, and copy their original
  secret values in the vault UI exactly as they do today (masked by default, eye toggle
  for sensitive types, copy without reveal).
- **FR-005**: Vault unlock MUST happen as part of the normal sign-in flow with no
  additional prompt, and MUST work from any device or browser with no device-local
  prerequisite. The unlock material is derived from the user's account login password —
  no separate vault passphrase is introduced.
- **FR-006**: All unlock material held in the browser MUST be discarded at sign-out and
  MUST NOT be persisted beyond the session.
- **FR-007**: Protected values MUST carry integrity protection: any tampering or
  corruption is detected on read and reported as a per-field read error, without
  affecting other data.
- **FR-008**: The system MUST remain fully functional for all existing vault operations
  (create, edit, list, reorder, per-section title uniqueness) with protection in place.
- **FR-009**: If on-device protection fails for any reason, the operation MUST abort with
  a clear user-facing error; the system MUST never transmit readable secrets as a
  fallback.
- **FR-010**: A future account-password change MUST NOT render previously protected data
  unreadable (design must accommodate this even though no change-password UI ships in
  this feature).
- **FR-011**: The scope of protected fields is: all chord field values (all five field
  types, whether sensitive or not) and the chord URL are protected at both levels; the
  chord title remains readable to support listing, ordering, and per-section duplicate
  detection.
- **FR-012**: Server-side protection material (whatever the server uses for Level 2) MUST
  be held as deployment secrets, never in source control, and MUST be rotatable without
  data loss by design.

### Key Entities

- **Protected value**: The unreadable representation of a secret (field value or URL). It
  exists in two nested forms — the form that travels over the network (Level 1 applied)
  and the form at rest (Level 1 + Level 2 applied). Carries whatever bookkeeping is
  needed to reverse the protection and verify integrity.
- **User unlock material**: Whatever the user's device derives during sign-in that makes
  their vault readable for the session. Exists only in browser memory for the life of the
  session; never stored, never sent in readable/recoverable form to the server.
- **Server protection material**: The secret(s) the server uses for the Level-2 layer.
  Deployment-managed, per-environment, rotatable.
- **Chord (updated)**: Same organizational shape as today (title, section, position,
  three typed field rows, optional URL) but with field values and URL held as protected
  values instead of readable text.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of secret field values and URLs in the database are unreadable under
  direct inspection; zero readable secrets can be produced from a database copy alone.
- **SC-002**: Zero readable secret values appear in any browser-observable network
  payload across all vault operations (verified by inspecting every request/response
  during a full create → list → edit → reorder → reveal → copy walkthrough).
- **SC-003**: Users complete every existing vault task (save, reveal, copy, edit,
  reorder) with no new steps and no perceptible slowdown — vault load and save remain
  within roughly one second on a typical connection.
- **SC-004**: A simulated database-only compromise (attacker holds a full DB dump but no
  server secrets and no user passwords) yields zero recovered credentials.
- **SC-005**: A simulated server-compromise-without-user-password (attacker holds DB and
  all server secrets) still yields zero readable credentials, because Level 1 can only be
  reversed with user-derived material.
- **SC-006**: 100% of tampered/corrupted stored values are detected and surfaced as
  per-field errors rather than displayed as wrong data.

## Clarifications

### Session 2026-07-13

- Q: What should the on-device (Level 1) protection be derived from? → A: The account
  login password, as-is (Option A). No separate vault passphrase; the existing 3–10
  character password policy is unchanged. **Accepted trade-off**: a short login password
  weakens Level 1 against offline brute force if the database leaks; Level 2
  (server-side) is the compensating layer. This deviation is deliberate and must be
  carried into planning as a documented complexity/security trade-off.
- Q: Should a forgotten password have a recovery path? → A: Deferred to a future
  feature. In this feature the behavior is true zero-knowledge: a forgotten password
  means vault contents are unrecoverable. The design must not preclude adding a recovery
  mechanism later (e.g., a recovery key), consistent with FR-010's rule that key
  management changes must be possible without data loss.

## Assumptions

- **Existing chord data is dropped, not migrated.** Consistent with feature 009
  precedent, pre-existing chords (which contain readable values) are deleted per
  environment when this ships. Users re-enter credentials.
- **Titles remain readable** so that listing, ordering, and per-section duplicate
  detection keep working without changes to those behaviors (encoded in FR-011). Titles
  are treated as organizational labels, not secrets; users should not put secrets in
  titles.
- **Transport security (HTTPS) is already in place** and is not counted as one of the two
  levels — the user explicitly wants secrets unreadable *in the payload as seen in the
  browser*, which transport security does not provide.
- **Clipboard and screen exposure are out of scope**: once a user reveals or copies a
  value, protecting it on their screen/clipboard is their responsibility, as today.
- **No change-password or account-recovery UI ships in this feature**; the design only
  has to make such flows possible later without data loss (FR-010). Until a recovery
  feature ships, a forgotten password means the vault is unrecoverable — the UI should
  make this consequence clear to users at registration.
- **Session mechanics are unchanged**: the existing opaque server-side session and
  HttpOnly cookie continue to govern who is signed in; this feature governs only the
  readability of vault contents.
- **Search/filter over secret values is not required** — the app has no such feature
  today, and protected values need not be searchable server-side.
