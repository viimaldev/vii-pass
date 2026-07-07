# Phase 1 Data Model: User Authentication & Session Management

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-07-06

Persistence is MongoDB Atlas, database **`vii_pass`**. This feature adds two collections —
**`users`** and **`sessions`** — accessed through the native `mongodb` driver with Zod
validation at the API boundary (per [research.md](./research.md)). Internal documents use
MongoDB `ObjectId`; the API serializes ids to strings and never returns secret material.

---

## Collection: `users`

A person who can authenticate. Password material is stored **only** as a salted, adaptive
hash (research Decision 1) — never plaintext.

### Document shape (internal)

| Field | Type | Constraints / Notes |
|-------|------|---------------------|
| `_id` | `ObjectId` | Primary key; serialized to `id` in API responses. |
| `email` | `string` | **Unique**, lowercased, trimmed, valid email format. Login identifier. |
| `displayName` | `string` | Trimmed, 1–100 chars. Shown on the home page and user menu. |
| `passwordHash` | `string` | Encoded hash string: `pbkdf2$sha256$<iterations>$<saltB64url>$<hashB64url>`. Captures algorithm + work factor + salt so the factor can be raised later. Never returned by the API. |
| `status` | `'active' \| 'disabled'` | Only `active` users may authenticate (FR: disabled → refused). Defaults to `active`. |
| `failedLoginCount` | `number` | Consecutive failed logins; reset to 0 on success (throttling backstop, research Decision 6). Defaults to 0. |
| `lockedUntil` | `string \| null` | ISO-8601; while `now < lockedUntil`, login is refused with `429`. Defaults to `null`. |
| `createdAt` | `string` | ISO-8601 creation timestamp (immutable). |
| `updatedAt` | `string` | ISO-8601 last-update timestamp. |

### Validation rules (Zod, at the boundary)

- **Registration input**: `email` valid + normalized to lowercase; `displayName` trimmed,
  1–100 chars, required; `password` **min 12 chars** (NIST length-first), max 200.
- **Login input**: `email` present + normalized; `password` present (no strength check on
  login — only verification).
- `passwordHash` is produced server-side only; it is never accepted from a client.

### Indexes

- `email` — **unique** (enforces no duplicate accounts, FR-019; closes the registration race).
- (Implicit `_id` index.)

### Public projection (API view)

`PublicUser` = `{ id, email, displayName }`. `passwordHash`, `status`, `failedLoginCount`,
and `lockedUntil` are **never** serialized to clients.

### State transitions

```text
(register) ──▶ active ──(N consecutive failed logins)──▶ active + lockedUntil set (temporary)
                  ▲                                             │
                  └──────────(successful login clears)──────────┘
active ──(admin/ops action, out of scope UI)──▶ disabled ──▶ authentication refused
```

---

## Collection: `sessions`

An authenticated user's active session (research Decisions 2 & 5). The raw session token is
**never** stored; only its SHA-256 hash is persisted. The raw token lives solely in the
client's HttpOnly cookie.

### Document shape (internal)

| Field | Type | Constraints / Notes |
|-------|------|---------------------|
| `_id` | `ObjectId` | Primary key. |
| `tokenHash` | `string` | **Unique**. SHA-256 (hex) of the high-entropy random session token. Lookup key on every request. |
| `userId` | `ObjectId` | References `users._id`. Indexed for "revoke all sessions for a user". |
| `createdAt` | `string` | ISO-8601 session start. Basis for the **absolute** lifetime. |
| `lastActivityAt` | `string` | ISO-8601; advanced on each authenticated request. Basis for the **sliding** inactivity timeout. |
| `expiresAt` | `Date` | Absolute expiry = `createdAt + SESSION_ABSOLUTE_TTL`. Backs the TTL index. |

### Derived validity (checked on every protected request)

A session is **valid** iff all hold:

1. A document with the presented token's `tokenHash` exists.
2. `now < lastActivityAt + SESSION_IDLE_TTL` (sliding inactivity — default 30 min).
3. `now < expiresAt` (absolute cap — default 24 h).

On a valid request, `lastActivityAt` is updated to `now`. On failure (2) or (3), the session
is treated as expired: it is deleted (or left for the TTL index) and the client receives `401`
with a "session expired" signal.

### Indexes

- `tokenHash` — **unique** (fast, single-document validation lookup; < 200ms budget).
- `userId` — non-unique (logout-all / audit).
- `expiresAt` — **TTL index** (`expireAfterSeconds: 0`) so MongoDB auto-purges sessions at
  their absolute expiry without a cron (research Decision 5). Note: the TTL reaper enforces the
  absolute cap; the sliding inactivity check is enforced in application code on each request.

### Lifecycle

```text
login / register success
        │  generate 32-byte random token → tokenHash = SHA-256(token)
        ▼
  insert sessions doc (createdAt, lastActivityAt = now, expiresAt = now + ABSOLUTE_TTL)
        │  Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Lax; Max-Age=…
        ▼
  each protected request → hash cookie token → lookup → validate (idle + absolute)
        │  valid → advance lastActivityAt, proceed
        │  invalid/expired → 401, clear cookie
        ▼
  logout → delete sessions doc by tokenHash → clear cookie (SC-003: reuse denied)
```

---

## Relationships

```text
users (1) ───────────< (N) sessions
   _id  ◀────────────────  userId
```

- One user may have multiple concurrent sessions (multi-device, spec edge case). Logging out
  on one device deletes only that session document; other sessions remain valid until they
  expire (matches the concurrent-sessions edge case).

---

## Shared type changes (`shared/types/index.ts`)

**Added:**

- `PublicUser` — `{ id: string; email: string; displayName: string }`.
- `AuthResponse` — `{ user: PublicUser }` (returned by register/login/me; the session travels
  in the cookie, not the body).

**Removed (demo cleanup, FR-012 / research Decision 9):**

- `StoredRecord`, `RecordListResponse`, `FileAssetMeta`.

**Changed:**

- `HealthReport.components` drops `storage`; becomes `{ api: 'ok'; database: ComponentStatus }`.
  `status` remains `'ok' | 'degraded' | 'down'`.

No secret or hash fields ever appear in shared/public types.
