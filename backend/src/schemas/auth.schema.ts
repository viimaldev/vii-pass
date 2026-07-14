import { z } from 'zod';
import { SECURITY_QUESTIONS } from '@vii-pass/shared';

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
 *
 * Since specs/011-dual-user-roles registration also carries the second (normal)
 * username, the security-question id, and the answer-derived recovery material
 * (`answerHash`/`recoverySalt`/`vaultKeyWrappedRecovery`) — the raw answer,
 * like the password, never reaches the server.
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

/** Client-derived 256-bit hash (auth or answer branch): base64url, 43 chars. */
const derivedHashField = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'Invalid credential payload.');

/** Client-generated 128-bit KDF salt: base64url, exactly 22 chars. */
const saltField = z.string().regex(/^[A-Za-z0-9_-]{22}$/, 'Invalid credential payload.');

/** Wrapped-vault-key envelope (`v1.wk.<iv>.<ct>`), opaque to the server. */
const wrappedKeyField = z
  .string()
  .regex(/^v1\.wk\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{1,128}$/, 'Invalid credential payload.');

/** Registration input (specs/011-dual-user-roles contracts/auth-api.md). */
export const registerSchema = z.object({
  /** Full-capability login name (FR-001). */
  adminUsername: usernameField,
  /** View-only login name (FR-001). */
  username: usernameField,
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required.')
    .max(100, 'Display name must be 100 characters or fewer.'),
  /** Client-derived authentication hash: base64url, exactly 43 chars (256 bits). */
  authHash: derivedHashField,
  /** Client-generated PBKDF2 salt: base64url, exactly 22 chars (128 bits). */
  kdfSalt: saltField,
  /** Vault key wrapped under the password-derived wrap key (`v1.wk.<iv>.<ct>`). */
  vaultKeyWrapped: wrappedKeyField,
  /** Index into the fixed shared question list (FR-013). */
  securityQuestionId: z
    .number()
    .int()
    .min(0)
    .max(SECURITY_QUESTIONS.length - 1),
  /** Client-derived hash of the NORMALIZED security answer. */
  answerHash: derivedHashField,
  /** Client-generated salt for the answer-side KDF. */
  recoverySalt: saltField,
  /** The SAME vault key wrapped under the answer-derived recovery key. */
  vaultKeyWrappedRecovery: wrappedKeyField,
});
// NOTE: the cross-field `adminUsername !== username` rule (after normalization)
// is enforced in the register route so it can carry the contract's distinct
// `usernames_identical` error code (the generic validator maps every Zod issue
// to `validation_error`).

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

/** Lenient username for the reset flow (same posture as {@link loginSchema}). */
const lenientUsernameField = z
  .string()
  .trim()
  .min(1, 'Username is required.')
  .max(200)
  .toLowerCase();

/**
 * `POST /api/auth/reset/question` input (specs/011-dual-user-roles US3). Lenient
 * like login: malformed names simply get a deterministic decoy, never a hint.
 */
export const resetQuestionSchema = z.object({
  username: lenientUsernameField,
});

/** `POST /api/auth/reset/verify` input: username + client-derived answer hash. */
export const resetVerifySchema = z.object({
  username: lenientUsernameField,
  /** Length-capped only — malformed hashes fail as a generic invalid reset. */
  answerHash: z.string().min(1, 'Answer is required.').max(200),
});

/** `POST /api/auth/reset/complete` input: one-time token + new credential material. */
export const resetCompleteSchema = z.object({
  username: lenientUsernameField,
  /** One-time token from `reset/verify`; length-capped, verified by hash. */
  resetToken: z.string().min(1, 'Reset token is required.').max(200),
  /** Auth hash derived from the NEW password. */
  newAuthHash: derivedHashField,
  /** Fresh client-generated PBKDF2 salt. */
  newKdfSalt: saltField,
  /** The unchanged vault key re-wrapped under the new password's wrap key. */
  newVaultKeyWrapped: wrappedKeyField,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetQuestionInput = z.infer<typeof resetQuestionSchema>;
export type ResetVerifyInput = z.infer<typeof resetVerifySchema>;
export type ResetCompleteInput = z.infer<typeof resetCompleteSchema>;
