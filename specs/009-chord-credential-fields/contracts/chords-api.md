# Contract: Chords REST API (revised)

**Feature**: 009-chord-credential-fields | **Date**: 2026-07-11

Routes, verbs, mounting, and session handling are **unchanged** from feature 006; only
the chord payload shape changes. All routes require a valid session cookie
(`401 unauthenticated` otherwise) and operate strictly on the authenticated user's data
(`404 not_found` for anything not owned).

## Shared shapes

```ts
type ChordFieldType = 'username' | 'email' | 'password' | 'other' | 'otherSensitive';

interface ChordField {
  type: ChordFieldType;
  value: string | null;        // trimmed; null = row unused; ≤ 200 chars
}

interface Chord {
  id: string;
  sectionId: string;
  position: number;            // 0-based within section
  title: string;               // 1–100 chars, display casing
  url: string | null;          // normalized absolute http(s) URL or null
  fields: [ChordField, ChordField, ChordField];   // always exactly 3
}
```

## `GET /api/sections/:sectionId/chords`

- **200** `{ "chords": Chord[] }` — ordered by `position`.
- **404** `not_found` — section missing or not owned.

## `POST /api/sections/:sectionId/chords`

Request body:

```json
{
  "title": "GitHub",
  "url": "github.com/login",
  "fields": [
    { "type": "username", "value": "octocat" },
    { "type": "password", "value": "s3cret" },
    { "type": "other", "value": null }
  ]
}
```

- `title` **required**: trim, 1–100 chars.
- `url` optional/nullable: trim; `""` → `null`; scheme-less input gets `https://`
  prepended; must parse as `http:`/`https:` URL; ≤ 2048 chars. Any other scheme
  (`javascript:`, `data:`, …) → 400.
- `fields` **required**: exactly 3 rows; each `type` from the enum, each `value`
  trimmed string ≤ 200 or null.

Responses:

- **201** `{ "chord": Chord }` — appended at end of section (`position = count`).
  Returned `url` is the normalized form.
- **400** `validation_error` — missing/blank title, invalid URL, wrong row count/type.
  Message is field-specific and actionable.
- **409** `chord_title_taken` — another chord in the **same section** has the same
  title case-insensitively (trimmed). Message: "A chord with this title already exists
  in this section."
- **404** `not_found` — section missing or not owned.

## `PATCH /api/chords/:chordId`

Request body: same shape and validation as create (`title`, `url`, `fields` — full
editable state each save; `position`/`sectionId` are not editable here).

- **200** `{ "chord": Chord }` — updated document.
- **400** `validation_error` — as above.
- **409** `chord_title_taken` — conflicts exclude the chord itself, so re-saving its own
  title (including casing-only changes) succeeds.
- **404** `not_found` — chord missing or not owned.

## `POST /api/sections/:sectionId/chords/reorder`

**Unchanged** from feature 006: body `{ "orderedIds": string[] }` (full permutation),
**200** `{ "chords": Chord[] }` in new order (new chord shape), 400 on bad permutation,
404 for unowned section/ids.

## `DELETE /api/chords/:chordId`

**Unchanged**: **204** no body; **404** `not_found`.

## Error envelope

Unchanged: `{ "error": { "code": string, "message": string } }` with human-readable,
non-leaky messages.
