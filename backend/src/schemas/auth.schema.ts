import { z } from 'zod';

/**
 * Zod schemas validating the authentication request bodies at the API boundary
 * (FR-009). The username is the login identifier: ASCII alphanumeric only, 3–30
 * characters, normalized to lowercase so lookups and the unique index are
 * effectively case-insensitive (FR-003, FR-004, FR-006).
 *
 * Since specs/010-credential-encryption the raw password NEVER reaches the
 * server: clients send `authHash` — the HKDF auth branch of a PBKDF2 master key
 * derived in the browser — plus, at registration, the client-generated
 * `kdfSalt` and the vault key wrapped under the password-derived wrap key. The
 * 3–10 character password policy is therefore enforced client-side only.
 */

/**
 * Registration username rule: trimmed, 3–30 chars, ASCII alphanumeric only, then
 * lowercased for storage and case-insensitive uniqueness.
 */
const usernameField = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters.')
  .max(30, 'Username must be 30 characters or fewer.')
  .regex(/^[A-Za-z0-9]+$/, 'Username must use letters and numbers only.')
  .toLowerCase();

/** Registration input (specs/010-credential-encryption contracts/auth-api.md). */
export const registerSchema = z.object({
  username: usernameField,
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required.')
    .max(100, 'Display name must be 100 characters or fewer.'),
  /** Client-derived authentication hash: base64url, exactly 43 chars (256 bits). */
  authHash: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Invalid credential payload.'),
  /** Client-generated PBKDF2 salt: base64url, exactly 22 chars (128 bits). */
  kdfSalt: z.string().regex(/^[A-Za-z0-9_-]{22}$/, 'Invalid credential payload.'),
  /** Vault key wrapped under the password-derived wrap key (`v1.wk.<iv>.<ct>`). */
  vaultKeyWrapped: z
    .string()
    .regex(/^v1\.wk\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{1,128}$/, 'Invalid credential payload.'),
});

/**
 * Login input: username plus the client-derived auth hash. The username is
 * trimmed and lowercased to match storage but NOT format-checked, and the hash
 * is only length-capped — malformed values simply fail as invalid credentials,
 * avoiding enumeration/policy leakage (FR-012).
 */
export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required.').toLowerCase(),
  authHash: z.string().min(1, 'Password is required.').max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
