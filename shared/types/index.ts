/**
 * Shared TypeScript contracts for vii-pass.
 *
 * These interfaces are the single source of truth for the shapes exchanged between
 * the frontend (React/Vite) and the backend (Hono on Cloudflare Workers). They are
 * type-only and are erased at build time, so importing them adds no runtime cost.
 *
 * See specs/002-user-auth-session/data-model.md.
 */

/**
 * A user as exposed to clients. Secret or sensitive fields (password hash,
 * account status, lockout counters) are NEVER included here.
 */
export interface PublicUser {
  /** Server-generated identifier (Mongo `_id` serialized to a string). */
  id: string;
  /** Login identifier: unique, ASCII alphanumeric, stored lowercased (3–30 chars). */
  username: string;
  /** Display name shown in the welcome message and user menu (1–100 chars). */
  displayName: string;
}

/**
 * Response body for the authentication endpoints (register, login, me). The
 * session itself travels in an HttpOnly cookie, never in the body (FR-013).
 */
export interface AuthResponse {
  user: PublicUser;
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
 * The kind of credential stored in one chord option row. Sensitivity is derived
 * from the type on the client (`password` and `otherSensitive` are masked); it is
 * never stored per row. See specs/009-chord-credential-fields/data-model.md.
 */
export type ChordFieldType = 'username' | 'email' | 'password' | 'other' | 'otherSensitive';

/**
 * One of the three option rows on a chord: a credential type paired with a text
 * value. A `null` value means the row is unused — its `type` is still persisted
 * so the edit form re-opens with the same dropdown selection.
 */
export interface ChordField {
  /** Credential type driving the row's icon and masking behavior. */
  type: ChordFieldType;
  /** Stored value (trimmed, ≤ 200 chars), or `null` when the row is unused. */
  value: string | null;
}

/**
 * A credential entry (tile) belonging to one section. Holds a required title
 * (unique per section, case-insensitively), an optional hidden URL (opened from
 * the card title, never displayed as text), and exactly three typed option rows.
 */
export interface Chord {
  /** Server-generated identifier. */
  id: string;
  /** Parent section id. */
  sectionId: string;
  /** Order within the section (0-based). */
  position: number;
  /** Display title (trimmed, 1–100 chars; original casing preserved). */
  title: string;
  /** Normalized absolute `http(s)` URL (≤ 2048 chars), or `null` when unset. */
  url: string | null;
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
 * Request body for creating a chord. `title` is required; `url` is optional
 * (scheme-less input is normalized to `https://` server-side); `fields` must
 * contain exactly three rows (unused rows carry `value: null`).
 */
export interface CreateChordRequest {
  title: string;
  url?: string | null;
  fields: ChordField[];
}

/**
 * Request body for editing a chord. The full editable state (title, url,
 * fields) is sent on every save; same validation rules as creation.
 */
export interface UpdateChordRequest {
  title: string;
  url?: string | null;
  fields: ChordField[];
}
