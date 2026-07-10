# Phase 1 Data Model: Credential Sections & Chords

Two new MongoDB collections in database `vii_pass` (prod) / `vii_pass_preview` (preview &
local). All documents are strictly user-scoped: every query is filtered by `userId`, and a
user can never read or write another user's documents (FR-018).

## Collection: `sections`

Represents a color-coded grouping tab owned by one user.

| Field       | Type               | Notes                                                             |
|-------------|--------------------|-------------------------------------------------------------------|
| `_id`       | ObjectId           | Serialized to `id: string` for clients.                           |
| `userId`    | ObjectId           | Owner (from the session's user id). Required.                     |
| `name`      | string             | Display label. 1–50 chars, trimmed. Not unique per user.          |
| `color`     | string             | Hex `#RRGGBB` (validated). Tab color.                             |
| `position`  | number (int ≥ 0)   | Order within the user's sections. Creation order by default.      |
| `isDefault` | boolean            | `true` only for the auto-provisioned **Mine** section.           |
| `createdAt` | string (ISO-8601)  | Immutable.                                                        |
| `updatedAt` | string (ISO-8601)  | Updated on rename/recolor/reorder.                               |

**Indexes**:
- `{ userId: 1, position: 1 }` — list a user's sections in order.

**Validation rules**:
- `name`: required, 1–50 chars after trim.
- `color`: required, matches `^#[0-9a-fA-F]{6}$`.
- `position`: non-negative integer; server-assigned (append = current count) on create,
  rewritten 0..n-1 on reorder.
- Exactly one `isDefault: true` section per user (the lazily-provisioned **Mine**).

**Lifecycle / state**:
- Auto-provisioned: first list for a user with zero sections creates **Mine**
  (`position: 0`, `isDefault: true`, a fixed brand color).
- Create: append after existing sections (`position = count`), then selected by client.
- Reorder: bulk rewrite of `position` from an ordered id list.
- Delete/rename/recolor beyond create: OUT OF SCOPE for this feature (structure supports it).

## Collection: `chords`

Represents a credential entry tile belonging to exactly one section and one user.

| Field       | Type               | Notes                                                             |
|-------------|--------------------|-------------------------------------------------------------------|
| `_id`       | ObjectId           | Serialized to `id: string`.                                       |
| `userId`    | ObjectId           | Owner. Required. Redundant with the section's owner for safe scoping. |
| `sectionId` | ObjectId           | Parent section. Required.                                         |
| `position`  | number (int ≥ 0)   | Order within the section. Creation order by default.             |
| `field1`    | string \| null     | Placeholder field "1" (optional).                                |
| `field2`    | string \| null     | Placeholder field "2" (optional).                                |
| `field3`    | string \| null     | Placeholder field "3" (optional).                                |
| `createdAt` | string (ISO-8601)  | Immutable.                                                        |
| `updatedAt` | string (ISO-8601)  | Updated on edit/reorder.                                         |

**Indexes**:
- `{ userId: 1, sectionId: 1, position: 1 }` — list a section's chords in order, scoped to owner.

**Validation rules**:
- `sectionId`: must reference a section owned by the same `userId` (verified on create).
- `field1`/`field2`/`field3`: optional strings, each ≤ 200 chars (placeholder cap).
- `position`: non-negative integer; append on create, rewritten 0..n-1 on reorder.

**Lifecycle / state**:
- Create: append to the target section (`position = count in that section`).
- Edit: update the placeholder fields of one chord (owner-scoped).
- Reorder: bulk rewrite of `position` within one section from an ordered id list.
- Delete: OUT OF SCOPE for this feature.

## Relationships

```text
User (1) ──< Section (many)   [Section.userId → User._id]
Section (1) ──< Chord (many)  [Chord.sectionId → Section._id, Chord.userId → User._id]
```

- A user has ≥ 1 section (always at least **Mine**).
- A chord belongs to exactly one section and one user; deleting a section (future) would
  cascade to its chords (out of scope now).

## Client-facing shapes (see `@vii-pass/shared`)

```ts
interface Section {
  id: string;
  name: string;
  color: string;      // #RRGGBB
  position: number;
  isDefault: boolean;
}

interface Chord {
  id: string;
  sectionId: string;
  position: number;
  field1: string | null;
  field2: string | null;
  field3: string | null;
}
```

Secret/owner fields (`userId`, timestamps) are never sent to clients beyond what the
projections above expose.
