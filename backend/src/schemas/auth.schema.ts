import { z } from 'zod';

/**
 * Zod schemas validating the authentication request bodies at the API boundary
 * (FR-018). Emails are normalized to lowercase so lookups and the unique index
 * are effectively case-insensitive. Passwords use a length-first policy
 * (minimum 12 characters) per research.md Decisions 1 and 7.
 */

const emailField = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .email('Enter a valid email address.')
  .toLowerCase();

/** Registration input: email, display name, and a sufficiently long password. */
export const registerSchema = z.object({
  email: emailField,
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required.')
    .max(100, 'Display name must be 100 characters or fewer.'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters.')
    .max(200, 'Password must be 200 characters or fewer.'),
});

/** Login input: email plus the password to verify (no strength check on login). */
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required.').max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
