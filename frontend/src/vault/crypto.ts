/**
 * Client-side (Level 1) vault cryptography for vii-pass
 * (specs/010-credential-encryption, research Decisions 1–4).
 *
 * Everything here uses the browser's native Web Crypto API — no dependencies.
 *
 * Key hierarchy (data-model.md):
 *
 * ```text
 * password ──PBKDF2-HMAC-SHA-256 (600k, kdfSalt)──► masterKey (256 bits)
 *    ├─ HKDF info="vii-pass/auth" ► authKey → base64url = authHash (sent to server)
 *    └─ HKDF info="vii-pass/wrap" ► wrapKey (never leaves the device)
 *                                      │ AES-256-GCM
 *                                      ▼
 *                       vaultKey (256 random bits, memory only)
 *                                      │ AES-256-GCM per value
 *                                      ▼
 *                       L1 envelopes `v1.l1.<iv>.<ct>`
 * ```
 *
 * The raw password and every derived key stay in this module's callers' memory
 * only — nothing is ever written to storage, and only `authHash` (useless for
 * decryption, by HKDF domain separation) is transmitted.
 *
 * FR-010 note: chord values are encrypted ONLY under the random vault key,
 * never under the password-derived keys. A future password change therefore
 * re-derives masterKey/wrapKey and re-wraps the SAME vault key — no vault data
 * is ever re-encrypted.
 */

/** PBKDF2 iteration count for the client-side stretch (OWASP 2023; research D7). */
const KDF_ITERATIONS = 600_000;
/** AES-GCM IV length in bytes (NIST-recommended 96 bits). */
const IV_BYTES = 12;
/** KDF salt length in bytes (128 bits → 22 base64url chars). */
const SALT_BYTES = 16;

/** The two keys derived from the password that callers hold in memory. */
export interface DerivedKeys {
  /** Base64url authentication hash sent to the server in place of the password. */
  authHash: string;
  /** AES-256-GCM key that wraps/unwraps the vault key. Never serialized. */
  wrapKey: CryptoKey;
}

/** Encode bytes as URL-safe base64 without padding. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode a URL-safe base64 string (with or without padding) into bytes. */
function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Generate a fresh random KDF salt (base64url, 22 chars) for registration. */
export function generateKdfSalt(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
}

/** Generate a fresh random 256-bit vault key (extractable so it can be wrapped). */
export async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Derive the auth/wrap key pair from the login password and the user's KDF salt.
 * This is the expensive step (~200–400ms) — call it once per sign-in/unlock.
 *
 * @param password The raw login password (never transmitted).
 * @param kdfSaltB64 The user's KDF salt (base64url, from registration or the salt endpoint).
 */
export async function deriveKeys(password: string, kdfSaltB64: string): Promise<DerivedKeys> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const masterBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: fromBase64Url(kdfSaltB64) as BufferSource,
      iterations: KDF_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    256,
  );
  const masterKey = await crypto.subtle.importKey('raw', masterBits, 'HKDF', false, [
    'deriveBits',
    'deriveKey',
  ]);

  // Domain-separated split: the auth branch is sent to the server; the wrap
  // branch never leaves the device. Neither can be computed from the other.
  const authBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode('vii-pass/auth'),
    },
    masterKey,
    256,
  );
  const wrapKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode('vii-pass/wrap'),
    },
    masterKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  return { authHash: toBase64Url(new Uint8Array(authBits)), wrapKey };
}

/** Wrap (encrypt) the vault key under the wrap key → `v1.wk.<iv>.<ct>`. */
export async function wrapVaultKey(vaultKey: CryptoKey, wrapKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', vaultKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, wrapKey, raw);
  return `v1.wk.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ct))}`;
}

/**
 * Unwrap (decrypt) a `v1.wk.*` envelope back into the vault key.
 *
 * @throws If the envelope is malformed or the wrap key is wrong (e.g. wrong
 *   password) — callers surface this as an unlock failure.
 */
export async function unwrapVaultKey(envelope: string, wrapKey: CryptoKey): Promise<CryptoKey> {
  const parts = envelope.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1' || parts[1] !== 'wk') {
    throw new Error('Malformed vault key envelope.');
  }
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(parts[2]) as BufferSource },
    wrapKey,
    fromBase64Url(parts[3]) as BufferSource,
  );
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Encrypt one plaintext value under the vault key → Level-1 envelope
 * `v1.l1.<iv>.<ct>` (fresh random IV per value; GCM provides integrity).
 */
export async function encryptValue(plaintext: string, vaultKey: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    vaultKey,
    new TextEncoder().encode(plaintext),
  );
  return `v1.l1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ct))}`;
}

/**
 * Decrypt a Level-1 envelope back to plaintext.
 *
 * @throws If the envelope is malformed, tampered with, or encrypted under a
 *   different key — callers map this to the per-field read error (FR-007).
 */
export async function decryptValue(envelope: string, vaultKey: CryptoKey): Promise<string> {
  const parts = envelope.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1' || parts[1] !== 'l1') {
    throw new Error('Malformed encrypted value.');
  }
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(parts[2]) as BufferSource },
    vaultKey,
    fromBase64Url(parts[3]) as BufferSource,
  );
  return new TextDecoder().decode(pt);
}
