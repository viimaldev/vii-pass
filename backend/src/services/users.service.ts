import { ObjectId, type Collection, type WithId } from 'mongodb';
import type { PublicUser, UserRole } from '@vii-pass/shared';
import { parsePositiveInt, type Bindings } from '../env';
import { toBase64Url } from '../lib/encoding';
import { getDb } from '../lib/mongo';
import { hashPassword, verifyPassword } from '../lib/password';
import { generateSessionToken, hashToken } from '../lib/tokens';
import { AppError } from '../middleware/error';

/**
 * Account service backed by the `users` collection. Since
 * specs/011-dual-user-roles each document is an ACCOUNT owning exactly two
 * login identities (one `admin`, one `normal`) that share a single credential
 * and a single vault. Only the {@link PublicUser} projection — carrying the
 * session's username + role — is ever exposed to callers.
 *
 * Since specs/010-credential-encryption the server never sees the raw password
 * (or, since 011, the raw security answer): clients send derived hashes, which
 * are hashed AGAIN through the existing PBKDF2 storage scheme before
 * persisting — so a database dump is neither login-replayable nor useful for
 * vault decryption.
 */

/** Account status. Only `active` accounts may authenticate. */
export type UserStatus = 'active' | 'disabled';

/** One of the account's two login identities. */
export interface LoginIdentity {
  /** Unique, lowercased login identifier (ASCII alphanumeric, 3–30 chars). */
  username: string;
  /** Capability level granted to sessions signed in with this username. */
  role: UserRole;
}

/** Internal account document stored in the `users` collection. */
export interface UserDoc {
  /**
   * Exactly two entries — one per role. A UNIQUE MULTIKEY index on
   * `logins.username` enforces global username uniqueness across all accounts
   * and roles (FR-003, research Decision 1).
   */
  logins: LoginIdentity[];
  /** Name shown in the welcome message and user menu (one per account). */
  displayName: string;
  /** Encoded PBKDF2 hash of the client-derived `authHash` (never returned to clients). */
  passwordHash: string;
  /**
   * Client-generated PBKDF2 salt (base64url, 128 bits) for the browser-side key
   * derivation. Account-wide (both usernames derive the same keys). Served
   * publicly via the salt endpoint; replaced (fresh) on every password reset.
   *
   * Password-change contract (010 FR-010 / 011 reset): a credential change
   * replaces `passwordHash` + `kdfSalt` + `vaultKeyWrapped` together in ONE
   * atomic `updateOne` — the vault key inside the wrapper is unchanged, so no
   * chord data is ever re-encrypted.
   */
  kdfSalt: string;
  /**
   * The account's vault key wrapped under the password-derived wrap key
   * (`v1.wk.<iv>.<ct>`). Opaque to the server (zero-knowledge). See the
   * contract note on {@link UserDoc.kdfSalt}.
   */
  vaultKeyWrapped: string;
  /** Index (0–4) into the shared `SECURITY_QUESTIONS` list (FR-013). */
  securityQuestionId: number;
  /** Client-generated salt (base64url, 128 bits) for the answer-side KDF. */
  recoverySalt: string;
  /**
   * Encoded PBKDF2 hash of the client-derived `answerHash`. Never returned to
   * clients — the plaintext answer is unrecoverable by anyone (FR-009).
   */
  securityAnswerVerifier: string;
  /**
   * The SAME vault key wrapped under the answer-derived recovery wrap key
   * (`v1.wk.<iv>.<ct>`). Released only by a successful `reset/verify`; NOT
   * touched by a password reset, which is what keeps the vault readable after
   * a reset (FR-011).
   */
  vaultKeyWrappedRecovery: string;
  /** SHA-256 (hex) of the outstanding one-time reset token, or `null`. */
  resetTokenHash: string | null;
  /** ISO-8601 expiry of the outstanding reset token, or `null`. */
  resetTokenExpiresAt: string | null;
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
      .createIndex({ 'logins.username': 1 }, { unique: true })
      .then(() => undefined);
  }
  await indexesEnsured;
  return collection;
}

/**
 * Project an internal document to its public, client-safe shape for a session
 * carrying `role`: the projected `username` is the account's login with that
 * role (each account has exactly one login per role).
 */
