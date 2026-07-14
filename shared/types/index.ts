/**
 * Shared TypeScript contracts for vii-pass.
 *
 * These interfaces are the single source of truth for the shapes exchanged between
 * the frontend (React/Vite) and the backend (Hono on Cloudflare Workers). They are
 * type declarations (erased at build time) plus one tiny runtime constant,
 * {@link SECURITY_QUESTIONS}, kept here so both sides render/validate the same
 * fixed list without duplication.
 *
 * See specs/002-user-auth-session/data-model.md.
 */

/**
 * Role carried by a session, determined by which of the account's two usernames
 * was used at sign-in. `admin` = full capabilities; `normal` = view/reveal/copy
 * only (specs/011-dual-user-roles, FR-004–FR-006).
 */
export type UserRole = 'admin' | 'normal';

/**
 * The fixed, product-wide list of security questions offered at registration
 * (FR-013). The persisted `securityQuestionId` is an index into this array —
 * the server stores/serves only the id; clients render the text.
 */
export const SECURITY_QUESTIONS: readonly string[] = [
  'What was the name of your first pet?',
  'In what city were you born?',
  "What is your mother's maiden name?",
  'What was the name of your first school?',
  'What was the name of your favorite teacher?',
] as const;

/**
 * A user as exposed to clients. Secret or sensitive fields (password hash,
 * account status, lockout counters) are NEVER included here.
 */
export interface PublicUser {
  /** Server-generated identifier (Mongo `_id` serialized to a string). */
  id: string;
  /**
   * The username used for THIS session (one of the account's two logins:
   * unique, ASCII alphanumeric, stored lowercased, 3–30 chars).
   */
  username: string;
  /** Display name shown in the welcome message and user menu (1–100 chars). */
  displayName: string;
  /** Role of the username used at sign-in; fixed for the session's lifetime. */
  role: UserRole;
}

/**
 * Response body for the authentication endpoints (register, login, me). The
 * session itself travels in an HttpOnly cookie, never in the body (FR-013).
 * `vaultKeyWrapped` lets the client unwrap its vault key at sign-in and lets a
 * refreshed tab re-unlock with only the password (specs/010-credential-encryption).
 */
export interface AuthResponse {
  user: PublicUser;
  /** The user's vault key wrapped under their password-derived wrap key (`v1.wk.*`). */
  vaultKeyWrapped: string | null;
}

/**
 * Request body for `POST /api/auth/register`. Creates ONE account with TWO
 * usernames (admin + normal) sharing a single credential, plus the security-
 * question recovery material (specs/011-dual-user-roles contracts/auth-api.md).
 * Neither the raw password nor the answer text ever leaves the browser — the
 * client derives `authHash`/`answerHash` and wraps the vault key twice locally.
 */
export interface RegisterRequest {
  /** Username that signs in with FULL capabilities (3–30 alnum). */
  adminUsername: string;
  /** Username that signs in view/reveal/copy-only; must differ from adminUsername. */
  username: string;
  displayName: string;
  /** Client-derived authentication hash (base64url, 43 chars = 256 bits). */
  authHash: string;
  /** Client-generated PBKDF2 salt (base64url, 22 chars = 128 bits). */
  kdfSalt: string;
  /** Vault key wrapped under the password-derived wrap key (`v1.wk.<iv>.<ct>`). */
  vaultKeyWrapped: string;
  /** Index (0–4) into {@link SECURITY_QUESTIONS}. */
  securityQuestionId: number;
  /** Client-derived hash of the normalized security answer (base64url, 43 chars). */
  answerHash: string;
  /** Client-generated salt for the answer KDF (base64url, 22 chars). */
  recoverySalt: string;
  /** The SAME vault key wrapped under the answer-derived recovery wrap key. */
  vaultKeyWrappedRecovery: string;
}

/** Request body for `POST /api/auth/login` — `authHash` replaces the password. */
export interface LoginRequest {
  username: string;
  /** Client-derived authentication hash (see {@link RegisterRequest.authHash}). */
  authHash: string;
}

/**
 * Response body for the public `GET /api/auth/salt/:username`. Unknown usernames
 * receive a deterministic decoy so the endpoint cannot enumerate accounts.
 */
export interface SaltResponse {
  kdfSalt: string;
}

/** Request body for `POST /api/auth/reset/question` (step 1 of password reset). */
export interface ResetQuestionRequest {
  /** The admin username of the account (any name is accepted; decoys otherwise). */
  username: string;
}

/**
 * Response for `reset/question` — ALWAYS 200. Non-admin/unknown names receive a
 * deterministic decoy question + salt of identical shape (FR-010: no enumeration).
 */
export interface ResetQuestionResponse {
  /** Index (0–4) into {@link SECURITY_QUESTIONS}. */
  questionId: number;
  /** Salt for the client-side answer KDF (base64url, 22 chars). */
  recoverySalt: string;
}

/** Request body for `POST /api/auth/reset/verify` (step 2: prove the answer). */
export interface ResetVerifyRequest {
  username: string;
  /** Client-derived hash of the normalized answer (base64url, 43 chars). */
  answerHash: string;
}

/** Response for a successful `reset/verify`. */
export interface ResetVerifyResponse {
  /** One-time, 10-minute reset token authorizing `reset/complete`. */
  resetToken: string;
  /** The vault key wrapped under the answer-derived recovery key (`v1.wk.*`). */
  vaultKeyWrappedRecovery: string;
}

/**
 * Request body for `POST /api/auth/reset/complete` (step 3). The client has
 * unwrapped the vault key from the recovery envelope and re-wrapped it under
 * keys derived from the NEW password — the vault key itself never changes, so
 * stored chord data stays readable (FR-011).
 */
