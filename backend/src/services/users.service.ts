import { ObjectId, type Collection, type WithId } from 'mongodb';
import type { PublicUser } from '@vii-pass/shared';
import { parsePositiveInt, type Bindings } from '../env';
import { toBase64Url } from '../lib/encoding';
import { getDb } from '../lib/mongo';
import { hashPassword, verifyPassword } from '../lib/password';
import { AppError } from '../middleware/error';

/**
 * User accounts service backed by the `users` collection of the `vii_pass`
 * database (FR-011). Only the {@link PublicUser} projection is ever exposed to
 * callers.
 *
 * Since specs/010-credential-encryption the server never sees the raw password:
 * clients send a derived `authHash`, which is hashed AGAIN through the existing
 * PBKDF2 storage scheme before persisting — so a database dump is not
 * login-replayable, and the stored verifier is useless for vault decryption.
 */

/** Account status. Only `active` accounts may authenticate. */
export type UserStatus = 'active' | 'disabled';

/** Internal user document stored in the `users` collection. */
export interface UserDoc {
  /** Unique, lowercased login identifier (ASCII alphanumeric, 3–30 chars). */
  username: string;
  /** Name shown in the welcome message and user menu. */
  displayName: string;
  /** Encoded PBKDF2 hash of the client-derived `authHash` (never returned to clients). */
  passwordHash: string;
  /**
   * Client-generated PBKDF2 salt (base64url, 128 bits) for the browser-side key
   * derivation. Served publicly via the salt endpoint.
   *
   * FR-010 (password-change contract): a future password change re-derives the
   * client keys and replaces `passwordHash` + `kdfSalt` + `vaultKeyWrapped`
   * together in ONE atomic `updateOne` — the vault key inside the wrapper is
   * unchanged, so no chord data is ever re-encrypted.
   */
  kdfSalt: string;
  /**
   * The user's vault key wrapped under their password-derived wrap key
   * (`v1.wk.<iv>.<ct>`). Opaque to the server — it cannot be unwrapped without
   * the user's password (zero-knowledge; SC-005). See the FR-010 note on
   * {@link UserDoc.kdfSalt}.
   */
  vaultKeyWrapped: string;
  /** Whether the account may authenticate. */
  status: UserStatus;
  /** Consecutive failed logins since the last success or lockout. */
  failedLoginCount: number;
  /** ISO-8601 time until which login is refused, or `null`. */
  lockedUntil: string | null;
  /** ISO-8601 creation timestamp (immutable). */
  createdAt: string;
  /** ISO-8601 last-update timestamp. */
  updatedAt: string;
}

/** Default PBKDF2 work factor if the env value is missing/invalid. */
const DEFAULT_PBKDF2_ITERATIONS = 600000;
/** Consecutive failures before an account is temporarily locked (FR-014). */
const MAX_FAILED_ATTEMPTS = 5;
/** Lockout duration once the failure threshold is reached. */
const LOCK_DURATION_MS = 15 * 60 * 1000;

const COLLECTION = 'users';
let indexesEnsured: Promise<void> | undefined;

/** Resolve the typed `users` collection, ensuring indexes once per isolate. */
async function getUsers(env: Bindings): Promise<Collection<UserDoc>> {
  const db = await getDb(env);
  const collection = db.collection<UserDoc>(COLLECTION);
  if (!indexesEnsured) {
    indexesEnsured = collection
      .createIndex({ username: 1 }, { unique: true })
      .then(() => undefined);
  }
  await indexesEnsured;
  return collection;
}

/** Project an internal document to its public, client-safe shape. */
function toPublicUser(doc: WithId<UserDoc>): PublicUser {
  return { id: doc._id.toHexString(), username: doc.username, displayName: doc.displayName };
}

/** True when a Mongo error indicates a unique-index (duplicate key) violation. */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

/**
 * Create a new active user (FR-020). The client-derived `authHash` is hashed
 * again before storage; `kdfSalt` and `vaultKeyWrapped` are stored verbatim
 * (they are non-secret / opaque respectively). Throws a `409` {@link AppError}
 * if the username is already taken (FR-005).
 */
