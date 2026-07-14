# Quickstart: Vault Performance — Single Upfront Load & Client Caching

**Feature**: 015-vault-perf-caching | **Date**: 2026-07-14

## Prerequisites

- Local stack running: `npm run dev` from the repo root (Worker on :8787, Vite on
  :5173) with `MONGODB_URI` + `VAULT_ENC_KEY` configured in `backend/.dev.vars`.
- An admin-role account with **3+ sections** and several chords per section (create
  via the UI if needed). Keep the paired normal-role username handy for step 6.
- Browser DevTools open on the **Network** tab, filtered to `api`.

## 1. Single upfront load (US1 / FR-001)

1. Sign in and land on the vault.
2. **Expect**: exactly **one** `GET /api/vault` request (and no `GET /api/sections`,
   no `GET /api/sections/*/chords`). The response contains all sections and all
   chords.
3. **Expect**: one loading indicator during this load only; afterwards the first
   section's entries are visible and decrypted.

## 2. Instant section switching (US1 / FR-002, FR-009, SC-001)

1. Clear the Network log. Click through every section tab, repeatedly, in both
   directions.
2. **Expect**: **zero** network requests; entries render instantly (< 100 ms — no
   visible loading state or spinner on any switch).

## 3. Refresh = fresh data (US1 / FR-003, SC-005)

1. In a second browser (or the preview environment), edit a chord title on the same
   account. The first browser must NOT show the change yet (accepted staleness).
2. Refresh the first browser (F5).
3. **Expect**: one new `GET /api/vault`; the change from the other session is now
   visible.

## 4. Mutations: one request, no refetch (US2 / FR-004, FR-005, SC-002, SC-004)

With the Network log cleared before each action, verify **exactly one** request and
an immediate correct UI update — and **no** follow-up `GET`:

1. **Create chord** → 1 × `POST /api/sections/:id/chords`; card appears at the end.
2. **Edit chord** (title + a secret value) → 1 × `PATCH /api/chords/:id`; card
   updates; revealed value shows the new plaintext.
3. **Reorder chords** (drag or keyboard) → 1 × `POST …/chords/reorder`; order
   persists; **secret values still reveal correctly after the reorder** (regression
   check for the reorder-clobber fix, research D4).
4. **Delete chord** → 1 × `DELETE /api/chords/:id`; card disappears.
5. **Create / rename / reorder sections** → 1 request each; tabs update.
6. **Delete a section** → 1 × `DELETE`; its tab AND its cards disappear; other
   sections' entries still render instantly from cache.
7. **Failure path**: stop the Worker (or set DevTools offline), attempt an edit →
   existing error message appears; UI does not show the unsaved change as saved.
   Restore network; retry succeeds.
8. **Duplicate title**: create a chord with an existing title in the same section →
   409 error message shown; no phantom card remains.

## 5. Locked vault & unlock without re-download (US3 / FR-008)

1. Clear the persisted vault key: DevTools → Application → IndexedDB → delete the
   vii-pass key store entry. Refresh.
2. **Expect**: one `GET /api/vault`; sections and chord titles visible; secret values
   masked/locked; switching sections is instant.
3. Clear the Network log. Unlock with the account password (unlock prompt).
4. **Expect**: **zero** vault-data requests (only the auth unlock call, if any);
   values become revealable immediately.

## 6. Read-only role (FR-007)

1. Sign in with the paired normal-role username.
2. **Expect**: one `GET /api/vault` (200 — not 403); instant switching; view, reveal,
   copy all work; mutation controls remain absent.

## 7. Sign-out clears the cache (FR-006, SC-006)

1. Sign out. **Expect**: redirected to login; DevTools → Application shows no vault
   data in localStorage/sessionStorage/IndexedDB (theme preference may remain);
   navigating back does not show vault content.

## 8. Performance budget (SC-003) & responsiveness

1. Seed the account up to ~10 sections / ~200 total chords (UI or temporary script).
2. Hard-refresh with the Network tab open. **Expect**: vault viewable < 2 s on
   broadband; UI responsive during load.
3. Verify the vault at 320 px, 768 px, and desktop widths: initial spinner, tabs, and
   instant switching all behave; no layout regressions (constitution III).

## 9. Retired endpoint

1. `curl -i http://localhost:8787/api/sections/<anyId>/chords` with a valid session
   cookie → **404** (route removed).

## Rollback

Frontend-and-one-route change set: revert the feature commits. No DB migration to
undo — collections and schemas were not touched.