function toPublicUser(doc: WithId<UserDoc>, role: UserRole): PublicUser {
  const login = doc.logins.find((l) => l.role === role) ?? doc.logins[0];
  return {
    id: doc._id.toHexString(),
    username: login.username,
    displayName: doc.displayName,
    role: login.role,
  };
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
 * Create a new active account with two login identities sharing one credential
 * (FR-001/FR-002). The client-derived `authHash` and `answerHash` are hashed
 * again before storage; salts and wrapped-key envelopes are stored verbatim
 * (non-secret / opaque respectively). Throws a `409` {@link AppError} if either
 * requested username collides with ANY existing username of any account, in
 * either role (FR-003) — without disclosing which. Returns the admin identity
 * (registration signs the caller in as admin).
 */
export async function createUser(
  env: Bindings,
  input: {
    adminUsername: string;
    username: string;
    displayName: string;
    authHash: string;
    kdfSalt: string;
    vaultKeyWrapped: string;
    securityQuestionId: number;
    answerHash: string;
    recoverySalt: string;
    vaultKeyWrappedRecovery: string;
  },
): Promise<PublicUser> {
  const users = await getUsers(env);
  const iterations = parsePositiveInt(env.PBKDF2_ITERATIONS, DEFAULT_PBKDF2_ITERATIONS);
  const passwordHash = await hashPassword(input.authHash, iterations);
  const securityAnswerVerifier = await hashPassword(input.answerHash, iterations);
  const now = new Date().toISOString();
  const doc: UserDoc = {
    logins: [
      { username: input.adminUsername, role: 'admin' },
      { username: input.username, role: 'normal' },
    ],
    displayName: input.displayName,
    passwordHash,
    kdfSalt: input.kdfSalt,
    vaultKeyWrapped: input.vaultKeyWrapped,
    securityQuestionId: input.securityQuestionId,
    recoverySalt: input.recoverySalt,
    securityAnswerVerifier,
    vaultKeyWrappedRecovery: input.vaultKeyWrappedRecovery,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
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
      username: input.adminUsername,
      displayName: doc.displayName,
      role: 'admin',
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
  const update: Partial<UserDoc> = {
    failedLoginCount: nextCount,
    updatedAt: new Date().toISOString(),
  };
  if (nextCount >= MAX_FAILED_ATTEMPTS) {
    update.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
    update.failedLoginCount = 0;
  }
  await users.updateOne({ _id: doc._id }, { $set: update });
}

/**
 * Verify a username + client-derived auth hash (FR-004). `username` may be
 * EITHER of the account's two names — the single account verifier is checked
 * and, on success, the returned {@link PublicUser} carries the MATCHED login's
 * username and role (which the caller records on the session). Unknown
 * usernames and wrong hashes both yield `{ ok: false, reason: 'invalid' }` so
 * the caller can return a single generic error and prevent account enumeration.
 * Disabled and locked accounts are reported distinctly for `403`/`429` handling.
 */
export async function verifyCredentials(
  env: Bindings,
  username: string,
  authHash: string,
): Promise<CredentialResult> {
  const users = await getUsers(env);
  const doc = await users.findOne({ 'logins.username': username });
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
  const matched = doc.logins.find((l) => l.username === username) ?? doc.logins[0];
  return {
    ok: true,
    user: toPublicUser(doc, matched.role),
    vaultKeyWrapped: doc.vaultKeyWrapped,
  };
}

/**
 * Resolve the KDF salt for a username — the public prerequisite for client-side
 * key derivation at login. Resolves the ACCOUNT salt for either of an account's
 * two usernames. Unknown usernames receive a DETERMINISTIC decoy (first 16
 * bytes of SHA-256(username + pepper), base64url) with the same shape as a real
 * salt, so the endpoint cannot be used to enumerate accounts.
 */
export async function getSaltForUsername(env: Bindings, username: string): Promise<string> {
  const users = await getUsers(env);
  const doc = await users.findOne({ 'logins.username': username });
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
 * Resolve the wrapped vault key for an active account by id (locked-vault
 * re-unlock support on `GET /api/auth/me`). Returns `null` when unavailable.
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
 * Resolve the public view of an active account by id for a session carrying
 * `role` (the projected username is the login with that role). Returns `null`
 * for unknown, malformed, or disabled accounts so callers treat those as no
 * access.
 */
export async function findActivePublicUserById(
  env: Bindings,
  id: string,
  role: UserRole,
): Promise<PublicUser | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const users = await getUsers(env);
  const doc = await users.findOne({ _id: new ObjectId(id) });
  if (!doc || doc.status !== 'active') {
    return null;
  }
  return toPublicUser(doc, role);
}

// ---------------------------------------------------------------------------
// Password reset (specs/011-dual-user-roles US3, research Decision 5)
// ---------------------------------------------------------------------------

/** Reset-token lifetime once an answer is verified. */
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
/** Failed verify attempts before a typed name is locked out. */
const MAX_RESET_ATTEMPTS = 5;
/** Reset-verify lockout duration. */
const RESET_LOCK_DURATION_MS = 15 * 60 * 1000;
/** Auto-purge horizon for throttle rows (TTL index). */
const RESET_ATTEMPTS_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Throttle row for `reset/verify`, keyed by the TYPED (trimmed, lowercased)
 * username so unknown names throttle exactly like real ones (FR-010).
 */
interface ResetAttemptDoc {
  /** The requested username, trimmed + lowercased. Unique index. */
  usernameKey: string;
  /** Consecutive failed verifies. The row is deleted on success. */
  failedCount: number;
  /** ISO-8601 lockout deadline once `failedCount` reaches the threshold, or `null`. */
  lockedUntil: string | null;
  /** TTL index target — rows self-purge after the throttle horizon. */
  expiresAt: Date;
}

const RESET_ATTEMPTS_COLLECTION = 'resetAttempts';
let resetAttemptIndexesEnsured: Promise<void> | undefined;

/** Resolve the typed `resetAttempts` collection, ensuring indexes once per isolate. */
async function getResetAttempts(env: Bindings): Promise<Collection<ResetAttemptDoc>> {
  const db = await getDb(env);
  const collection = db.collection<ResetAttemptDoc>(RESET_ATTEMPTS_COLLECTION);
  if (!resetAttemptIndexesEnsured) {
    resetAttemptIndexesEnsured = Promise.all([
      collection.createIndex({ usernameKey: 1 }, { unique: true }),
      collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).then(() => undefined);
  }
  await resetAttemptIndexesEnsured;
  return collection;
}

/** The generic reset failure — identical for every non-success cause (FR-010). */
function invalidResetError(): AppError {
  return new AppError(401, 'invalid_reset', "That didn't match our records.");
}

/**
 * Resolve the account owning `username` as its ADMIN login, if it is active.
 * The reset flow is admin-name-only.
 */
async function findActiveAccountByAdminUsername(
  env: Bindings,
  username: string,
): Promise<WithId<UserDoc> | null> {
  const users = await getUsers(env);
  const doc = await users.findOne({
    logins: { $elemMatch: { username, role: 'admin' } },
  });
  return doc && doc.status === 'active' ? doc : null;
}

/**
 * Step 1 of the reset flow: resolve the security question + recovery salt for
 * an admin username. Unknown, non-admin, and disabled names are REJECTED with
 * a 404 so the user gets immediate feedback that the username is wrong
 * (post-launch user decision — supersedes the original always-200 decoy
 * behavior of FR-010; a deliberate username-enumeration tradeoff).
 */
export async function getResetQuestion(
  env: Bindings,
  username: string,
): Promise<{ questionId: number; recoverySalt: string }> {
  const doc = await findActiveAccountByAdminUsername(env, username);
  if (!doc) {
    throw new AppError(404, 'unknown_username', 'No account found with that admin username.');
  }
  return { questionId: doc.securityQuestionId, recoverySalt: doc.recoverySalt };
}

/**
 * Step 2 of the reset flow: verify the client-derived answer hash for an admin
 * username, throttled per TYPED name. The throttle check runs FIRST, so locked
 * names — known and unknown alike — get a `429` before any verification. Wrong
 * answers, non-admin names, and unknown names all fail with the same generic
 * `401` and increment the same throttle counter (FR-010). On success the
 * throttle row is cleared, a one-time token (10-minute expiry, hash-stored) is
 * issued, and the recovery-wrapped vault key is released.
 */
export async function verifyResetAnswer(
  env: Bindings,
  username: string,
  answerHash: string,
): Promise<{ resetToken: string; vaultKeyWrappedRecovery: string }> {
  const attempts = await getResetAttempts(env);
  const now = Date.now();

  // Throttle FIRST (contract ordering rule) — applies to unknown names too.
  const attempt = await attempts.findOne({ usernameKey: username });
  if (attempt?.lockedUntil && new Date(attempt.lockedUntil).getTime() > now) {
    throw new AppError(429, 'too_many_attempts', 'Too many failed attempts. Please try again later.');
  }

  const doc = await findActiveAccountByAdminUsername(env, username);
  const valid = doc ? await verifyPassword(answerHash, doc.securityAnswerVerifier) : false;

  if (!doc || !valid) {
    // One shared failure path: increment the name-keyed counter and lock past
    // the threshold, identically for real and unknown names.
    const nextCount = (attempt?.failedCount ?? 0) + 1;
    await attempts.updateOne(
      { usernameKey: username },
      {
        $set: {
          failedCount: nextCount >= MAX_RESET_ATTEMPTS ? 0 : nextCount,
          lockedUntil:
            nextCount >= MAX_RESET_ATTEMPTS
              ? new Date(now + RESET_LOCK_DURATION_MS).toISOString()
              : (attempt?.lockedUntil ?? null),
          expiresAt: new Date(now + RESET_ATTEMPTS_TTL_MS),
        },
      },
      { upsert: true },
    );
    throw invalidResetError();
  }

  await attempts.deleteOne({ usernameKey: username });

  // One-time token: only its hash is stored; a re-verify replaces it, which is
  // what makes any previously issued token stale (single-use, latest-wins).
  const resetToken = generateSessionToken();
  const users = await getUsers(env);
  await users.updateOne(
    { _id: doc._id },
    {
      $set: {
        resetTokenHash: await hashToken(resetToken),
        resetTokenExpiresAt: new Date(now + RESET_TOKEN_TTL_MS).toISOString(),
        updatedAt: new Date(now).toISOString(),
      },
    },
  );
  return { resetToken, vaultKeyWrappedRecovery: doc.vaultKeyWrappedRecovery };
}

/**
 * Step 3 of the reset flow: atomically replace the credential epoch. Validates
 * the one-time token (hash + expiry) and, in a SINGLE `updateOne`, replaces
 * `passwordHash` (re-hash of the new auth hash) + `kdfSalt` + `vaultKeyWrapped`
 * while burning the token — `vaultKeyWrappedRecovery` is untouched, so the
 * vault key (and every stored chord) survives the reset (FR-011). Any mismatch
 * fails with the same generic `401`. Callers revoke the account's sessions
 * afterwards (FR-012).
 */
export async function completeReset(
  env: Bindings,
  username: string,
  resetToken: string,
  newAuthHash: string,
  newKdfSalt: string,
  newVaultKeyWrapped: string,
): Promise<string> {
  const doc = await findActiveAccountByAdminUsername(env, username);
  if (
    !doc ||
    !doc.resetTokenHash ||
    !doc.resetTokenExpiresAt ||
    new Date(doc.resetTokenExpiresAt).getTime() <= Date.now()
  ) {
    throw invalidResetError();
  }
  const tokenHash = await hashToken(resetToken);
  if (tokenHash !== doc.resetTokenHash) {
    throw invalidResetError();
  }

  const iterations = parsePositiveInt(env.PBKDF2_ITERATIONS, DEFAULT_PBKDF2_ITERATIONS);
  const passwordHash = await hashPassword(newAuthHash, iterations);
  const users = await getUsers(env);
  // Atomic replace + token burn: the filter re-checks the token hash so a
  // concurrent re-verify/complete cannot double-spend the same token.
  const result = await users.updateOne(
    { _id: doc._id, resetTokenHash: doc.resetTokenHash },
    {
      $set: {
        passwordHash,
        kdfSalt: newKdfSalt,
        vaultKeyWrapped: newVaultKeyWrapped,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
        updatedAt: new Date().toISOString(),
      },
    },
  );
  if (result.modifiedCount !== 1) {
    throw invalidResetError();
  }
  return doc._id.toHexString();
}
