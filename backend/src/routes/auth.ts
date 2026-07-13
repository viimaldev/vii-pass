import { Hono } from 'hono';
import type { AuthResponse, SaltResponse } from '@vii-pass/shared';
import type { AppEnv } from '../env';
import { AppError } from '../middleware/error';
import { requireSession } from '../middleware/requireSession';
import { parseJsonBody } from '../middleware/validate';
import { loginSchema, registerSchema } from '../schemas/auth.schema';
import {
  createUser,
  getSaltForUsername,
  getVaultKeyWrappedById,
  verifyCredentials,
} from '../services/users.service';
import {
  clearSessionCookie,
  createSession,
  getSessionToken,
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
 * `POST /api/auth/register` — create an account and sign the new user in (US1).
 * The payload carries the client-derived `authHash` (never the password) plus
 * `kdfSalt` and the wrapped vault key. Duplicate usernames surface as a `409`
 * from the users service (FR-005); the new user is returned already
 * authenticated with a session cookie set (FR-020).
 */
authRouter.post('/register', async (c) => {
  const input = await parseJsonBody(c, registerSchema);
  const user = await createUser(c.env, input);
  const token = await createSession(c.env, user.id);
  setSessionCookie(c, token);
  return c.json(
    { user, vaultKeyWrapped: input.vaultKeyWrapped } satisfies AuthResponse,
    201,
  );
});

/**
 * `POST /api/auth/login` — verify the client-derived auth hash and establish a
 * session (US2). The response includes the wrapped vault key so the client can
 * unlock the vault. Invalid credentials return a single generic `401` (no
 * enumeration, FR-012); disabled accounts return `403`; throttled/locked
 * accounts return `429`.
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

  const token = await createSession(c.env, result.user.id);
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
