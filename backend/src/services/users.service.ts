import { ObjectId, type Collection, type WithId } from 'mongodb';
import type { PublicUser } from '@vii-pass/shared';
import { parsePositiveInt, type Bindings } from '../env';
import { getDb } from '../lib/mongo';
import { hashPassword, verifyPassword } from '../lib/password';
import { AppError } from '../middleware/error';

/**
 * User accounts service backed by the `users` collection of the `vii_pass`
 * database (FR-011). Passwords are only ever stored as PBKDF2 hashes, and only
 * the {@link PublicUser} projection is ever exposed to callers.
 */

/** Account status. Only `active` accounts may authenticate. */
export type UserStatus = 'active' | 'disabled';

/** Internal user document stored in the `users` collection. */
export interface UserDoc {
  /** Unique, lowercased login identifier (ASCII alphanumeric, 3–30 chars). */
  username: string;
  /** Name shown in the welcome message and user menu. */
  displayName: string;
  /** Encoded PBKDF2 hash (never returned to clients). */
  passwordHash: string;
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
 * Create a new active user with the given credentials (FR-020). The password is
 * hashed before storage. Throws a `409` {@link AppError} if the username is
 * already taken (FR-005).
 */
export async function createUser(
  env: Bindings,
  input: { username: string; displayName: string; password: string },
): Promise<PublicUser> {
  const users = await getUsers(env);
  const iterations = parsePositiveInt(env.PBKDF2_ITERATIONS, DEFAULT_PBKDF2_ITERATIONS);
  const passwordHash = await hashPassword(input.password, iterations);
  const now = new Date().toISOString();
  const doc: UserDoc = {
    username: input.username,
    displayName: input.displayName,
    passwordHash,
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
  | { ok: true; user: PublicUser }
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
 * Verify a username + password pair (FR-012). Unknown usernames and wrong
 * passwords both yield `{ ok: false, reason: 'invalid' }` so the caller can return
 * a single generic error and prevent account enumeration (FR-012). Disabled and
 * locked accounts are reported distinctly for `403`/`429` handling.
 */
export async function verifyCredentials(
  env: Bindings,
  username: string,
  password: string,
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

  const valid = await verifyPassword(password, doc.passwordHash);
  if (!valid) {
    await registerFailedAttempt(users, doc);
    return { ok: false, reason: 'invalid' };
  }

  await users.updateOne(
    { _id: doc._id },
    { $set: { failedLoginCount: 0, lockedUntil: null, updatedAt: new Date().toISOString() } },
  );
  return { ok: true, user: toPublicUser(doc) };
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
