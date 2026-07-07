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
  /** Email address; also the login identifier. */
  email: string;
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
