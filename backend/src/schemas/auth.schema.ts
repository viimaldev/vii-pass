import { z } from 'zod';

/**
 * Zod schemas validating the authentication request bodies at the API boundary
 * (FR-009). The username is the login identifier: ASCII alphanumeric only, 3–30
 * characters, normalized to lowercase so lookups and the unique index are
 * effectively case-insensitive (FR-003, FR-004, FR-006). The registration
 * password policy is 3–10 characters — a deliberate, documented relaxation from
 * the prior 12-character minimum (see research.md Decision 3).
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

/** Registration input: username, display name, and a 3–10 character password. */
export const registerSchema = z.object({
  username: usernameField,
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required.')
    .max(100, 'Display name must be 100 characters or fewer.'),
  password: z
    .string()
    .min(3, 'Password must be at least 3 characters.')
    .max(10, 'Password must be 10 characters or fewer.'),
});

/**
 * Login input: username plus the password to verify. The username is trimmed and
 * lowercased to match storage, but is NOT format-checked — a malformed value
 * simply fails as invalid credentials, avoiding enumeration/policy leakage (FR-012).
 */
export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required.').toLowerCase(),
  password: z.string().min(1, 'Password is required.').max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
