import { ObjectId, type Collection } from 'mongodb';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { UserRole } from '@vii-pass/shared';
import { parsePositiveInt, type AppEnv, type Bindings } from '../env';
import { getDb } from '../lib/mongo';
import { generateSessionToken, hashToken } from '../lib/tokens';

/**
 * Server-side session service (research.md Decisions 2 & 5). Sessions are opaque:
 * the raw token lives only in the client's HttpOnly cookie, and only its SHA-256
 * hash is stored, so a database leak cannot yield usable tokens. Validity is the
 * conjunction of a sliding inactivity window and an absolute lifetime.
 */

/** Name of the session cookie carrying the opaque token. */
export const SESSION_COOKIE = 'session';

/** Fallbacks used when the corresponding env values are missing/invalid. */
const DEFAULT_IDLE_TTL_SECONDS = 1800;
const DEFAULT_ABSOLUTE_TTL_SECONDS = 86400;

/** Internal session document stored in the `sessions` collection. */
export interface SessionDoc {
  /** SHA-256 (hex) of the raw session token; the lookup key. */
  tokenHash: string;
  /** Owning user's `_id`. */
  userId: ObjectId;
  /**
   * Capability level of the username used at sign-in, FIXED for the session's
   * lifetime (specs/011-dual-user-roles FR-006): switching roles requires a
   * fresh sign-in with the other username.
   */
  role: UserRole;
  /** ISO-8601 session start (basis for the absolute lifetime). */
  createdAt: string;
  /** ISO-8601 last activity (basis for the sliding inactivity timeout). */
  lastActivityAt: string;
  /** Absolute expiry; backs the TTL index that auto-purges the document. */
  expiresAt: Date;
}

const COLLECTION = 'sessions';
let indexesEnsured: Promise<void> | undefined;

/** Resolve the typed `sessions` collection, ensuring indexes once per isolate. */
async function getSessions(env: Bindings): Promise<Collection<SessionDoc>> {
  const db = await getDb(env);
  const collection = db.collection<SessionDoc>(COLLECTION);
  if (!indexesEnsured) {
    indexesEnsured = Promise.all([
      collection.createIndex({ tokenHash: 1 }, { unique: true }),
      collection.createIndex({ userId: 1 }),
      collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).then(() => undefined);
  }
  await indexesEnsured;
  return collection;
}

/**
 * Create a new session for `userId` with the capability level of the username
 * used at sign-in, and return the raw token to place in the cookie. Only the
 * token's hash is persisted.
 */
export async function createSession(
  env: Bindings,
  userId: string,
  role: UserRole,
): Promise<string> {
  const sessions = await getSessions(env);
  const token = generateSessionToken();
  const tokenHash = await hashToken(token);
  const now = Date.now();
  const absoluteTtl = parsePositiveInt(env.SESSION_ABSOLUTE_TTL_SECONDS, DEFAULT_ABSOLUTE_TTL_SECONDS);
  await sessions.insertOne({
    tokenHash,
    userId: new ObjectId(userId),
    role,
    createdAt: new Date(now).toISOString(),
    lastActivityAt: new Date(now).toISOString(),
    expiresAt: new Date(now + absoluteTtl * 1000),
  });
  return token;
}

/** Identity carried by a valid session: the account id + the fixed role. */
export interface SessionIdentity {
  userId: string;
  role: UserRole;
}

/**
 * Validate a raw session token. Returns the owning user id and the session's
 * fixed role when the session is within both the sliding inactivity window and
 * the absolute lifetime, advancing `lastActivityAt`. Returns `null` (and
 * proactively deletes the row) otherwise.
 */
export async function validateSession(
  env: Bindings,
  token: string,
): Promise<SessionIdentity | null> {
  const sessions = await getSessions(env);
  const tokenHash = await hashToken(token);
  const doc = await sessions.findOne({ tokenHash });
  if (!doc) {
    return null;
  }

  const now = Date.now();
  const idleTtlMs = parsePositiveInt(env.SESSION_IDLE_TTL_SECONDS, DEFAULT_IDLE_TTL_SECONDS) * 1000;
  const idleDeadline = new Date(doc.lastActivityAt).getTime() + idleTtlMs;
  const absoluteDeadline = doc.expiresAt.getTime();
  if (now >= absoluteDeadline || now >= idleDeadline) {
    await sessions.deleteOne({ _id: doc._id });
    return null;
  }

  await sessions.updateOne(
    { _id: doc._id },
    { $set: { lastActivityAt: new Date(now).toISOString() } },
  );
  return { userId: doc.userId.toHexString(), role: doc.role };
}

/** Revoke a session by its raw token (logout). Idempotent. */
export async function revokeSession(env: Bindings, token: string): Promise<void> {
  const sessions = await getSessions(env);
  const tokenHash = await hashToken(token);
  await sessions.deleteOne({ tokenHash });
}

/**
 * Revoke EVERY session belonging to `userId` — both usernames/roles, all
 * devices. Called after a completed password reset (FR-012) so any session
 * opened with the old credential is dead immediately. Idempotent.
 */
export async function revokeAllSessionsForUser(env: Bindings, userId: string): Promise<void> {
  if (!ObjectId.isValid(userId)) {
    return;
  }
  const sessions = await getSessions(env);
  await sessions.deleteMany({ userId: new ObjectId(userId) });
}

/** Read the raw session token from the request cookie, if present. */
export function getSessionToken(c: Context<AppEnv>): string | undefined {
  return getCookie(c, SESSION_COOKIE);
}

/**
 * Set the session cookie: HttpOnly + Secure + SameSite=Lax (FR-013). `Max-Age`
 * is deliberately OMITTED (specs/019-mobile-scroll-tab-session FR-004): a
 * browser-session cookie dies when the browser fully closes, which is one of
 * the tab-scoped session's end-of-life triggers. Server-side validity is still
 * bounded by the sliding idle window and the absolute `expiresAt` enforced in
 * {@link validateSession} — the cookie's persistence never extends a session.
 * `Domain` is applied only when configured for cross-subdomain deployments.
 */
export function setSessionCookie(c: Context<AppEnv>, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    domain: c.env.COOKIE_DOMAIN || undefined,
  });
}

/** Clear the session cookie (logout / invalid session). */
export function clearSessionCookie(c: Context<AppEnv>): void {
  deleteCookie(c, SESSION_COOKIE, {
    path: '/',
    domain: c.env.COOKIE_DOMAIN || undefined,
  });
}
