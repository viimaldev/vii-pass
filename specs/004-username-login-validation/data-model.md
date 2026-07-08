# Phase 1 Data Model: Username-Based Login Validation

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-07-08

Persistence is MongoDB Atlas, database **`vii_pass`**. This feature **modifies the existing
`users` collection** introduced in feature 002 — it does not add or remove collections. The
`sessions` collection is unchanged. Internal documents use MongoDB `ObjectId`; the API
serializes ids to strings and never returns secret material.

---

## Collection: `users` (modified)

A person who can authenticate. Password material is stored **only** as a salted PBKDF2 hash
(unchanged) — never plaintext. The login identifier changes from `email` to `username`.

### Document shape (internal)

| Field | Type | Change | Constraints / Notes |
|-------|------|--------|---------------------|
| `_id` | `ObjectId` | — | Primary key; serialized to `id` in API responses. |
| `username` | `string` | **replaces `email`** | **Unique**, trimmed + lowercased, `^[A-Za-z0-9]+$`, 3–30 chars. Login identifier. |
| `displayName` | `string` | unchanged | Trimmed, 1–100 chars. Shown on the home page and user menu. |
| `passwordHash` | `string` | unchanged | Encoded hash `pbkdf2$sha256$<iterations>$<saltB64url>$<hashB64url>`. Never returned by the API. |
| `status` | `'active' \| 'disabled'` | unchanged | Only `active` users may authenticate. Defaults to `active`. |
| `failedLoginCount` | `number` | unchanged | Consecutive failed logins; reset to 0 on success. Defaults to 0. |
| `lockedUntil` | `string \| null` | unchanged | ISO-8601; while `now < lockedUntil`, login is refused with `429`. Defaults to `null`. |
| `createdAt` | `string` | unchanged | ISO-8601 creation timestamp (immutable). |
| `updatedAt` | `string` | unchanged | ISO-8601 last-update timestamp. |

> **`email` is removed** from the document as an identifier. New accounts are created without
> it. (No migration of any pre-existing email-bearing documents is in scope — see
> [research.md](./research.md) Decision 5.)

### Validation rules (Zod, at the boundary)

- **Registration input** (`registerSchema`):
  - `username` — `trim` → **min 3**, **max 30** → **`^[A-Za-z0-9]+$`** → `toLowerCase`.
    (Alphanumeric only; no special characters; normalized for case-insensitive uniqueness.)
  - `displayName` — trimmed, **1–100 chars**, required (unchanged).
  - `password` — **min 3, max 10** characters (was min 12 / max 200). See the security note in
    research Decision 3.
- **Login input** (`loginSchema`):
  - `username` — `trim` → non-empty → `toLowerCase` (normalized to match storage; **no**
    format/length enforcement so wrong names yield the generic invalid-credentials error).
  - `password` — present (non-empty); no strength check on login.
- `passwordHash` is produced server-side only; it is never accepted from a client.

### Indexes

- `username` — **unique** (replaces the former unique `email` index). Enforces no duplicate
  usernames (FR-005), is the single-document lookup key for login, and closes the
  registration race via the duplicate-key (`11000`) error → `409`.
- (Implicit `_id` index.)

> **Legacy index note (dev only)**: the app creates `username_1` on first use but does **not**
> drop the old `email_1` index. In a development database that already has `email_1`, drop it
> manually (see [quickstart.md](./quickstart.md)); production is assumed empty (research
> Decision 5).

### Public projection (API view)

`PublicUser` = **`{ id, username, displayName }`** (was `{ id, email, displayName }`).
`passwordHash`, `status`, `failedLoginCount`, and `lockedUntil` are **never** serialized to
clients.

### State transitions

Unchanged from feature 002 (identity change does not affect the lifecycle):

```text
(register) ──▶ active ──(N consecutive failed logins)──▶ active + lockedUntil set (temporary)
                  ▲                                             │
                  └──────────(successful login clears)──────────┘
active ──(admin/ops action, out of scope UI)──▶ disabled ──▶ authentication refused
```

---

## Collection: `sessions` (unchanged)

No changes. Sessions remain keyed by `SHA-256(token)` with `userId`, `createdAt`,
`lastActivityAt`, and a TTL-backed `expiresAt`, referenced by an opaque HttpOnly cookie. See
[../002-user-auth-session/data-model.md](../002-user-auth-session/data-model.md).

---

## Relationships (unchanged)

```text
users (1) ───────────< (N) sessions
   _id  ◀────────────────  userId
```

---

## Shared type changes (`shared/types/index.ts`)

**Changed:**

- `PublicUser` — the `email: string` field becomes **`username: string`** (with an updated
  doc-comment describing the alphanumeric, unique login identifier). The `id` and `displayName`
  fields are unchanged.

**Unchanged:** `AuthResponse` (`{ user: PublicUser }`), `HealthReport`, `ComponentStatus`,
`ApiError`. `frontend/src/types/index.ts` re-exports `PublicUser` and needs no edit (the field
change flows through automatically).

No secret or hash fields ever appear in shared/public types.
