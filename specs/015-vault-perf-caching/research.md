# Research: Vault Performance — Single Upfront Load & Client Caching

**Feature**: 015-vault-perf-caching | **Date**: 2026-07-14

No NEEDS CLARIFICATION markers remained in the Technical Context; the research below
records the design decisions and the alternatives evaluated.

## Decision 1 — Aggregate read endpoint: new `GET /api/vault`

- **Decision**: Add one new session-protected, read-only route `GET /api/vault`
  returning `{ sections: Section[], chords: Chord[] }` — all sections in order plus all
  of the user's chords as a **flat list** sorted by `(sectionId, position)`, each chord
  carrying its existing `sectionId`. Implemented as a new `routes/vault.ts` (mirroring
  the auth/sections/chords router layering) that composes the two existing service
  paths: `listSections(env, userId)` (which keeps the lazy "Mine" auto-provisioning
  exactly as today) and a new `listAllChords(env, userId)` in `chords.service.ts`
  (single `find({ userId })` sorted by `sectionId, position`, then the existing
  per-document L2 unwrap via `toPublicChord`).
- **Rationale**: One request satisfies FR-001 with minimal new code — no schema, no new
  middleware, no write path. A flat chord list avoids inventing a nested
  section-with-chords shape that would duplicate the `Section` type; the client already
  keys chords by `sectionId`. Reads stay role-agnostic (normal-role sessions get the
  same load, FR-007). The existing compound index `{userId, sectionId, position}` serves
  the sorted query with a prefix scan on `userId`.
