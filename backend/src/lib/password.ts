import { fromBase64Url, toBase64Url } from './encoding';

/**
 * Password hashing for vii-pass using PBKDF2-HMAC-SHA-256 via the Workers-native
 * Web Crypto API (research.md Decision 1). No external dependency is required, and
 * the encoded output records the algorithm, work factor, and salt so the factor
 * can be raised over time without invalidating existing hashes.
 *
 * Encoded format: `pbkdf2$sha256$<iterations>$<saltB64url>$<hashB64url>`.
 * Plaintext passwords are never stored, logged, or compared directly (FR-002).
 */

const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 16;

/** Derive raw key bytes from a password + salt using PBKDF2-HMAC-SHA-256. */
async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH_BITS,
  );
  return new Uint8Array(derived);
}

/** Constant-time comparison of two byte arrays to avoid timing side channels. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Hash a plaintext password into the encoded storage string.
 *
 * @param password Plaintext password supplied by the user.
 * @param iterations PBKDF2 work factor (from `PBKDF2_ITERATIONS`).
 * @returns The self-describing encoded hash safe to persist.
 */
export async function hashPassword(password: string, iterations: number): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveKey(password, salt, iterations);
  return `pbkdf2$sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

/**
 * Verify a plaintext password against a previously stored encoded hash.
 * Returns `false` for malformed stored values rather than throwing.
 *
 * @param password Plaintext password to check.
 * @param stored Encoded hash produced by {@link hashPassword}.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') {
    return false;
  }
  const iterations = Number.parseInt(parts[2], 10);
  if (!Number.isInteger(iterations) || iterations <= 0) {
    return false;
  }
  const salt = fromBase64Url(parts[3]);
  const expected = fromBase64Url(parts[4]);
  const actual = await deriveKey(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}
