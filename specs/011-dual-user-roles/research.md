# Research: Dual Usernames with Roles & Security-Question Password Reset

**Feature**: specs/011-dual-user-roles | **Date**: 2026-07-13

No `NEEDS CLARIFICATION` markers existed in the Technical Context; the research below
records the design decisions that resolve the open *how* questions.

---

## Decision 1: Account shape — one `users` document with an embedded `logins` array

**Decision**: Reshape `UserDoc` into an **account** document holding
`logins: [{ username, role }]` (exactly two entries: one `admin`, one `normal`),
with a **unique multikey index on `logins.username`**. All other account-level fields
(displayName, passwordHash, kdfSalt, vaultKeyWrapped, security-question fields) stay
flat on the document. The account `_id` remains the `userId` referenced by
`sessions`, `sections`, and `chords` — those references are untouched.

**Rationale**:
- FR-003 requires global uniqueness across ALL usernames of ALL accounts regardless of
  role. Two flat fields (`usernameAdmin`, `usernameNormal`) with two unique indexes do
  NOT prevent a cross-field collision (account A's admin name == account B's normal
  name). A unique **multikey** index on an array field enforces uniqueness across
  documents for every array element — exactly the constraint needed, race-safe at the
  DB level.
- MongoDB's multikey unique constraint does not prevent duplicates *within* one
  document, but the Zod schema + service pre-check already reject
  `adminUsername == username` (case-insensitive), so that hole is closed at the
  boundary.
- Lookup by either username is one query: `{ 'logins.username': u }`; the matched
  element's `role` is what the session records.
- Keeping the account `_id` as the vault owner id means **zero changes** to
  sections/chords services and to the L2 encryption key derivation
  (HKDF salt=userId, feature 010).

**Alternatives considered**:
- *Separate `identities` collection* (username → accountId, role): normalized and also
  race-safe, but adds a second query (or `$lookup`) to every login/salt request and a
  cross-collection consistency burden — overkill for exactly-two identities.
- *Two flat fields + service-level `$or` pre-check*: readable, but the cross-field
  uniqueness race can only be closed with a transaction; the multikey index gets the
  same guarantee for free.

## Decision 2: One shared credential — a single `passwordHash`/`kdfSalt` per account

**Decision**: The account keeps exactly one `passwordHash` (PBKDF2 re-hash of the
client `authHash`, unchanged pipeline) and one `kdfSalt`. `GET /api/auth/salt/:username`
resolves the **account** salt for *either* username (decoy for unknown names, as
today). Login derives the same `authHash` regardless of which username was typed —
the server verifies it against the single account verifier and records the **role of
the matched username** on the session.

**Rationale**: "For both usernames, password should be same" (FR-002) makes the
credential account-scoped, not identity-scoped. One salt per account means the
client-side derivation (`deriveKeys(password, kdfSalt)`) is identical for both
usernames — so the wrap key unwraps the same `vaultKeyWrapped` and both identities
open the same vault with no extra crypto material.

**Alternatives considered**: Per-identity salts would force two wrapped copies of the
vault key to be kept in sync on every password change for zero benefit — rejected.

## Decision 3: Role enforcement — session-carried role + `requireAdmin` middleware

