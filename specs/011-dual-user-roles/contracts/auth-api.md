# Contract: Authentication & Password-Reset API

**Feature**: specs/011-dual-user-roles | **Date**: 2026-07-13
**Base path**: `/api/auth` | **Error envelope**: `ApiError` `{ error: { code, message } }` (unchanged)

Routes and verbs from features 002/004/010 are preserved; `register` changes payload,
`login`/`me`/`logout`/`salt` keep their shapes (with `role` added inside `user`), and
three reset endpoints are NEW.

---

## GET /api/auth/salt/:username — public (shape unchanged)

Resolves the **account** KDF salt for *either* of the account's two usernames.
Unknown names get the existing deterministic decoy. Response: `200 { kdfSalt }`.

## POST /api/auth/register — public (payload changed)

Creates one account with two usernames, the shared credential, and the recovery
material; signs the caller in **as admin**.

### Request

```jsonc
{
  "adminUsername": "vimaladmin",          // 3–30 alnum, lowercased server-side
  "username": "vimal",                    // normal username; must differ from adminUsername
  "displayName": "Vimal",
  "authHash": "<b64url 43>",              // HKDF auth branch of PBKDF2(password, kdfSalt)
  "kdfSalt": "<b64url 22>",
  "vaultKeyWrapped": "v1.wk.<iv>.<ct>",   // vault key under password wrapKey
  "securityQuestionId": 2,                // 0–4, index into SECURITY_QUESTIONS
  "answerHash": "<b64url 43>",            // HKDF recovery-auth branch of PBKDF2(normalizedAnswer, recoverySalt)
  "recoverySalt": "<b64url 22>",
  "vaultKeyWrappedRecovery": "v1.wk.<iv>.<ct>" // SAME vault key under recovery wrapKey
}
```

Client-side pre-conditions (the server never sees these inputs): password 3–10 chars;
security answer non-empty, normalized `trim().toLowerCase()` + inner-whitespace
collapse before the KDF.

### Responses

| Status | Code | When |
|---|---|---|
| 201 | — | `{ user: { id, username: adminUsername, displayName, role: "admin" }, vaultKeyWrapped }` + session cookie (admin role) |
| 400 | `validation_error` | Any field violates the rules in data-model.md |
| 400 | `usernames_identical` | `adminUsername == username` after normalization |
| 409 | `username_taken` | Either requested name collides with ANY existing username (either role, any account). Message never discloses which/whose. |

## POST /api/auth/login — public (shape unchanged, role added)

`{ username, authHash }` — `username` may be either of the account's names. Server
finds the account via `logins.username`, verifies `authHash` against the single
account verifier, and creates a session carrying the **matched login's role**.

| Status | Code | When |
|---|---|---|
| 200 | — | `{ user: { …, username: <as typed, normalized>, role }, vaultKeyWrapped }` + cookie |
| 401 | `invalid_credentials` | Unknown name or wrong hash — generic (no enumeration) |
| 403 | `account_disabled` | unchanged |
| 429 | `too_many_attempts` | unchanged account lockout (5 / 15 min) |

## GET /api/auth/me — session (unchanged shape)

`{ user (incl. role of THIS session), vaultKeyWrapped }`.

## POST /api/auth/logout — session (unchanged)

`204`, revokes the session, clears the cookie.

---

## POST /api/auth/reset/question — public, NEW

Step 1 of the reset flow. **Always 200** — indistinguishable for admin names, normal
names, and unknown names (FR-010).

### Request

```jsonc
{ "username": "vimaladmin" }
```

### Response — 200 always (after trivial validation)

```jsonc
{ "questionId": 2, "recoverySalt": "<b64url 22>" }
```

- Admin username of an active account → the account's real `securityQuestionId` +
  `recoverySalt`.
- Normal username / unknown / disabled → **deterministic decoy**:
  `questionId = firstByte(SHA-256(username + "\u0000q" + SALT_DECOY_PEPPER)) % 5`;
  `recoverySalt` = decoy-salt construction (domain-separated from the login-salt decoy).
  Same name → same decoy forever (no oracle via repetition).
- 400 `validation_error` only for a structurally empty/invalid body.

## POST /api/auth/reset/verify — public, NEW, throttled

Step 2: prove the answer. On success issues a one-time reset token and releases the
recovery-wrapped vault key.

### Request

```jsonc
{ "username": "vimaladmin", "answerHash": "<b64url 43>" }
```

### Responses

| Status | Code | When |
|---|---|---|
| 200 | — | `{ "resetToken": "<b64url 43>", "vaultKeyWrappedRecovery": "v1.wk.<iv>.<ct>" }`. Server sets `resetTokenHash` + 10-min expiry on the account; clears the `resetAttempts` row. |
| 401 | `invalid_reset` | Wrong answer, normal username, unknown name, disabled account — ALL identical ("That didn't match our records."). Increments `resetAttempts[usernameKey]`. |
| 429 | `too_many_attempts` | ≥5 failed verifies for this typed name within the window → locked 15 min. Applies to unknown names identically (name-keyed, not account-keyed). |

Ordering rule: the throttle check runs BEFORE answer verification; a 429 during
lockout is returned for known and unknown names alike.

## POST /api/auth/reset/complete — public (token-authenticated), NEW

Step 3: replace the credential epoch. The client has already (locally): unwrapped the
vault key from `vaultKeyWrappedRecovery` using the answer-derived recovery wrap key,
generated a fresh `kdfSalt`, derived new keys from the NEW password (3–10, enforced at
the form), and re-wrapped the SAME vault key.

### Request

```jsonc
{
  "username": "vimaladmin",
  "resetToken": "<from verify>",
  "newAuthHash": "<b64url 43>",
  "newKdfSalt": "<b64url 22>",
  "newVaultKeyWrapped": "v1.wk.<iv>.<ct>"
}
```

### Responses

| Status | Code | When |
|---|---|---|
| 204 | — | Atomic single `updateOne` replaces `passwordHash` (re-hash of `newAuthHash`) + `kdfSalt` + `vaultKeyWrapped`, burns `resetTokenHash`; then ALL sessions for the account are revoked (FR-012). `vaultKeyWrappedRecovery` untouched (FR-011). No cookie is set — the user signs in with the new password. |
| 401 | `invalid_reset` | Token missing/expired/mismatched/already used, or name not an admin username — generic. |
| 400 | `validation_error` | Malformed fields. |

### Invariants

- A reset token is single-use and bound to one account; `complete` with a stale token
  after a second `verify` re-issue fails (only the latest hash matches).
- After 204: old password fails for BOTH usernames; new password succeeds for BOTH
  (single account verifier); previously stored chords decrypt unchanged (the vault key
  never changed).

---

## Client crypto contract (frontend/src/vault/crypto.ts — additions)

```text
deriveRecoveryKeys(answerNormalized, recoverySalt):
  PBKDF2-HMAC-SHA-256 600k → masterRecovery
    ├─ HKDF info="vii-pass/recovery-auth" → answerHash (b64url, sent)
    └─ HKDF info="vii-pass/recovery-wrap" → recoveryWrapKey (AES-256-GCM, local only)
normalizeSecurityAnswer(raw): trim → toLowerCase → collapse whitespace runs to ' '
```

Register wraps the vault key twice (password wrapKey + recoveryWrapKey) — both
`v1.wk.*` envelopes, existing `wrapVaultKey`/`unwrapVaultKey` reused verbatim.