export async function createUser(
  env: Bindings,
  input: {
    username: string;
    displayName: string;
    authHash: string;
    kdfSalt: string;
    vaultKeyWrapped: string;
  },
): Promise<PublicUser> {
  const users = await getUsers(env);
  const iterations = parsePositiveInt(env.PBKDF2_ITERATIONS, DEFAULT_PBKDF2_ITERATIONS);
  const passwordHash = await hashPassword(input.authHash, iterations);
  const now = new Date().toISOString();
  const doc: UserDoc = {
    username: input.username,
    displayName: input.displayName,
    passwordHash,
    kdfSalt: input.kdfSalt,
    vaultKeyWrapped: input.vaultKeyWrapped,
    status: 'active',
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await users.insertOne(doc);
    return {
      id: result.insertedId.toHexString(),
      username: doc.username,
      displayName: doc.displayName,
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(409, 'username_taken', 'This username is already taken.');
    }
    throw error;
  }
}

/** Outcome of a credential check. Distinct reasons let the route map statuses. */
export type CredentialResult =
  | { ok: true; user: PublicUser; vaultKeyWrapped: string }
  | { ok: false; reason: 'invalid' | 'disabled' | 'locked' };

/** Persist a failed login attempt, locking the account past the threshold. */
async function registerFailedAttempt(
  users: Collection<UserDoc>,
  doc: WithId<UserDoc>,
): Promise<void> {
  const nextCount = doc.failedLoginCount + 1;
  const update: Partial<UserDoc> = { failedLoginCount: nextCount, updatedAt: new Date().toISOString() };
  if (nextCount >= MAX_FAILED_ATTEMPTS) {
    update.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
    update.failedLoginCount = 0;
  }
  await users.updateOne({ _id: doc._id }, { $set: update });
}

/**
 * Verify a username + client-derived auth hash (FR-012). Unknown usernames and
 * wrong hashes both yield `{ ok: false, reason: 'invalid' }` so the caller can
 * return a single generic error and prevent account enumeration (FR-012).
 * Disabled and locked accounts are reported distinctly for `403`/`429` handling.
 * On success the wrapped vault key is returned so the client can unlock.
 */
export async function verifyCredentials(
  env: Bindings,
  username: string,
  authHash: string,
): Promise<CredentialResult> {
  const users = await getUsers(env);
  const doc = await users.findOne({ username });
  if (!doc) {
    return { ok: false, reason: 'invalid' };
  }
  if (doc.status === 'disabled') {
    return { ok: false, reason: 'disabled' };
  }
  if (doc.lockedUntil && new Date(doc.lockedUntil).getTime() > Date.now()) {
    return { ok: false, reason: 'locked' };
  }

  const valid = await verifyPassword(authHash, doc.passwordHash);
  if (!valid) {
    await registerFailedAttempt(users, doc);
    return { ok: false, reason: 'invalid' };
  }

  await users.updateOne(
    { _id: doc._id },
    { $set: { failedLoginCount: 0, lockedUntil: null, updatedAt: new Date().toISOString() } },
  );
  return { ok: true, user: toPublicUser(doc), vaultKeyWrapped: doc.vaultKeyWrapped };
}

/**
 * Resolve the KDF salt for a username — the public prerequisite for client-side
 * key derivation at login. Unknown usernames receive a DETERMINISTIC decoy
 * (first 16 bytes of SHA-256(username + pepper), base64url) with the same shape
 * as a real salt, so the endpoint cannot be used to enumerate accounts
 * (contracts/auth-api.md).
 */
export async function getSaltForUsername(env: Bindings, username: string): Promise<string> {
  const users = await getUsers(env);
  const doc = await users.findOne({ username });
  if (doc) {
    return doc.kdfSalt;
  }
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${username}\u0000${env.SALT_DECOY_PEPPER}`),
  );
  return toBase64Url(new Uint8Array(digest).slice(0, 16));
}

/**
 * Resolve the wrapped vault key for an active user by id (locked-vault re-unlock
 * support on `GET /api/auth/me`). Returns `null` when unavailable.
 */
export async function getVaultKeyWrappedById(env: Bindings, id: string): Promise<string | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const users = await getUsers(env);
  const doc = await users.findOne({ _id: new ObjectId(id) });
  return doc && doc.status === 'active' ? doc.vaultKeyWrapped : null;
}

/**
 * Resolve the public view of an active user by id. Returns `null` for unknown,
 * malformed, or disabled accounts so callers treat those as no access.
 */
export async function findActivePublicUserById(
  env: Bindings,
  id: string,
): Promise<PublicUser | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const users = await getUsers(env);
  const doc = await users.findOne({ _id: new ObjectId(id) });
  if (!doc || doc.status !== 'active') {
    return null;
  }
  return toPublicUser(doc);
}
