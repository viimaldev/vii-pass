# Data Model: Two-Level Credential Encryption

**Feature**: specs/010-credential-encryption | **Date**: 2026-07-13

## Envelope formats (string encodings)

| Name | Format | Where it exists |
|------|--------|-----------------|
| **L1 envelope** | `v1.l1.<ivB64url>.<ctB64url>` | Network payloads (both directions); embedded inside L2 at rest |
| **L2 envelope** | `v1.l2.<keyId>.<ivB64url>.<ctB64url>` | Database only (`chords` collection) |
| **Wrapped vault key** | `v1.wk.<ivB64url>.<ctB64url>` | Database (`users`) + auth responses |
| **Server key env value** | `k1:<base64url 32 bytes>` | `VAULT_ENC_KEY` Worker secret / `.dev.vars` |

- IV = 12 random bytes per encryption, never reused.
- `ct` includes the GCM auth tag (Web Crypto appends it) → integrity built in (FR-007).
- L1 validation regex (API boundary): `^v1\.l1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$`.
- Size budget: a 200-char value → L1 ≈ 320 chars → L2 ≈ 470 chars. Well under limits.

## Key hierarchy (client-side derivation)

```text
password (3–10 chars, never leaves browser)
   │  PBKDF2-HMAC-SHA-256, 600k iterations, salt = user.kdfSalt (16 random bytes)
   ▼
masterKey (256 bits, memory only)
   ├─ HKDF-SHA-256, info="vii-pass/auth" → authKey  → base64url = authHash (sent to server)
   └─ HKDF-SHA-256, info="vii-pass/wrap" → wrapKey  (memory only)
                                              │ AES-GCM unwrap
                                              ▼
                                  vaultKey VK (256 random bits, memory only)
                                              │ AES-GCM per value
                                              ▼
                                  L1 envelopes (fields[].value, url)
```

Server side: `VAULT_ENC_KEY` (k1) → HKDF-SHA-256(salt = userId) → per-user L2 AES key.

## MongoDB: `users` collection (changed)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | unchanged |
| `username` | string | unchanged (lowercased, unique) |
| `displayName` | string | unchanged |
| `passwordHash` | string | **same format** (`pbkdf2$sha256$...`), but its input is now the client `authHash`, not the raw password |
| `kdfSalt` | string | NEW — base64url, 16 bytes, generated client-side at registration, immutable |
| `vaultKeyWrapped` | string | NEW — `v1.wk.*` envelope; replaced only on (future) password change |
| `createdAt` / status fields | — | unchanged |

State transition (future password change, FR-010): re-derive MK′ from new password →
re-wrap the *same* VK → replace `passwordHash` + `kdfSalt` + `vaultKeyWrapped`
atomically in one `updateOne`. Vault data untouched. (Not shipped now; the model makes
it possible.)

## MongoDB: `chords` collection (changed fields only)

| Field | Type | Notes |
|-------|------|-------|
| `title` / `titleNormalized` | string | unchanged — plaintext (FR-011) |
| `url` | string \| null | now an **L2 envelope** (or null) |
| `fields[].type` | enum | unchanged — plaintext |
| `fields[].value` | string \| null | now an **L2 envelope** (or null when row unused) |
| everything else | — | unchanged (userId, sectionId, position, indexes) |

Indexes unchanged. No index ever touches an encrypted field.

## Shared types (`shared/types/index.ts`)

```ts
/** A Level-1 encrypted value as it travels over the network: `v1.l1.<iv>.<ct>`. */
export type EncryptedValue = string; // branded by format, validated at boundaries

export interface ChordField {
  type: ChordFieldType;              // unchanged
  value: EncryptedValue | null;      // was: plaintext string | null
}

export interface Chord {
  // id, sectionId, position, title unchanged
  url: EncryptedValue | null;        // was: normalized plaintext URL | null
  fields: ChordField[];
}

export interface RegisterRequest {
  username: string;
  displayName: string;
  authHash: string;                  // was: password
  kdfSalt: string;                   // NEW (base64url, 16 bytes)
  vaultKeyWrapped: string;           // NEW (`v1.wk.*`)
}

export interface LoginRequest {
  username: string;
  authHash: string;                  // was: password
}

export interface SaltResponse {
  kdfSalt: string;                   // real or deterministic decoy (no enumeration)
}

export interface AuthResponse {
  user: PublicUser;
  vaultKeyWrapped: string | null;    // NEW — present on register/login/me
}
```

Frontend-only (never serialized): `VaultKeys { vaultKey: CryptoKey }` held in a ref in
`AuthContext`; cleared on logout/401.

## Validation rules (API boundary, Zod)

| Field | Rule |
|-------|------|
| `authHash` | base64url string, exactly 43 chars (256 bits) |
| `kdfSalt` | base64url string, exactly 22 chars (128 bits) |
| `vaultKeyWrapped` | matches `^v1\.wk\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{1,128}$` |
| `fields[].value` | null, or matches L1 regex, max 1024 chars (plaintext ≤200 enforced client-side pre-encryption) |
| `url` | null, or matches L1 regex, max 4096 chars (plaintext ≤2048 + `http(s)` allow-list enforced client-side; re-checked at decrypt-render) |
| `title` | unchanged (trim, 1–100, uniqueness via `titleNormalized`) |

## Value lifecycle

```text
SAVE:   plaintext ──(browser: AES-GCM under VK)──▶ L1 ──HTTP──▶ server
        server ──(AES-GCM under HKDF(k1,userId))──▶ L2 ──▶ MongoDB
READ:   MongoDB ──▶ L2 ──(server unwrap)──▶ L1 ──HTTP──▶ browser
        browser ──(AES-GCM under VK)──▶ plaintext (memory/DOM only)
ERROR:  any GCM failure at either layer → per-field error sentinel,
        rendered as "This value could not be read" (FR-007); never partial output.
```
