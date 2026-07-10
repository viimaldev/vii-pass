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
 * A credential entry (tile) belonging to one section. Fields are placeholders for
 * now (`field1`/`field2`/`field3`); real credential fields arrive in a later feature.
 */
export interface Chord {
  /** Server-generated identifier. */
  id: string;
  /** Parent section id. */
  sectionId: string;
  /** Order within the section (0-based). */
  position: number;
  /** Placeholder field "1". */
  field1: string | null;
  /** Placeholder field "2". */
  field2: string | null;
  /** Placeholder field "3". */
  field3: string | null;
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

/** Request body for creating a chord (all placeholder fields optional). */
export interface CreateChordRequest {
  field1?: string | null;
  field2?: string | null;
  field3?: string | null;
}

/** Request body for editing a chord's placeholder fields. */
export interface UpdateChordRequest {
  field1?: string | null;
  field2?: string | null;
  field3?: string | null;
}
