# API Contract: Vault Aggregate Read

**Feature**: 015-vault-perf-caching | **Date**: 2026-07-14

One new endpoint; one endpoint retired. All other section/chord routes — and every
mutation route — are byte-for-byte unchanged from features 006/009/010/011.

## GET /api/vault  (NEW)

Returns the authenticated user's complete organizer in one response: every section and
every chord. This is the SPA's only vault read; it is called once per signed-in page
visit (sign-in or browser refresh).

- **Auth**: valid session cookie required (`requireSession`). Read-only →
  role-agnostic: `admin` and `normal` sessions receive identical data (FR-007).
- **Side effect**: identical to `GET /api/sections` — a user with zero sections gets
  the default "Mine" section lazily provisioned before the response is built.
- **Request**: no parameters, no body.

### 200 OK

```jsonc
// VaultResponse (shared/types)
{
  "sections": [
    // Section[] — ALL sections, sorted by position ascending (0..n-1)
    {
      "id": "665f0c…",
      "name": "Mine",
      "color": "#4F7CAC",
      "position": 0,
      "isDefault": true
    }
  ],
  "chords": [
    // Chord[] — ALL chords across every section, flat,
    // sorted by (sectionId, position)
    {
      "id": "665f0d…",
      "sectionId": "665f0c…",
      "position": 0,
      "title": "GitHub",                    // plaintext (listing/uniqueness)
      "url": "v1.l1.<iv>.<ct>",             // L1 envelope | null | "v1.err"
      "fields": [
        { "type": "username", "value": "v1.l1.<iv>.<ct>" },
        { "type": "password", "value": "v1.l1.<iv>.<ct>" },
        { "type": "other",    "value": null }             // unused row
      ]
    }
  ]
}
```

Guarantees:

- Every `chords[].sectionId` matches a section in `sections`.
- Per section, chord `position`s are contiguous 0..n-1.
- Secret values are Level-1 envelopes only (L2 removed server-side); a storage-layer
  unwrap failure yields the `"v1.err"` sentinel for that field alone.
- An account with no chords returns `"chords": []`; a brand-new account returns the
  provisioned "Mine" section and an empty chord list.

### Errors

| Status | Body `error` | When |
|---|---|---|
| 401 | `unauthorized` | Missing/invalid/expired session (existing shape) |
| 500 | `internal` | Unexpected failure (existing shape) |

No 403: reads are permitted for both roles.

## GET /api/sections/:sectionId/chords  (RETIRED)

Removed along with its `listChords` service function and the frontend `listChords()`
client. Superseded by `GET /api/vault`; nothing in the codebase calls it after this
feature (research D5). Requests to it return the router's standard 404.

## Unchanged routes (reference)

| Route | Notes |
|---|---|
| `GET /api/sections` | Unchanged (still exists; SPA no longer calls it on vault load) |
| `POST /api/sections`, `POST /api/sections/reorder`, `PATCH/DELETE /api/sections/:id` | Unchanged, admin-only |
| `POST /api/sections/:id/chords`, `POST /api/sections/:id/chords/reorder` | Unchanged, admin-only |
| `PATCH /api/chords/:id`, `DELETE /api/chords/:id` | Unchanged, admin-only |
| All `/api/auth/*` | Unchanged |

## Client-side contract (SPA request budget)

| User action | Allowed requests |
|---|---|
| Open vault (sign-in or refresh) | exactly 1 × `GET /api/vault` |
| Switch section (any number of times) | 0 |
| Unlock vault | 0 vault-data requests |
| Create / edit / delete / reorder (section or chord) | exactly 1 (the mutation itself) — no follow-up list fetch |
| Sign-out | auth logout only; all cached vault data discarded |
