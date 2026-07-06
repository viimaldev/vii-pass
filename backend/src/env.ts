/**
 * Cloudflare Worker runtime bindings for the vii-pass API.
 *
 * Values come from `wrangler.toml` `[vars]` and from Wrangler secrets
 * (`MONGODB_URI`). Secrets are NEVER committed to source (FR-008, SC-007).
 */
export interface Bindings {
  /** R2 bucket binding for file/image storage. */
  BUCKET: R2Bucket;
  /** MongoDB Atlas connection string (Wrangler secret). */
  MONGODB_URI: string;
  /** Target MongoDB database name. */
  MONGODB_DB_NAME: string;
  /** Comma-separated list of allowed CORS origins. */
  ALLOWED_ORIGINS: string;
  /** Maximum allowed upload size in bytes (string form; parsed at use). */
  MAX_UPLOAD_BYTES: string;
  /** Comma-separated allowlist of upload MIME types. */
  ALLOWED_CONTENT_TYPES: string;
}

/** Convenience alias for Hono's generic environment parameter. */
export type AppEnv = { Bindings: Bindings };
