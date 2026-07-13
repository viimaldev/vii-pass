# Contract: Chords API changes

**Feature**: specs/010-credential-encryption | Base paths: `/api/sections`, `/api/chords`

**Routes, verbs, auth, ordering, and title-uniqueness behavior are all unchanged** from
feature 009. Only the *content* of `url` and `fields[].value` changes: plaintext →
Level-1 ciphertext envelopes. Reorder endpoints are untouched (they carry only ids).

---

## Payload shape (create + update — same shape, as before)

`POST /api/sections/:sectionId/chords` / `PATCH /api/chords/:chordId`

**Request**:

```json
{
  "title": "GitHub",
  "url": "v1.l1.9mJ4kQ2xL8aP0wZv.Rk9tX...",
  "fields": [
    { "type": "username",  "value": "v1.l1.aB3dE5fG7hJ9kL1m.Qw8eR..." },
    { "type": "password",  "value": "v1.l1.zY2xW4vU6tS8rQ0p.Mn7bV..." },
    { "type": "other",     "value": null }
  ]
}
```

- `title`: unchanged — plaintext, trimmed, 1–100 chars, unique per section
  (case-insensitive). `409 chord_title_taken` behavior identical.
- `url`: `null` **or** an L1 envelope matching
  `^v1\.l1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$` (≤ 4096 chars).
  The server **no longer parses/normalizes URLs** — it cannot see them. The
  scheme allow-list (`http:`/`https:` only, `https://` prepend) is enforced
  client-side before encryption AND re-checked at decrypt-render time before the value
  is ever used as an `href`.
- `fields`: exactly 3 rows; `type` unchanged (plaintext enum, drives icons/masking);
  `value` is `null` (unused row) or an L1 envelope (≤ 1024 chars). Plaintext length
  limit (≤ 200 chars) is enforced client-side before encryption.
- Any `url`/`value` that is neither `null` nor a well-formed L1 envelope →
  `400 validation_error`. **Plaintext-looking values are rejected**, making
  "accidentally send plaintext" a hard failure (FR-009 backstop).

**Response** (`201` create / `200` update): `{ "chord": { ... } }` with `url` and
`fields[].value` as **L1 envelopes** (server unwraps Level 2 before responding).

## List — GET `/api/sections/:sectionId/chords`

**Response `200`**: `{ "chords": [ ... ] }` — same shape; `url` + `fields[].value` are
L1 envelopes or null.

## Reorder — POST `.../reorder` (both scopes)

Unchanged in every respect (ids only).

---

## Server-side processing contract (Level 2)

| Step | Behavior |
|------|----------|
| On write | Each non-null L1 envelope is wrapped: AES-256-GCM under HKDF(`VAULT_ENC_KEY[k1]`, salt = userId) → stored as `v1.l2.k1.<iv>.<ct>` |
| On read | Each L2 envelope is unwrapped back to the L1 string before serialization |
| Unwrap failure (tamper/corruption/wrong key) | The field serializes as the sentinel `"v1.err"`; the rest of the chord and list are unaffected. Client renders the per-field read error (FR-007). The failure is logged **without any value content** (FR-003) |
| Key rotation | New writes use the highest key-id in `VAULT_ENC_KEY`; reads try the key-id named in the envelope. Rotation = add `k2`, keep `k1` until re-saves cycle values forward (FR-012) |
| Logging | Envelopes and plaintext MUST NOT appear in logs or error messages; log metadata only (chordId, field index, error class) |

---

## Client-side processing contract (Level 1)

| Step | Behavior |
|------|----------|
| On save | Every non-empty value/url: trim → length/scheme validation (plaintext rules from feature 009) → AES-256-GCM under VK → L1 envelope. Encryption failure aborts the save with an error; nothing is transmitted (FR-009) |
| On fetch | Every envelope decrypts under VK at the `VaultContext` boundary; components receive plaintext as today (FR-004, FR-008) |
| Decrypt failure or `"v1.err"` sentinel | Field shows "This value could not be read"; copy/reveal disabled for that field only (FR-007) |
| URL at render | Decrypted URL must still pass the `http(s)`-only allow-list before being used as an `href`; otherwise treated as a read error (stored-XSS boundary follows the plaintext) |
| Locked vault (e.g. after refresh) | Chords may be listed (titles are plaintext) but values show masked placeholders with an unlock prompt; no decrypt is attempted until VK is present |
