/**
 * Shared TypeScript contracts for the vii-pass foundation.
 *
 * These interfaces are the single source of truth for the shapes exchanged between
 * the frontend (React/Vite) and the backend (Hono on Cloudflare Workers). They are
 * type-only and are erased at build time, so importing them adds no runtime cost.
 *
 * See specs/001-mern-cloudflare-setup/data-model.md.
 */

/** A unit of structured data persisted in MongoDB Atlas. */
export interface StoredRecord {
  /** Server-generated identifier (Mongo `_id` serialized to a string). */
  id: string;
  /** Human-readable label (1–200 chars). */
  title: string;
  /** Optional free-form payload (≤ 5,000 chars). */
  content?: string;
  /** Optional reference to an associated {@link FileAssetMeta} key. */
  fileKey?: string | null;
  /** ISO-8601 creation timestamp (immutable). */
  createdAt: string;
  /** ISO-8601 last-update timestamp. */
  updatedAt: string;
}

/** A page of {@link StoredRecord}s returned by the list endpoint. */
export interface RecordListResponse {
  items: StoredRecord[];
  /** Opaque cursor for the next page, or `null` when there are no more results. */
  nextCursor: string | null;
}

/** Metadata describing a binary object stored in Cloudflare R2. */
export interface FileAssetMeta {
  /** Stable R2 object key returned to clients. */
  key: string;
  /** MIME type of the stored object. */
  contentType: string;
  /** Size of the object in bytes. */
  size: number;
  /** ISO-8601 upload timestamp. */
  uploadedAt: string;
  /** Optional back-reference to a {@link StoredRecord}. */
  recordId?: string | null;
}

/** Reachability of a single downstream dependency. */
export type ComponentStatus = 'ok' | 'down';

/** Aggregate health of the API and its dependencies (see FR-011). */
export interface HealthReport {
  /** `ok` when everything is reachable; `degraded`/`down` otherwise. */
  status: 'ok' | 'degraded' | 'down';
  components: {
    /** The API responded (always `ok` when this report is produced). */
    api: 'ok';
    /** Result of a MongoDB `ping`. */
    database: ComponentStatus;
    /** Result of a cheap R2 probe. */
    storage: ComponentStatus;
  };
  /** ISO-8601 time the check ran. */
  timestamp: string;
}

/**
 * Standard error envelope returned by the API. Messages are human-readable and
 * actionable, and never expose stack traces or internal details (FR-010, SC-009).
 */
export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
