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

  const userId = await validateSession(c.env, token);
  if (!userId) {
    clearSessionCookie(c);
    throw new AppError(401, 'session_expired', 'Your session has expired. Please sign in again.');
  }

  const user = await findActivePublicUserById(c.env, userId);
  if (!user) {
    clearSessionCookie(c);
    throw new AppError(401, 'unauthenticated', 'You must sign in to access this resource.');
  }

  c.set('user', user);
  await next();
};
