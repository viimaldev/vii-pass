# Phase 1 Data Model: UI Fixes & Polish

This feature is **presentation + one validation rule**; it introduces **no new entities** and
**no schema changes**. The only data-level change is a uniqueness invariant on an existing
field.

## Affected Entities

### Section (existing — `sections` collection)

No field added or removed. New/clarified rules for this feature:

| Field | Type | Rule change |
|-------|------|-------------|
| `name` | string | **Trimmed on write.** Must be **unique per `userId`, compared case-insensitively** (lowercased) and whitespace-trimmed. Existing length rule (1–50 chars) unchanged. |

- **Invariant (new)**: For a given `userId`, no two sections may have names that are equal
  after `trim()` + `toLowerCase()`. Enforced in `createSection` (see contract).
- **Scope**: Applies to newly created sections. The auto-provisioned default **Mine** section
  is unaffected (it is created only when the user has zero sections).
- **Error**: Violations return `409 section_exists` with message
  "A section with that name already exists." No document is written.

### Chord (existing — `chords` collection)

No data change. Delete semantics are unchanged server-side; the confirmation requirement
(FR-010) is a **client-side UX gate** before the existing delete request is sent.

## State / Validation Notes

- Duplicate detection is **not** applied to reorder or (future) rename paths in this feature —
  only to `createSection`, matching the spec (FR-013 concerns *adding* a section).
- No migration required: existing data is untouched; the rule only constrains future inserts.