**Decision**: `SessionDoc` gains `role: 'admin' | 'normal'`, set at `createSession`
from the username used to sign in. `validateSession` returns `{ userId, role }`;
`requireSession` attaches a `PublicUser` that now includes `role` and the specific
`username` used. A new one-liner middleware `requireAdmin` throws
`403 role_forbidden` ("Your sign-in doesn't allow changes. Sign in with the admin
username to make changes.") and is mounted on every mutating route:

| Route | Method | Gate |
|---|---|---|
| `/api/sections` | POST | requireAdmin |
| `/api/sections/reorder` | POST | requireAdmin |
| `/api/sections/:sectionId` | PATCH, DELETE | requireAdmin |
| `/api/sections/:sectionId/chords` | POST | requireAdmin |
| `/api/sections/:sectionId/chords/reorder` | POST | requireAdmin |
| `/api/chords/:chordId` | PATCH, DELETE | requireAdmin |
| all GET routes | GET | requireSession only (both roles) |

**Rationale**: FR-007 demands server-side enforcement independent of the UI. Binding
role to the *session* (not re-deriving from the user doc per request) is correct per
FR-004 ("the role the session carries") and free — it rides the existing session
lookup. Reset (FR-012) already revokes all sessions, so a role can never outlive a
password epoch.

**Alternatives considered**:
- *Deriving role per-request from the username on the user doc*: requires storing
  which username the session used anyway — same data, more lookups.
- *Route-level `if` checks inside handlers*: scatters the policy; middleware keeps it
  declarative and impossible to forget on one verb (contract lists every gated route).

## Decision 4: Recovery crypto — second wrap of the SAME vault key under an answer-derived key

**Decision**: At registration the client additionally:

1. normalizes the security answer (`trim().toLowerCase()`, collapse internal
   whitespace runs to single spaces),
2. generates a separate random `recoverySalt` (16 bytes, base64url),
3. runs the **existing KDF pipeline** over the normalized answer:
   PBKDF2-HMAC-SHA-256 600k (answer, recoverySalt) → HKDF split with new info strings
   `vii-pass/recovery-auth` → `answerHash` (sent to server) and
   `vii-pass/recovery-wrap` → `recoveryWrapKey` (never leaves the browser),
4. wraps the SAME vault key: `vaultKeyWrappedRecovery = v1.wk.<iv>.<ct>` under
   `recoveryWrapKey`.

Server stores: `securityQuestionId` (0–4), `recoverySalt`,
`securityAnswerVerifier` (PBKDF2 re-hash of `answerHash` via the existing
`hashPassword`), and `vaultKeyWrappedRecovery` (opaque).

Reset then: client proves the answer (server compares verifier), receives
`vaultKeyWrappedRecovery` + a one-time reset token, unwraps the vault key locally,
generates a **fresh kdfSalt**, derives new keys from the new password, re-wraps the
vault key, and submits `{ newAuthHash, newKdfSalt, newVaultKeyWrapped }`. The server
atomically replaces `passwordHash + kdfSalt + vaultKeyWrapped` in one `updateOne`
(exactly the FR-010/feature-010 password-change contract already documented on
`UserDoc.kdfSalt`) and revokes all sessions. `vaultKeyWrappedRecovery` is untouched —
the vault key inside never changed, so **no chord data is re-encrypted and FR-011
holds**.

**Rationale**:
- This is the only construction that satisfies FR-011 under 010's E2E model without
  server-side key escrow: the vault key must be recoverable from something the user
  knows that isn't the password → wrap it under the answer.
- Reusing `deriveKeys`' exact pipeline (new info strings only) keeps `crypto.ts` a
  single audited KDF path; HKDF domain separation guarantees the recovery branch can't
  be computed from the auth branch or vice versa.
- The verifier re-hash server-side mirrors the `authHash` treatment — a DB dump yields
  neither a replayable `answerHash` nor vault-decryption material.
- A password *reset* is deliberately identical in DB effect to the future password
  *change* (FR-010 of feature 010) — one atomic triple-replace — so this feature
  doesn't preclude, it *implements*, the re-wrap-only contract.

**Alternatives considered**:
- *Server-side escrow of the vault key* (encrypt under `VAULT_ENC_KEY`): trivially
  satisfies FR-011 but destroys zero-knowledge — operators could decrypt every vault.
  Rejected outright for a password manager.
- *Deriving the recovery key from question+answer without a salt*: rainbow-table-able
  across users choosing the same answer. Per-account random salt is free.
- *Wiping the vault on reset*: violates FR-011 and SC-004 ("zero stored values lost").

## Decision 5: Non-enumerable reset flow — decoy question + name-keyed throttling

**Decision**: The reset flow is three POSTs (see contracts/auth-api.md):

1. `POST /api/auth/reset/question { username }` → **always 200** with
   `{ questionId, recoverySalt }`. For the admin username of a real account these are
   real; for a normal username, unknown name, or malformed name they are a
   **deterministic decoy**: `questionId = firstByte(SHA-256(username + '\u0000q' + SALT_DECOY_PEPPER)) % 5`,
   `recoverySalt` = same decoy-salt construction the salt endpoint already uses (with
   a distinct domain string).
2. `POST /api/auth/reset/verify { username, answerHash }` → on success
   `{ resetToken, vaultKeyWrappedRecovery }`; on ANY failure (wrong answer, normal
   username, unknown name) the same generic `401 invalid_reset` — indistinguishable.
   Throttled (below).
3. `POST /api/auth/reset/complete { username, resetToken, newAuthHash, newKdfSalt, newVaultKeyWrapped }`
   → atomic credential replace + `revokeAllSessionsForUser` + reset-token burn → 204.

**Throttling**: NEW `resetAttempts` collection keyed by the *requested username
string* (not account id): `{ usernameKey, failedCount, lockedUntil, expiresAt(TTL) }`.
Checked at `verify`; 5 failures → `429 too_many_attempts` for 15 min. Because it's
keyed by the typed name, unknown names throttle **identically** to real ones (FR-010,
SC-005). TTL index auto-purges rows. Reset token: 32 random bytes via the existing
token helpers, only its SHA-256 stored on the account
(`resetTokenHash`, `resetTokenExpiresAt` = 10 min), single-use (cleared at complete),
and issued only after a verified answer.

**Rationale**: Workers isolates cannot hold in-memory counters (stateless, multi-PoP);
DB-backed throttling is the only correct option (consistent with the existing login
lockout, which is also DB-backed). The decoy construction reuses the
`SALT_DECOY_PEPPER` binding — **no new env vars**. Verification is server-side (not
"does the unwrap succeed" client-side) so `vaultKeyWrappedRecovery` is never handed to
an unverified caller for offline brute-force.

**Alternatives considered**:
- *Client-side answer verification (try the unwrap)*: hands the recovery blob to
  anyone who asks → offline dictionary attack on the (likely weak) answer. Rejected.
- *Rate limiting via Cloudflare rules*: infrastructure-level and per-IP, not
  per-target-account; doesn't satisfy "attempt limit per account" semantics. Kept as
  an optional extra layer, not the mechanism.
- *Storing attempt counters on the user doc only*: leaks existence (unknown names
  never 429) — the exact hole FR-010 forbids.

## Decision 6: Fixed question list — shared runtime constant, id stored server-side

**Decision**: Define the 5 questions once in `shared/types/index.ts` as
`SECURITY_QUESTIONS: readonly string[]` (ids = array index 0–4):

0. "What was the name of your first pet?"
1. "In what city were you born?"
2. "What is your mother's maiden name?"
3. "What was the name of your first school?"
4. "What was the name of your favorite teacher?"

The server stores/serves only `securityQuestionId`; the client renders the text.

**Rationale**: FR-013 fixes the list product-wide; a single shared constant keeps
front/back in lockstep with zero duplication. This is the shared package's first
*runtime* export — acceptable: it's ~200 bytes, tree-shakeable, and the alternative
(duplicating the list) invites drift. The dropdown maps directly over the array.

**Alternatives considered**: Serving the list from an API endpoint — a network call
for immutable static data; rejected (YAGNI).

## Decision 7: Read-only UI — a derived `readOnly` flag, controls removed not disabled

**Decision**: `PublicUser` gains `role`; the frontend derives
`readOnly = user.role !== 'admin'` (exposed via `useAuth()`; VaultContext threads it
where convenient). Components **omit** (not disable) mutation affordances when
read-only: SectionTabs renders no `+` tab, no move `‹›` buttons, no edit affordance,
and doesn't attach DnD handlers; ChordGrid renders no add tile and no drag handlers;
ChordCard renders no edit and no `↑↓` move buttons (reveal/copy stay). The vault API
client is unchanged — the server is the actual guard (Decision 3).

**Rationale**: FR-006/007: the UI must not *offer* the controls; disabled buttons are
noise and imply "coming soon". Reveal/copy explicitly remain (spec Assumption:
restriction is on changing, not seeing). Keyboard-move buttons and DnD are gated by
the same flag, so a11y parity holds. Server-side 403 remains the enforcement of
record — the UI flag is purely presentational.

**Alternatives considered**: Disabled-but-visible controls with a tooltip — poorer
touch/a11y experience and clutters the 320px layout; rejected.

## Decision 8: Existing data — drop, don't migrate

**Decision**: Per environment, drop `users`, `sessions`, and `resetAttempts`
(if present) at ship. `sections`/`chords` documents keyed to old user ids become
orphans (their L2 wrap is HKDF-salted by the old userId anyway) → drop them too.
Same ship procedure as features 004/010.

**Rationale**: Spec Assumption "Existing accounts are not migrated" — consistent with
every prior identity-shape change in this product. The user base is the developer.

**Alternatives considered**: Dual-shape read path — pure cost for zero users; rejected.
