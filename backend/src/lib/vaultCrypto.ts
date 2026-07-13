import { fromBase64Url, toBase64Url } from './encoding';

/**
 * Server-side (Level 2) vault cryptography for vii-pass
 * (specs/010-credential-encryption, research Decisions 4–5).
 *
 * The Worker wraps every Level-1 envelope (`v1.l1.*`, produced in the browser)
 * in a second AES-256-GCM layer before persisting, and unwraps it on read:
 *
 * - At rest:   `v1.l2.<keyId>.<ivB64url>.<ctB64url>`  (ct = the whole L1 string)
 * - On wire:   `v1.l1.<ivB64url>.<ctB64url>`
 *
 * The AES key is derived per user — HKDF-SHA-256(VAULT_ENC_KEY[keyId],
 * salt = userId) — so a ciphertext for one user cannot be decrypted by
 * replaying another user's path. `VAULT_ENC_KEY` is a deployment secret of the
 * form `k1:<base64url 32 bytes>[,k2:<...>]`: the FIRST entry encrypts new
 * writes, later entries remain readable so keys rotate without data loss
 * (FR-012).
 *
 * Failures NEVER throw into request handling and NEVER log value content
 * (FR-003): unwrap failures return the `L2_ERROR_SENTINEL` so a single
 * corrupted field degrades to a per-field read error client-side (FR-007).
 */

/** Sentinel serialized in place of a value whose Level-2 unwrap failed. */
export const L2_ERROR_SENTINEL = 'v1.err';

const IV_BYTES = 12;

/** One parsed entry of `VAULT_ENC_KEY`. */
interface KeyEntry {
  keyId: string;
  keyBytes: Uint8Array;
}

/**
 * Parse the `VAULT_ENC_KEY` secret (`<keyId>:<base64url32>[,<keyId>:<...>]`).
 *
 * @throws If the secret is missing or malformed — this is a deployment error
 *   and should fail loudly at first use, not silently corrupt data.
 */
function parseKeyRing(secret: string | undefined): KeyEntry[] {
  const entries = (secret ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const sep = part.indexOf(':');
      if (sep <= 0) {
        throw new Error('VAULT_ENC_KEY is malformed (expected "<keyId>:<base64url>").');
      }
      const keyId = part.slice(0, sep);
      const keyBytes = fromBase64Url(part.slice(sep + 1));
      if (!/^[a-z0-9]+$/i.test(keyId) || keyBytes.length !== 32) {
        throw new Error('VAULT_ENC_KEY entry is malformed (need alphanumeric id + 32 bytes).');
      }
      return { keyId, keyBytes };
    });
  if (entries.length === 0) {
    throw new Error('VAULT_ENC_KEY is not configured.');
  }
  return entries;
}

/** Derive the per-user AES-256-GCM key: HKDF-SHA-256(master, salt = userId). */
async function deriveUserKey(keyBytes: Uint8Array, userId: string): Promise<CryptoKey> {
  const master = await crypto.subtle.importKey('raw', keyBytes as BufferSource, 'HKDF', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(userId),
      info: new TextEncoder().encode('vii-pass/l2'),
    },
    master,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Wrap a Level-1 envelope for persistence: `v1.l1.*` → `v1.l2.<keyId>.<iv>.<ct>`.
 * Always encrypts under the FIRST (newest) key in the ring.
 *
 * @param vaultEncKey The raw `VAULT_ENC_KEY` secret from the environment.
 * @param userId The owning user's id (per-user key derivation salt).
 * @param l1Envelope The client-produced Level-1 ciphertext string.
 */
export async function wrapForStorage(
  vaultEncKey: string,
  userId: string,
  l1Envelope: string,
): Promise<string> {
  const [active] = parseKeyRing(vaultEncKey);
  const key = await deriveUserKey(active.keyBytes, userId);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(l1Envelope),
  );
  return `v1.l2.${active.keyId}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ct))}`;
}

/**
 * Unwrap a stored Level-2 envelope back to the Level-1 string for the response.
 * Tries the key named by the envelope's keyId. On ANY failure (unknown key,
 * malformed envelope, GCM auth failure = tamper/corruption) returns
 * {@link L2_ERROR_SENTINEL} and logs metadata only — never value content.
 *
 * @param vaultEncKey The raw `VAULT_ENC_KEY` secret from the environment.
 * @param userId The owning user's id.
 * @param stored The persisted `v1.l2.*` string.
 */
export async function unwrapFromStorage(
  vaultEncKey: string,
  userId: string,
  stored: string,
): Promise<string> {
  try {
    const parts = stored.split('.');
    if (parts.length !== 5 || parts[0] !== 'v1' || parts[1] !== 'l2') {
      throw new Error('malformed envelope');
    }
    const entry = parseKeyRing(vaultEncKey).find((k) => k.keyId === parts[2]);
    if (!entry) {
      throw new Error(`unknown keyId ${parts[2]}`);
    }
    const key = await deriveUserKey(entry.keyBytes, userId);
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(parts[3]) as BufferSource },
      key,
      fromBase64Url(parts[4]) as BufferSource,
    );
    return new TextDecoder().decode(pt);
  } catch (err) {
    // Metadata only — the value (even encrypted) is never logged (FR-003).
    console.warn(
      `vaultCrypto: L2 unwrap failed (${err instanceof Error ? err.message : 'unknown'})`,
    );
    return L2_ERROR_SENTINEL;
  }
}
