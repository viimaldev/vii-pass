# Data Model: Chord Credential Fields

**Feature**: 009-chord-credential-fields | **Date**: 2026-07-11

## Overview

One existing collection changes shape: `chords`. The `sections` collection and the
chord's placement model (`userId` scoping, `sectionId` parent, integer `position`
rewritten 0..n-1 on reorder) are **unchanged**. Placeholder documents are dropped, not
migrated (research Decision 5).

## Entities

### ChordFieldType (shared enum)

```
'username' | 'email' | 'password' | 'other' | 'otherSensitive'
```

| Type            | Sensitive (masked on card) | Card controls        |
|-----------------|----------------------------|----------------------|
| `username`      | No                         | copy                 |
| `email`         | No                         | copy                 |
| `password`      | **Yes**                    | eye (reveal/hide) + copy |
| `other`         | No                         | copy                 |
| `otherSensitive`| **Yes**                    | eye (reveal/hide) + copy |

Sensitivity is a fixed property of the type (derived, never stored per row).

### ChordField (embedded, exactly 3 per chord)

| Field   | Type             | Rules                                             |
|---------|------------------|---------------------------------------------------|
| `type`  | `ChordFieldType` | Required; defaults in the form UI: row 1 `username`, row 2 `password`, row 3 `other` |
| `value` | `string \| null` | Trimmed; `''` → `null` (row unused); ≤ 200 chars  |

A row with `value: null` is valid ("unused") and is not rendered on the card, but its
`type` is persisted so the edit form re-opens with the same dropdown selections.

### Chord (document in `chords`, public shape in shared types)

| Field             | Type            | Rules / Notes                                                    |
|-------------------|-----------------|------------------------------------------------------------------|
| `_id` / `id`      | ObjectId / string | Server-generated                                               |
| `userId`          | ObjectId        | Owner; **every query filters on it** (internal only)             |
| `sectionId`       | ObjectId / string | Parent section; must be owned by `userId`                      |
| `position`        | int             | 0-based order within section (unchanged behavior)                 |
| `title`           | string          | **Required.** Trimmed, 1–100 chars; display casing preserved      |
| `titleNormalized` | string          | Internal only: `title.trim().toLowerCase()`; drives uniqueness    |
| `url`             | string \| null  | Optional. Normalized absolute `http(s)` URL ≤ 2048 chars, or null |
| `fields`          | `ChordField[3]` | Exactly 3 entries, always                                         |
| `createdAt`       | string (ISO)    | Immutable (internal only)                                         |
| `updatedAt`       | string (ISO)    | Touched on every update (internal only)                           |

Public projection (`toPublicChord`): `{ id, sectionId, position, title, url, fields }` —
`userId`, `titleNormalized`, timestamps never leave the server.

## Validation Rules (API boundary, Zod)

- **title**: `string` → trim → min 1 ("Title is required.") → max 100.
- **titleNormalized**: derived server-side; never accepted from the client.
- **url**: optional/nullable `string` → trim → `''` becomes `null`; if non-null:
  prepend `https://` when no scheme present, must parse via `new URL()` with protocol
  `http:`/`https:` (else "Enter a valid web address."), max 2048 after normalization.
- **fields**: array, `.length(3)`; each `{ type: z.enum([...5 types]), value: string ≤ 200 | null }`,
  value trimmed with `''` → `null`.

## Uniqueness & Indexes

| Index                                             | Kind     | Purpose                                  |
|---------------------------------------------------|----------|------------------------------------------|
| `{ userId: 1, sectionId: 1, position: 1 }`        | regular  | Ordered listing (existing, recreated)     |
| `{ userId: 1, sectionId: 1, titleNormalized: 1 }` | **unique** | Duplicate-title race backstop (new)     |

- Service pre-check on create: `findOne({ userId, sectionId, titleNormalized })` →
  `409 chord_title_taken` ("A chord with this title already exists in this section.").
- On update: same query with `_id: { $ne: chordId }` — a chord never conflicts with
  itself (FR-014), so casing-only renames succeed.
- Unique-index violation (concurrent race) is caught and mapped to the same 409.

## State Transitions

- **Create** → document inserted with `position = count` (append), all validation above.
- **Update (PATCH)** → title/url/fields replaced wholesale from the validated payload;
  `titleNormalized` recomputed; `updatedAt` touched; `position`/`sectionId` untouched.
- **Reorder / Delete** → unchanged from feature 006 (positions rewritten 0..n-1).
- **Reveal/mask** → client-side view state only; never persisted.

## Migration

None. `db.chords.drop()` clears placeholder-era documents and old indexes; the service
recreates both indexes lazily on first use (existing `indexesEnsured` pattern).