- **Alternatives considered**:
  - *Extend `GET /api/sections` with `?include=chords`* — rejected: conditional response
    shapes on one route complicate typing (`SectionsResponse` vs a superset) and violate
    the one-clear-responsibility principle; a dedicated route is simpler.
  - *Nested response (`sections[].chords[]`)* — rejected: requires a new nested entity
    type and a regroup on the server for data the client immediately flattens/filters
    anyway.
  - *Bundle vault data into the login response* — rejected: spec assumption explicitly
    interprets "first request" as the vault-surface load; login must stay lean and the
    vault also loads on refresh of an already-authenticated session, where there is no
    login call.
  - *Fan-out N+1 on the client (fetch all sections' chords in parallel at startup)* —
    rejected: still N+1 requests against a Worker + MongoDB (violates FR-001's single
    load and SC-002's request budget).

## Decision 2 — Client cache: in-memory React state inside the existing `VaultProvider`

- **Decision**: `VaultProvider` performs one `loadVault()` per signed-in page visit
  (the existing `[user]`-keyed effect). It stores: `sections` (as today), `allChords`
  — the full decrypted chord list — in React state, and the **raw L1 envelope copies**
  in a `useRef` (see Decision 3). The chord list the UI sees becomes a `useMemo`
  derivation: `allChords.filter(c => c.sectionId === selectedId)` sorted by `position`.
  The `selectedId`-keyed fetch effect and `loadChords` are deleted; `chordsLoading` is
  no longer set on section switch (FR-002, FR-009). Sign-out/401 clears everything, as
  the existing effect already does (FR-006).
- **Rationale**: The provider is already the single owner of vault state and the single
  crypto boundary — extending it keeps one source of truth and zero new abstractions.
  Plain React state is memory-only by construction, satisfying FR-006 without any
  storage-scrubbing logic. Browser refresh trivially yields a fresh server load
  (FR-003).
- **Alternatives considered**:
  - *TanStack Query / SWR cache layer* — rejected: new dependency for a single cached
    query; constitution V (YAGNI) and the project's zero-new-deps habit.
  - *sessionStorage-backed cache to survive refresh* — rejected: FR-003 requires
    refresh to re-fetch, and FR-006 forbids persistent storage of vault data (secrets
    in storage would weaken the E2E posture of feature 010).
  - *Per-section lazy cache (fetch a section's chords once, then cache)* — rejected:
    still one visible loading delay per first visit to each section; the user's stated
    intent is everything upfront.

## Decision 3 — Unlock without re-download: cache envelopes, re-decrypt in place

- **Decision**: Keep the encrypted chords exactly as received from `loadVault()` in a
  `useRef` inside `VaultContext` (never exposed through context). Decryption to UI
  state happens from this envelope cache whenever the vault key changes: on load with
  a present key → plaintext; with a locked vault → `VALUE_LOCKED` sentinels (structure
  and titles are plaintext already, so browsing works, FR-008); on unlock
  (`vaultKey` null → key) → re-run `decryptChord` over the cached envelopes and update
  state — **no network request**. Mutations update both the envelope cache (from the
  API response, which carries envelopes) and the decrypted state (from the plaintext
  the user just typed, preserving the existing "keep what the user typed" pattern).
- **Rationale**: Today unlock re-fetches the selected section (`loadChords` depends on
  `vaultKey`); with all envelopes already in memory, decryption is a purely local
  operation. Keeping envelopes in a ref (not state) avoids re-renders and keeps them
  inside the crypto boundary.
- **Alternatives considered**:
  - *Keep only plaintext, refetch on unlock* — rejected: violates FR-008/US3.
  - *Store envelopes in context state alongside plaintext* — rejected: exposes
    ciphertext shapes to consumers that must never handle them; ref keeps the boundary
    tight.

## Decision 4 — Mutations update the cache from their own responses; reorder keeps local plaintext

- **Decision**: Every mutation keeps its existing single request and updates the cached
  `allChords`/`sections` from the response: create/edit chord merges the response's
  identity/position fields with the just-typed plaintext (existing pattern); delete
  removes locally; section delete also drops that section's chords from `allChords`
  (cascade mirror); section create/edit/reorder update `sections` as today. **Chord
  reorder changes behavior**: instead of replacing state with the response array (which
  contains L1 envelopes and today clobbers decrypted values — a latent bug), apply the
  new `position` values from the response to the already-decrypted local chords, and
  update the envelope cache's positions likewise. Failures keep the existing error
  messages and roll back / re-sync the order display (FR-004, FR-005).
- **Rationale**: Exactly one request per action (SC-002/SC-004) and no follow-up list
  fetch. Fixing the reorder-clobbers-plaintext behavior is in scope because the new
  cache makes response-replacement incorrect by design.
- **Alternatives considered**:
  - *Refetch the vault after every mutation* — rejected: defeats the feature (FR-004).
  - *Full optimistic UI with rollback journals* — rejected: existing code already does
    lightweight optimism for reorders and pessimism elsewhere; a general rollback
    framework is YAGNI.

## Decision 5 — Retire the per-section chord list path (client + server)

- **Decision**: Remove `listChords()` from `frontend/src/services/vaultApi.ts` and the
  `GET /api/sections/:sectionId/chords` route + `listChords` service function from the
  backend. All other chord routes (create, reorder, patch, delete) are unchanged.
- **Rationale**: After this feature nothing calls them; the constitution (Principle I)
  mandates removing dead code. The SPA and the API deploy together from one repo/Worker,
  so there is no external consumer to break. Trivial to restore from git history if a
  future feature needs a partial read.
- **Alternatives considered**:
  - *Keep the route "for compatibility"* — rejected: dead surface area that would
    silently drift from the vault-load semantics and still need auth/role review.

## Decision 6 — Performance validation approach

- **Decision**: Validate budgets manually per quickstart.md: (a) DevTools Network —
  exactly one `/api/vault` request at vault open, zero requests across repeated section
  switches, exactly one request per mutation; (b) DevTools Performance/timing — section
  switch paint < 100 ms; (c) seeded vault (10 sections / 200 chords via the UI or a
  temporary seed script) — initial load viewable < 2 s.
- **Rationale**: Constitution IV demands measured validation; the observable network
  behavior *is* the requirement here, and request counting is objective and cheap.
  Constitution II discourages investing in automated test suites for this project.
- **Alternatives considered**: automated Playwright network assertions — rejected as
  optional-value-only under constitution II; may be added later for the critical-flow
  budget if regressions occur.
