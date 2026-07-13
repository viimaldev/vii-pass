/**
 * Cloudflare Worker runtime bindings for the vii-pass API.
 *
 * Values come from `wrangler.toml` `[vars]` and from Wrangler secrets
 * (`MONGODB_URI`). Secrets are NEVER committed to source (FR-008, SC-007).
 */
import type { PublicUser } from '@vii-pass/shared';
export interface Bindings {
  /**
   * R2 bucket binding. Retained for future storage use but currently dormant —
   * the demonstration file feature was removed with feature 002.
   */
  BUCKET: R2Bucket;
  /** MongoDB Atlas connection string (Wrangler secret). */
  MONGODB_URI: string;
  /** Target MongoDB database name. */
  MONGODB_DB_NAME: string;
  /** Comma-separated list of allowed CORS origins. */
  ALLOWED_ORIGINS: string;
  /** Sliding inactivity timeout for sessions, in seconds (string form; parsed at use). */
  SESSION_IDLE_TTL_SECONDS: string;
  /** Absolute maximum session lifetime, in seconds (string form; parsed at use). */
  SESSION_ABSOLUTE_TTL_SECONDS: string;
  /** PBKDF2 iteration count for password hashing (string form; parsed at use). */
  PBKDF2_ITERATIONS: string;
  /**
   * Level-2 vault encryption key(s) (Wrangler secret). Format
   * `<keyId>:<base64url 32 bytes>[,<keyId>:<...>]` — the first entry encrypts new
   * writes; later entries remain readable for rotation (FR-012).
   */
  VAULT_ENC_KEY: string;
  /**
   * Pepper for deterministic decoy KDF salts on the public salt endpoint
   * (Wrangler secret) — prevents account enumeration (contracts/auth-api.md).
   */
  SALT_DECOY_PEPPER: string;
  /**
   * Optional cookie `Domain` attribute for cross-subdomain sessions. Unset in
   * local development (host-only cookie); set to the shared registrable domain
   * in production (research.md Decision 4).
   */
  COOKIE_DOMAIN?: string;
}

/**
 * Per-request context values set by middleware. `user` is populated by
 * `requireSession` on protected routes and is guaranteed present in their
 * handlers.
 */
export interface Variables {
  user: PublicUser;
}

/** Convenience alias for Hono's generic environment parameter. */
export type AppEnv = { Bindings: Bindings; Variables: Variables };

/**
 * Parse a positive-integer environment string, falling back to `fallback` when
 * the value is missing or invalid. Worker env vars are always strings.
 */
export function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
