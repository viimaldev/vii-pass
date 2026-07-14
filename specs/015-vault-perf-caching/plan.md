# Implementation Plan: Vault Performance — Single Upfront Load & Client Caching

**Branch**: `topic/vii-1016-vault-perf-caching` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-vault-perf-caching/spec.md`

## Summary

Replace the current two-phase, per-section fetch pattern (one `GET /api/sections`, then
one `GET /api/sections/:id/chords` on every tab switch and on unlock) with a single
upfront vault load. A new session-protected, read-only endpoint `GET /api/vault` returns
the user's complete organizer — all sections plus all chords (flat, each carrying its
`sectionId`) — in one response, reusing the existing services (including lazy "Mine"
provisioning and per-field Level-2 unwrap). The frontend `VaultProvider` loads this once
per signed-in page visit, keeps it in React memory only, derives the visible chord list
by filtering on the selected section (instant switching, zero requests), re-decrypts
from the cached L1 envelopes on unlock (no re-download), and updates the cache in place
from each mutation's response (no follow-up list fetches). Browser refresh naturally
discards the in-memory cache and re-loads fresh from the server. Zero new dependencies;
no changes to encryption, roles, or any mutation route.

## Technical Context

**Language/Version**: TypeScript 5.x everywhere (strict mode)

**Primary Dependencies**: Backend: Hono on Cloudflare Workers, official `mongodb`
driver, Zod. Frontend: React 18 + Vite, Bootstrap 5.3 (CSS only). No new dependencies.

**Storage**: MongoDB — existing `sections` and `chords` collections, unchanged schema.
Client cache: React state/refs in memory only — explicitly **no** localStorage /
sessionStorage / IndexedDB for vault data (FR-006).

**Testing**: No unit tests (constitution II). Manual verification via quickstart.md +
browser DevTools network panel (request-count assertions are the core acceptance check).

**Target Platform**: Cloudflare Workers (API) + modern evergreen browsers (SPA),
mobile → desktop viewports.

**Project Type**: Web application (existing `backend/` + `frontend/` + `shared/`).

**Performance Goals**: Section switch renders from cache in < 100 ms with 0 network
requests (SC-001). Full session = 1 vault load + 1 request per mutation (SC-002).
Initial vault load viewable < 2 s for ≤ 10 sections / ≤ 200 chords on broadband
(SC-003), within the constitution's default p95 < 200 ms API / < 2 s interactive
budgets for the single load.

**Constraints**: Vault data memory-only for the page visit; discarded on sign-out/401
(FR-006). Refresh is the multi-device sync point (accepted staleness, spec assumption).
Crypto boundary stays exclusively in `VaultContext` — cached envelopes never leave it.
Server stays stateless (no server-side caching layer).

**Scale/Scope**: Personal vaults — hundreds of entries max, no pagination. ~200 chords
× 4 encrypted values = ~800 AES-GCM unwraps per load on the Worker and ~800 decrypts
in the browser, both well within Web Crypto throughput.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|---|---|---|
| I. Code Quality | Removes the per-section fetch path and its now-dead client/server code (constitution forbids dead code); new endpoint mirrors the existing router → service → schema layering; JSDoc on all new exports; lint-clean. | PASS |
| II. Testing Standards | No unit tests added. Verification = manual quickstart with DevTools request counting (the feature's essence is observable network behavior). | PASS |
| III. UX Consistency | No new UI surfaces. Loading indicator shown only on the initial load (existing spinner pattern); section switches become instant — an improvement in consistency. Existing error-message patterns reused verbatim (FR-005). Responsive behavior untouched but re-verified at mobile/tablet/desktop in quickstart. | PASS |
| IV. Performance Requirements | Budgets defined up front (SC-001…SC-003, Technical Context). Validated by measurement in quickstart (DevTools timing + request counts), not speculation. | PASS |
| V. Scalability & Maintainability | Server remains stateless; the aggregate read composes two existing service calls behind one route. Client cache is a natural extension of the existing single `VaultProvider` owner — no new state library, no new abstraction layers (YAGNI). | PASS |

**Post-Phase-1 re-check**: design introduces one new GET route, one new service
function, one shared response type, and refactors one provider — no violations. Gate
remains PASS.

## Project Structure

### Documentation (this feature)

```text
specs/015-vault-perf-caching/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── vault-api.md     # Phase 1 output — GET /api/vault contract
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
└── src/
    ├── index.ts                     # MODIFIED — mount vaultRouter at /api/vault
    ├── routes/
    │   ├── vault.ts                 # NEW — GET /api/vault (session-protected, read-only)
    │   ├── sections.ts              # unchanged
    │   └── chords.ts                # MODIFIED — remove GET /:sectionId/chords list route (dead after this feature)
    └── services/
        ├── sections.service.ts      # unchanged (listSections reused — keeps "Mine" provisioning)
        └── chords.service.ts        # MODIFIED — add listAllChords(env, userId); remove listChords (dead)

shared/
└── types/
    └── index.ts                     # MODIFIED — add VaultResponse; ChordsResponse retained (reorder still uses it)

frontend/
└── src/
    ├── services/
    │   └── vaultApi.ts              # MODIFIED — add loadVault(); remove listChords()
    └── vault/
        └── VaultContext.tsx         # MODIFIED — single-load cache, derived per-section
                                     #   chords, envelope cache + unlock re-decrypt,
                                     #   mutation-applied updates, no per-switch fetch
```

**Structure Decision**: Existing three-package web layout (`backend/`, `frontend/`,
`shared/`) is retained. All changes are additive-or-replacing within the files listed
above; no new directories. `ChordCard`, `ChordGrid`, `HomePage`, dialogs, and all auth
code are untouched — the provider's public context shape stays compatible (see
data-model.md).

## Complexity Tracking

> No constitution violations — table not applicable.
