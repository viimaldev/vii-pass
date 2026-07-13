# Quickstart: Two-Level Credential Encryption

**Feature**: specs/010-credential-encryption | **Date**: 2026-07-13

Manual verification walkthrough for the critical security flow (Constitution II allows
concentrating verification effort here). Run against the local Node dev loop.

## 0. Prerequisites

```powershell
# One-time per environment: set the Level-2 key (32 random bytes, base64url, k1-prefixed)
# Local: add to backend/.dev.vars →  VAULT_ENC_KEY="k1:<base64url-32-bytes>"
# Deployed: wrangler secret put VAULT_ENC_KEY [--env preview]

# Drop pre-feature data (verifier semantics changed — research Decision 6):
# db.users.drop(); db.sessions.drop(); db.chords.drop()   (per environment)

npm run dev:node   # from repo root → API :8787 + SPA :5173
```

## 1. Registration produces no readable secrets on the wire (US1/US2, SC-002)

1. Open http://localhost:5173/register with DevTools → Network open.
2. Note the new one-line notice: a forgotten password makes the vault unrecoverable.
3. Register (username, display name, password 3–10 chars).
4. Inspect `POST /api/auth/register` request body:
   - ✅ contains `authHash` (43-char base64url), `kdfSalt`, `vaultKeyWrapped` (`v1.wk.*`)
   - ❌ contains NO `password` field and the typed password appears nowhere.
5. Response contains `vaultKeyWrapped`, no key material in readable form.

## 2. Saving a chord sends only ciphertext (US1, SC-002)

1. On Home, add a chord: title `GitHub`, url `github.com/login`, a username row and a
   password row with known values (e.g. `hunter2`).
2. Inspect `POST /api/sections/:id/chords` request body:
   - ✅ `title` is plaintext `GitHub` (expected — FR-011)
   - ✅ `url` and both `value`s are `v1.l1.<iv>.<ct>` strings
   - ❌ `hunter2` / `github.com` appear NOWHERE in the payload (Ctrl+F the raw body).
3. Response chord likewise contains only `v1.l1.*` values.

## 3. Database stores a different (double-wrapped) form (US1, SC-001, SC-004)

1. In Atlas / mongosh: `db.chords.findOne({ title: 'GitHub' })`.
2. Verify: `url` and `fields[].value` are `v1.l2.k1.<iv>.<ct>` strings —
   **different from the `v1.l1.*` strings seen on the network** (two distinct layers).
3. `db.users.findOne()`: `passwordHash` is `pbkdf2$...`, plus `kdfSalt` and
   `vaultKeyWrapped` (`v1.wk.*`). No plaintext anywhere.
4. Ctrl+F the documents for `hunter2` → zero hits.

## 4. Reveal/copy round-trip is lossless (US1, FR-004)

1. On the chord card: password row is masked; click the eye → `hunter2` appears.
2. Copy without reveal → clipboard contains `hunter2`.
3. Title link opens `https://github.com/login` in a new tab.
4. Edit the chord → form is prefilled with original plaintext; save; values survive.

## 5. Login from a "new device" (US2, FR-005)

1. Logout. Open a private/incognito window (or another browser) → login.
2. Network panel during login:
   - `GET /api/auth/salt/<username>` returns `{ kdfSalt }`
   - `POST /api/auth/login` body has `authHash` only — ❌ no password.
3. Vault opens with no extra prompt; secrets reveal correctly (nothing device-local).

## 6. Logout clears unlock material (US2, FR-006)

1. While logged in: DevTools → Application → verify Local/Session Storage and IndexedDB
   contain no key material (only the HttpOnly cookie exists, and JS can't read it).
2. Logout → back on login page; navigating to Home redirects to login; no vault data
   or key material remains (memory refs zeroed — verify no crash/state leak by logging
   back in cleanly).

## 7. Refresh → locked vault → unlock (Decision 8)

1. While logged in with chords visible, press F5.
2. Expect: still authenticated (cookie), chord titles visible, values masked with an
   **Unlock** prompt (session cookie survives; the in-memory key correctly did not).
3. Enter the account password → values become revealable again. Wrong password → clear
   error, stays locked.

## 8. Tamper detection (FR-007, SC-006)

1. In mongosh, corrupt one stored value:
   `db.chords.updateOne({ title:'GitHub' }, { $set: { 'fields.1.value': 'v1.l2.k1.AAAAAAAAAAAAAAAA.dGFtcGVyZWQ' } })`
2. Reload the vault: that one row shows "This value could not be read"; eye/copy
   disabled for it; **every other field and chord renders normally**.
3. Server log for the failure contains no value content.

## 9. Server never sees plaintext even on error (FR-003, FR-009)

1. Attempt a save with DevTools request blocking / offline to force a failure → save
   aborts with an error; no partial payload with plaintext was ever constructed.
2. Send a hand-crafted plaintext value with curl/HttpClient
   (`"value": "hunter2"`) → `400 validation_error` (envelope format enforced).

## 10. Perceived performance (SC-003, Constitution IV)

- Sign-in (includes the one-time 600k-iteration KDF): noticeably < 1s extra on desktop.
- Vault load with ~20 chords: no perceptible difference vs. pre-feature.
- Save: no perceptible difference.

## 11. Gates

```powershell
npm run typecheck   # all 3 workspaces
npm run lint
npm run build --workspaces --if-present
```

All must pass. Also re-verify responsive layout is untouched at 360px / 768px / 1280px
(no layout changes shipped, so a spot-check of login + home suffices).
