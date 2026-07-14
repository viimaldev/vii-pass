import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';
import { AppError } from './error';
import {
  clearSessionCookie,
  getSessionToken,
  validateSession,
} from '../services/sessions.service';
import { findActivePublicUserById } from '../services/users.service';

/**
 * Gate protected routes behind a valid session (FR-006). Reads the opaque session
 * cookie, validates it (sliding + absolute expiry), loads the active user, and
 * attaches the {@link PublicUser} to the context as `user`. Any failure clears a
 * stale cookie and responds `401` with a generic, non-leaky message; expired
 * sessions use the `session_expired` code so the SPA can prompt a fresh sign-in
 * (FR-015).
 */
export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getSessionToken(c);
  if (!token) {
    throw new AppError(401, 'unauthenticated', 'You must sign in to access this resource.');
  }

  const identity = await validateSession(c.env, token);
  if (!identity) {
    clearSessionCookie(c);
    throw new AppError(401, 'session_expired', 'Your session has expired. Please sign in again.');
  }

  const user = await findActivePublicUserById(c.env, identity.userId, identity.role);
  if (!user) {
    clearSessionCookie(c);
    throw new AppError(401, 'unauthenticated', 'You must sign in to access this resource.');
  }

  c.set('user', user);
  await next();
};

/**
 * Gate MUTATING vault routes behind an admin-role session
 * (specs/011-dual-user-roles FR-007). MUST run after {@link requireSession}.
 * Normal-role sessions receive `403 role_forbidden` — authentication is fine,
 * the capability level is not. Read (GET) routes stay role-agnostic.
 */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    throw new AppError(
      403,
      'role_forbidden',
      "Your sign-in doesn't allow changes. Sign in with the admin username to make changes.",
    );
  }
  await next();
};
