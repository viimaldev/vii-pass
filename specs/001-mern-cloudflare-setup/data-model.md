# Phase 1 Data Model: MERN Web Application Foundation on Cloudflare

**Feature**: [spec.md](./spec.md) | **Date**: 2026-07-06

Derived from the Key Entities in the spec. This foundation feature intentionally keeps the
domain minimal — enough to prove the end-to-end path (API → MongoDB → R2). The concrete
password-vault schema is defined by later specifications.

Validation is enforced at the API boundary with **Zod** (Decision 3 in
[research.md](./research.md)); TypeScript types are inferred from the Zod schemas so a
single definition drives runtime validation and compile-time types. Shared types live in
`shared/types/` and are imported by both the frontend and backend.

---

## Entity: StoredRecord

A unit of structured data persisted in MongoDB Atlas that proves the data layer works
end to end. Stored in the `records` collection.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `_id` | `ObjectId` (Mongo) → `string` (API) | Server-generated | Serialized to a string `id` in API responses. |
| `title` | `string` | Required, 1–200 chars, trimmed | Human-readable label. |
| `content` | `string` | Optional, ≤ 5,000 chars | Free-form payload for the slice; superseded by real schema later. |
| `fileKey` | `string \| null` | Optional | Reference to an associated `FileAsset` key, if any. |
| `createdAt` | `string` (ISO 8601) | Server-set on create | Immutable. |
| `updatedAt` | `string` (ISO 8601) | Server-set on create/update | Updated on every write. |

**Validation rules**:
- `title` MUST be non-empty after trimming; reject with `400` and an actionable message.
- `content` length capped to bound document size (avoids unbounded growth).
- `fileKey`, when present, MUST match a stored object key format; existence is not
  transactionally guaranteed (documented in edge cases).

**Relationships**:
- Optional 1:1 (loose) link to a `FileAsset` via `fileKey`.

**State**: Records are created and read in this feature. Update/delete are out of scope for
the foundation slice but the schema does not preclude them (`updatedAt` reserved).

---

## Entity: FileAsset

A binary file or image stored in Cloudflare R2. R2 is the source of truth for the bytes;
object metadata is returned by the R2 API. An optional lightweight index document MAY be
stored in a `files` collection if listing beyond R2's native `list` is needed (not required
for the slice).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `key` | `string` | Server-generated, unique | R2 object key; stable reference returned to clients. |
| `contentType` | `string` | Required; allowlist enforced | e.g. `image/png`, `image/jpeg`, `application/pdf`. |
| `size` | `number` (bytes) | Required; `0 < size ≤ MAX_UPLOAD_BYTES` | Enforced before write (FR-013). |
| `uploadedAt` | `string` (ISO 8601) | Server-set | From R2 object metadata. |
| `recordId` | `string \| null` | Optional | Back-reference to a `StoredRecord`, if associated. |

**Validation rules** (enforced at upload boundary, FR-013):
- `contentType` MUST be in the configured allowlist; otherwise reject `415`.
- `size` MUST be within `MAX_UPLOAD_BYTES`; otherwise reject `413`.
- On any validation failure, **nothing** is written to R2 (no partial objects).

**Relationships**:
- Optional 1:1 (loose) link to a `StoredRecord` via `recordId` / `fileKey`.

---

## Entity: HealthReport

A transient, computed representation of layer reachability returned by `GET /api/health`.
Not persisted.

| Field | Type | Notes |
|-------|------|-------|
| `status` | `'ok' \| 'degraded' \| 'down'` | Aggregate roll-up. |
| `components.api` | `'ok'` | The Worker itself responded. |
| `components.database` | `'ok' \| 'down'` | Result of a MongoDB `ping`. |
| `components.storage` | `'ok' \| 'down'` | Result of a cheap R2 probe. |
| `timestamp` | `string` (ISO 8601) | When the check ran. |

**Rules**:
- `status` is `ok` only when all components are `ok`; `degraded` if some are `ok`; `down`
  if the critical dependencies fail.
- Never leaks connection strings, hostnames, or stack traces (FR-010).

---

## Entity: Configuration/Secret (operational, not persisted)

Environment-provided values required to run the system. **Never** committed to source and
**never** returned to clients (FR-008, SC-007).

| Name | Scope | Purpose |
|------|-------|---------|
| `MONGODB_URI` | Worker secret | Atlas connection string (credentials embedded). |
| `MONGODB_DB_NAME` | Worker var | Target database name. |
| `BUCKET` | Worker R2 binding | R2 bucket for file assets. |
| `ALLOWED_ORIGINS` | Worker var | CORS allowlist (Pages origins). |
| `MAX_UPLOAD_BYTES` | Worker var | Upload size limit. |
| `ALLOWED_CONTENT_TYPES` | Worker var | Upload MIME allowlist. |
| `VITE_API_BASE_URL` | Pages build var | API base URL for the SPA. |

---

## Shared type sketch (illustrative, defined in `shared/types/`)

```ts
export interface StoredRecord {
  id: string;
  title: string;
  content?: string;
  fileKey?: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface FileAssetMeta {
  key: string;
  contentType: string;
  size: number;
  uploadedAt: string; // ISO 8601
  recordId?: string | null;
}

export type ComponentStatus = 'ok' | 'down';

export interface HealthReport {
  status: 'ok' | 'degraded' | 'down';
  components: { api: 'ok'; database: ComponentStatus; storage: ComponentStatus };
  timestamp: string; // ISO 8601
}

export interface ApiError {
  error: { code: string; message: string }; // actionable, non-leaky (FR-010)
}
```

These illustrate intent; the authoritative shapes are the Zod schemas in the backend,
with types inferred and shared to the frontend.
