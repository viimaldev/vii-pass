import { Hono } from 'hono';
import type {
  AuthResponse,
  ResetQuestionResponse,
  ResetVerifyResponse,
  SaltResponse,
} from '@vii-pass/shared';
import type { AppEnv } from '../env';
import { AppError } from '../middleware/error';
import { requireSession } from '../middleware/requireSession';
import { parseJsonBody } from '../middleware/validate';
import {
  loginSchema,
  registerSchema,
  resetCompleteSchema,
  resetQuestionSchema,
  resetVerifySchema,
} from '../schemas/auth.schema';
import {
  completeReset,
  createUser,
  getResetQuestion,
  getSaltForUsername,
  getVaultKeyWrappedById,
  verifyCredentials,
  verifyResetAnswer,
} from '../services/users.service';
import {
  clearSessionCookie,
  createSession,
  getSessionToken,
  revokeAllSessionsForUser,
  revokeSession,
  setSessionCookie,
} from '../services/sessions.service';

/**
 * Authentication router (`/api/auth`). Registration and login are public; `me`
 * and `logout` require a valid session. The logout route is registered by the
 * user-menu task (US4).
 */
export const authRouter = new Hono<AppEnv>();

/**
 * `GET /api/auth/salt/:username` — public. Returns the KDF salt the client
 * needs to derive its keys before login (specs/010-credential-encryption).
 * Unknown usernames get a deterministic decoy of identical shape, so the
 * endpoint cannot be used to enumerate accounts.
 */
authRouter.get('/salt/:username', async (c) => {
  const username = c.req.param('username').trim().toLowerCase();
  const kdfSalt = await getSaltForUsername(c.env, username);
  return c.json({ kdfSalt } satisfies SaltResponse);
});

/**
 * `POST /api/auth/register` — create an ACCOUNT with two login identities (one
 * admin, one normal; specs/011-dual-user-roles US1) and sign the caller in as
 * ADMIN. The payload carries the client-derived `authHash`/`answerHash` (never
 * the password or answer) plus the salts and both wrapped-vault-key envelopes.
 * Identical usernames are rejected with the contract's distinct 400 code;
 * duplicates (either name, any account, either role) surface as a generic `409`
 * from the users service (FR-003).
 */
authRouter.post('/register', async (c) => {
  const input = await parseJsonBody(c, registerSchema);
  if (input.adminUsername === input.username) {
    throw new AppError(
      400,
      'usernames_identical',
      'Admin username and username must be different.',
    );
  }
  const user = await createUser(c.env, input);
  const token = await createSession(c.env, user.id, 'admin');
  setSessionCookie(c, token);
  return c.json(
    { user, vaultKeyWrapped: input.vaultKeyWrapped } satisfies AuthResponse,
    201,
  );
});

/**
 * `POST /api/auth/login` — verify the client-derived auth hash and establish a
 * session (US2). Either of the account's two usernames is accepted against the
 * shared credential; the session is created with the MATCHED login's role,
 * fixed for its lifetime (specs/011-dual-user-roles FR-004/FR-006). The
 * response includes the wrapped vault key so the client can unlock the vault.
 * Invalid credentials return a single generic `401` (no enumeration, FR-012);
 * disabled accounts return `403`; throttled/locked accounts return `429`.
 */
authRouter.post('/login', async (c) => {
  const { username, authHash } = await parseJsonBody(c, loginSchema);
  const result = await verifyCredentials(c.env, username, authHash);

  if (!result.ok) {
    if (result.reason === 'disabled') {
      throw new AppError(403, 'account_disabled', 'This account is not permitted to sign in.');
    }
    if (result.reason === 'locked') {
      throw new AppError(
        429,
        'too_many_attempts',
        'Too many failed attempts. Please try again later.',
      );
    }
    throw new AppError(401, 'invalid_credentials', 'Incorrect username or password.');
  }

  const token = await createSession(c.env, result.user.id, result.user.role);
  setSessionCookie(c, token);
  return c.json(
    { user: result.user, vaultKeyWrapped: result.vaultKeyWrapped } satisfies AuthResponse,
    200,
  );
});

/**
 * `GET /api/auth/me` — return the currently authenticated user plus their
 * wrapped vault key (locked-vault re-unlock after a refresh). Used by the SPA
 * to bootstrap auth state on load and after a reload (FR-007).
 */
authRouter.get('/me', requireSession, async (c) => {
  const user = c.get('user');
  const vaultKeyWrapped = await getVaultKeyWrappedById(c.env, user.id);
  return c.json({ user, vaultKeyWrapped } satisfies AuthResponse);
});

/**
 * `POST /api/auth/logout` — revoke the current session and clear the cookie (US4).
 * Idempotent from the client's perspective: it always ends with no active session.
 */
authRouter.post('/logout', requireSession, async (c) => {
  const token = getSessionToken(c);
  if (token) {
    await revokeSession(c.env, token);
  }
  clearSessionCookie(c);
  return c.body(null, 204);
});

/**
 * `POST /api/auth/reset/question` — public, step 1 of the password reset
 * (specs/011-dual-user-roles US3). Admin usernames get their real question +
 * recovery salt; unknown/non-admin/disabled names get `404 unknown_username`
 * (post-launch user decision — supersedes the always-200 decoy of FR-010).
 */
authRouter.post('/reset/question', async (c) => {
  const { username } = await parseJsonBody(c, resetQuestionSchema);
  const result = await getResetQuestion(c.env, username);
  return c.json(result satisfies ResetQuestionResponse);
});

/**
 * `POST /api/auth/reset/verify` — public, step 2: prove the security answer.
 * Throttled per TYPED name (5 fails → 15-min lock → `429`, unknown names
 * included); every failure cause is the same generic `401 invalid_reset`. On
 * success returns the one-time reset token and the recovery-wrapped vault key.
 */
authRouter.post('/reset/verify', async (c) => {
  const { username, answerHash } = await parseJsonBody(c, resetVerifySchema);
  const result = await verifyResetAnswer(c.env, username, answerHash);
  return c.json(result satisfies ResetVerifyResponse);
});

/**
 * `POST /api/auth/reset/complete` — public (token-authenticated), step 3:
 * atomically replace the credential epoch, then revoke EVERY session of the
 * account (FR-012). No cookie is set — the user signs in with the new
 * password. The vault key inside the new wrapper is unchanged (FR-011).
 */
authRouter.post('/reset/complete', async (c) => {
  const input = await parseJsonBody(c, resetCompleteSchema);
  const userId = await completeReset(
    c.env,
    input.username,
    input.resetToken,
    input.newAuthHash,
    input.newKdfSalt,
    input.newVaultKeyWrapped,
  );
  await revokeAllSessionsForUser(c.env, userId);
  return c.body(null, 204);
});