export interface ResetCompleteRequest {
  username: string;
  resetToken: string;
  /** Auth hash derived from the NEW password (base64url, 43 chars). */
  newAuthHash: string;
  /** Fresh client-generated PBKDF2 salt (base64url, 22 chars). */
  newKdfSalt: string;
  /** The unchanged vault key re-wrapped under the new password's wrap key. */
  newVaultKeyWrapped: string;
}

/** Reachability of a single downstream dependency. */
export type ComponentStatus = 'ok' | 'down';

/**
 * Aggregate health of the API and its dependencies. Retained as an
 * infrastructure signal only; the former user-facing health screen was removed
 * (FR-012).
 */
export interface HealthReport {
  /** `ok` when everything is reachable; `degraded`/`down` otherwise. */
  status: 'ok' | 'degraded' | 'down';
  components: {
    /** The API responded (always `ok` when this report is produced). */
    api: 'ok';
    /** Result of a MongoDB `ping`. */
    database: ComponentStatus;
  };
  /** ISO-8601 time the check ran. */
  timestamp: string;
}

/**
 * Standard error envelope returned by the API. Messages are human-readable and
 * actionable, and never expose stack traces or internal details (FR-015, SC-004).
 */
export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

/**
 * A credential section (color-coded tab) as exposed to clients. Owner and audit
 * fields are never included. See specs/006-credential-sections-chords/data-model.md.
 */
export interface Section {
  /** Server-generated identifier (Mongo `_id` serialized to a string). */
  id: string;
  /** Display label (1–50 chars). Not unique per user. */
  name: string;
  /** Tab color as a hex string `#RRGGBB`. */
  color: string;
  /** Order within the user's sections (0-based). */
  position: number;
  /** `true` only for the auto-provisioned, non-deletable "Mine" section. */
  isDefault: boolean;
}

/**
 * A Level-1 encrypted value as it travels over the network:
 * `v1.l1.<ivB64url>.<ctB64url>` (AES-256-GCM under the user's vault key). The
 * server wraps it a second time before persisting and unwraps on read, so
 * clients only ever see this form (specs/010-credential-encryption data-model.md).
 * Plaintext secret values never appear in payloads.
 */
export type EncryptedValue = string;

/**
 * The kind of credential stored in one chord option row. Sensitivity is derived
 * from the type on the client (`password` and `otherSensitive` are masked); it is
 * never stored per row. See specs/009-chord-credential-fields/data-model.md.
 */
export type ChordFieldType = 'username' | 'email' | 'password' | 'other' | 'otherSensitive';

/**
 * One of the three option rows on a chord: a credential type paired with an
 * encrypted value. A `null` value means the row is unused — its `type` is still
 * persisted so the edit form re-opens with the same dropdown selection.
 */
export interface ChordField {
  /** Credential type driving the row's icon and masking behavior. */
  type: ChordFieldType;
  /** Level-1 encrypted value envelope, or `null` when the row is unused. */
  value: EncryptedValue | null;
}

/**
 * A credential entry (tile) belonging to one section. Holds a required plaintext
 * title (unique per section, case-insensitively — kept readable for listing and
 * duplicate detection, FR-011), an optional encrypted URL, and exactly three
 * typed option rows with encrypted values.
 */
export interface Chord {
  /** Server-generated identifier. */
  id: string;
  /** Parent section id. */
  sectionId: string;
  /** Order within the section (0-based). */
  position: number;
  /** Display title (trimmed, 1–100 chars; original casing preserved). Plaintext. */
  title: string;
  /** Level-1 encrypted URL envelope, or `null` when unset. */
  url: EncryptedValue | null;
  /** Exactly three option rows, in slot order. */
  fields: ChordField[];
}

/** Response body for `GET /api/sections`. */
export interface SectionsResponse {
  sections: Section[];
}

/** Response body for `POST /api/sections`. */
export interface SectionResponse {
  section: Section;
}

/** Response body for chord list endpoints. */
export interface ChordsResponse {
  chords: Chord[];
}

/**
 * Response body for `GET /api/vault` — the authenticated user's complete
 * organizer in one payload (specs/015-vault-perf-caching). Loaded once per
 * signed-in page visit; section switches are then served from client memory.
 */
export interface VaultResponse {
  /** All of the user's sections, sorted by `position` ascending. */
  sections: Section[];
  /**
   * ALL of the user's chords across every section, flat, sorted by
   * `(sectionId, position)`. Values are Level-1 envelopes (or `null` /
   * the `"v1.err"` sentinel) — identical semantics to the single-section list.
   */
  chords: Chord[];
}

/** Response body for single-chord create/update endpoints. */
export interface ChordResponse {
  chord: Chord;
}

/** Request body for creating a section. */
export interface CreateSectionRequest {
  name: string;
  color: string;
}

/** Request body for reordering a scope: the full ordered list of ids. */
export interface ReorderRequest {
  orderedIds: string[];
}

/**
 * Request body for creating a chord. `title` is required (plaintext); `url` and
 * `fields[].value` carry Level-1 encrypted envelopes produced in the browser —
 * plaintext URL rules (scheme allow-list, length) are enforced client-side
 * before encryption. `fields` must contain exactly three rows (unused rows
 * carry `value: null`).
 */
export interface CreateChordRequest {
  title: string;
  url?: EncryptedValue | null;
  fields: ChordField[];
}

/**
 * Request body for editing a chord. The full editable state (title, url,
 * fields) is sent on every save; same validation rules as creation.
 */
export interface UpdateChordRequest {
  title: string;
  url?: EncryptedValue | null;
  fields: ChordField[];
}
