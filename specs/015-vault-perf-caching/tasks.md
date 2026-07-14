# Tasks: Vault Performance — Single Upfront Load & Client Caching

**Input**: Design documents from `/specs/015-vault-perf-caching/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/vault-api.md, quickstart.md

**Tests**: Per the project Constitution (Principle II), NO unit-test tasks are generated. Verification is manual via quickstart.md (DevTools request counting is the core acceptance check).

**Organization**: Tasks are grouped by user story. US1 (single load + instant switching) is the MVP and the structural foundation; US2 and US3 build on the cache it introduces.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1, US2, US3 — maps to spec.md user stories
- Include exact file paths in descriptions

## Path Conventions

Web app layout per plan.md: `backend/src/`, `frontend/src/`, `shared/types/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the baseline before touching the load path — no project init or new dependencies are needed for this feature.

- [X] T001 Verify the local dev stack runs (`npm run dev` from repo root: Worker on :8787 with `MONGODB_URI`/`VAULT_ENC_KEY` in `backend/.dev.vars`, Vite on :5173) and sign in with an admin account that has 3+ sections and several chords per section (create via UI if needed) — this is the baseline dataset every quickstart check uses

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared wire type that both the backend endpoint and the frontend client compile against.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Add `VaultResponse { sections: Section[]; chords: Chord[] }` interface with JSDoc to shared/types/index.ts next to the existing `SectionsResponse`/`ChordsResponse` (per data-model.md: all sections position-sorted; all chords flat, `(sectionId, position)`-sorted, values as L1 envelopes/null/`"v1.err"`); keep `ChordsResponse` (still used by chord reorder) and run `npm run build -w shared` to confirm it compiles

**Checkpoint**: Shared type available — user story implementation can begin.

---

## Phase 3: User Story 1 - One upfront load, instant section switching (Priority: P1) 🎯 MVP

**Goal**: One `GET /api/vault` request loads the entire organizer; section switches render instantly from memory with zero requests; browser refresh always re-fetches fresh data; loading indicator appears only during the initial load.

**Independent Test**: Quickstart §1–§3 — sign in with 3+ populated sections: exactly one `GET /api/vault` on load (no `GET /api/sections`, no per-section chord GETs); clear the Network log and switch tabs repeatedly → zero requests, no spinner; edit from a second session, refresh → change appears after one fresh `GET /api/vault`.

### Implementation for User Story 1

- [X] T003 [US1] Add `listAllChords(env, userId): Promise<Chord[]>` to backend/src/services/chords.service.ts with JSDoc: `find({ userId: new ObjectId(userId) })` sorted `{ sectionId: 1, position: 1 }` (prefix of the existing `{userId, sectionId, position}` index), mapped through the existing `toPublicChord` so L2 unwrap + per-field `"v1.err"` isolation match the retired list path exactly (research D1)
- [X] T004 [US1] Create backend/src/routes/vault.ts — new `vaultRouter = new Hono<AppEnv>()` with `requireSession` (NO `requireAdmin`: reads are role-agnostic, FR-007) and a single `GET /` that calls `listSections(c.env, user.id)` (preserves lazy "Mine" provisioning) then `listAllChords(c.env, user.id)` and returns `c.json({ sections, chords } satisfies VaultResponse)`; JSDoc mirroring the sections router style (contracts/vault-api.md)
- [X] T005 [US1] Mount the vault router in backend/src/index.ts at `/api/vault`, following the existing `sectionsRouter`/`chordsRouter` mount pattern
- [X] T006 [P] [US1] In frontend/src/services/vaultApi.ts add `loadVault(): Promise<VaultResponse>` (`get<VaultResponse>('/api/vault')`) with JSDoc noting it is the SPA's only vault read, and delete the now-dead `listChords()` function and the `ChordsResponse` import if unused (research D5)
- [X] T007 [US1] Refactor frontend/src/vault/VaultContext.tsx to the single-load cache (data-model.md client state model): replace the sections-only load effect with one `vaultApi.loadVault()` per signed-in user — store raw response chords in a new `envelopesRef` (`useRef<Chord[]>`, never exposed via context), decrypt all chords with the current `vaultKey` via the existing `decryptChord` into new `allChords` state, set `sections`, `ready`, `loading` around the whole load; clear `envelopesRef`/`allChords` in the existing sign-out cleanup branch (FR-006)
- [X] T008 [US1] In frontend/src/vault/VaultContext.tsx derive the visible list and delete the per-section fetch path: replace `chords` state usage with `const chords = useMemo(() => allChords.filter(c => c.sectionId === selectedId).sort((a, b) => a.position - b.position), [allChords, selectedId])`; delete `loadChords`, the `[selectedId, loadChords]` effect, and stop setting `chordsLoading` on section switch (keep the context member, permanently `false` after load — `VaultContextValue` shape unchanged, FR-002/FR-009); update the provider JSDoc to describe the memory-only cache and refresh-as-sync-point model
- [X] T009 [US1] Verify quickstart.md §1–§3 and §6: one `GET /api/vault` on sign-in (admin AND normal role — normal gets 200, not 403), zero requests across repeated section switches (< 100 ms perceived), refresh picks up out-of-band changes; confirm lint passes (`npm run lint`) and both workspaces build

**Checkpoint**: MVP — vault loads once, switching is instant, refresh is fresh. Mutations still work via their existing handlers (they update `allChords` incorrectly only for reorder — fixed in US2).

---

## Phase 4: User Story 2 - Changes update the local view without refetching (Priority: P2)

**Goal**: Every create/edit/delete/reorder sends exactly one request and patches the cached stores (`allChords` + `envelopesRef`) from its own response — no follow-up list fetches; failures show existing error messages and never fake success.

**Independent Test**: Quickstart §4 — with the Network log cleared before each action: create, edit, reorder, delete a chord and create/rename/reorder/delete a section; each shows exactly one request and an immediate correct UI update; offline edit shows the existing error; reorder keeps secret values revealable.

### Implementation for User Story 2

- [X] T010 [US2] Update chord create/edit/delete in frontend/src/vault/VaultContext.tsx (`handleSaveChord`, `handleDeleteChord`) to maintain BOTH stores: create → append response envelope chord to `envelopesRef.current` and `{ ...created, ...plain }` to `allChords`; edit → replace the matching id in both stores (envelope from response, plaintext merge for state — existing "keep what the user typed" pattern); delete → filter the id from both stores (data-model.md state transitions)
- [X] T011 [US2] Fix `reorderChords` in frontend/src/vault/VaultContext.tsx: keep the optimistic local reorder of the selected section's chords inside `allChords`, then on response apply ONLY the returned `position` values onto the existing decrypted chords and onto `envelopesRef.current` — never replace state with the response's envelope chords (fixes the reorder-clobbers-plaintext bug, research D4); on failure keep the existing error message and restore a server-consistent order (FR-005)
- [X] T012 [US2] Update section handlers in frontend/src/vault/VaultContext.tsx: `handleDeleteSection` additionally removes the deleted section's chords from both `allChords` and `envelopesRef.current` (cascade mirror); confirm `handleSaveSection`/`reorderSections` still update `sections` purely from their responses with no list refetch (FR-004)
- [X] T013 [US2] Verify quickstart.md §4 (all 8 steps): one request per action with no follow-up GETs, reorder-then-reveal regression check, offline failure path, duplicate-title 409 path; run `npm run lint`

**Checkpoint**: US1 + US2 — full CRUD keeps the cache correct with exactly one request per action.

---

## Phase 5: User Story 3 - Locked vault unlocks without re-downloading (Priority: P3)

**Goal**: A locked vault shows structure from the single load; unlocking re-decrypts the cached envelopes in place — zero vault-data requests.

**Independent Test**: Quickstart §5 — delete the persisted key from IndexedDB, refresh (one `GET /api/vault`, values locked, switching instant), clear the Network log, unlock → values become readable with zero vault-data requests.

### Implementation for User Story 3

- [X] T014 [US3] Add an unlock re-decrypt effect in frontend/src/vault/VaultContext.tsx: when `vaultKey` transitions null → key after the initial load (`ready`), re-run `decryptChord` over `envelopesRef.current` and replace `allChords` — no network call (research D3); guard against overlapping runs/stale results with the existing `active`-flag pattern, and make the initial-load decrypt produce `VALUE_LOCKED` sentinels when the vault is locked so structure/titles remain browsable (FR-008)
- [X] T015 [US3] Verify quickstart.md §5: locked load shows sections + titles with masked values and instant switching; unlock reveals values with zero vault-data requests; sign-out then back-navigation shows no vault content

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Dead-code removal (Constitution I), final budget measurements, and full-surface verification.

- [X] T016 [P] Retire the per-section read path on the backend (research D5): delete the `GET /:sectionId/chords` list route from backend/src/routes/chords.ts and the `listChords` service function from backend/src/services/chords.service.ts (keep create/reorder/patch/delete untouched); confirm `curl` of the removed route returns 404 (quickstart §9)
- [X] T017 [P] Sweep for leftovers: `ChordsResponse` import usage across frontend/backend (retained only where reorder needs it), no remaining references to `listChords`/per-section fetch in comments or JSDoc (update stale doc comments in frontend/src/services/vaultApi.ts and frontend/src/vault/VaultContext.tsx); run `npm run lint` and full builds for backend, frontend, and shared workspaces
- [X] T018 Measure the performance budgets (Constitution IV, quickstart §8): seed ~10 sections / ~200 chords, hard-refresh → vault viewable < 2 s on broadband; section switch < 100 ms; record measurements in the PR description
- [X] T019 Responsive + storage audit (quickstart §7–§8): verify vault behavior at 320 px / 768 px / desktop widths (spinner, tabs, instant switching, no layout regressions); confirm DevTools → Application shows no vault data in localStorage/sessionStorage/IndexedDB after sign-out (SC-006)
- [X] T020 Run the complete quickstart.md end-to-end (§1–§9) as the final acceptance pass on the feature branch

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: none — start immediately
- **Phase 2 (Foundational)**: after T001 — T002 BLOCKS all stories (both sides compile against `VaultResponse`)
- **Phase 3 (US1)**: after T002 — the structural refactor every later story builds on
- **Phase 4 (US2)**: after US1 (T007–T008 introduce the two stores US2 patches)
- **Phase 5 (US3)**: after US1 (needs `envelopesRef`); independent of US2
- **Phase 6 (Polish)**: T016/T017 after all stories; T018–T020 last

### Task-level notes

- T003 → T004 → T005 (service → route → mount); T006 is [P] with T003–T005 (frontend file)
- T007 → T008 (same file, sequential); both after T005 + T006
- T010 → T011 → T012 (same file, sequential); T014 same file, after T008 (may precede or follow US2)
- T016 and T017 are [P] with each other (different files)

### Parallel Opportunities

- T006 (frontend api client) alongside T003–T005 (backend)
- Phase 5 (T014) can proceed in parallel with Phase 4 by a second developer IF they coordinate on VaultContext.tsx — otherwise run sequentially (same file)
- T016 ∥ T017 in Polish

## Parallel Example: User Story 1

```bash
# After T002, run backend and frontend prep concurrently:
Task A: T003 → T004 → T005  (backend: service fn, vault route, mount)
Task B: T006                (frontend: vaultApi.loadVault + remove listChords)
# Then sequentially in VaultContext.tsx:
T007 → T008 → T009
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 → T002 (setup + shared type)
2. T003–T008 (endpoint + provider refactor)
3. T009: **STOP and VALIDATE** — quickstart §1–§3, §6 (request counts are the acceptance test)
4. Deployable: mutations still function through existing handlers

### Incremental Delivery

1. US1 → validate → demo (instant switching is the visible win)
2. US2 → validate §4 (one-request mutations + reorder fix)
3. US3 → validate §5 (unlock without re-download)
4. Polish → dead-code removal, budgets, full quickstart pass

---

## Notes

- Nearly all frontend work lands in one file (frontend/src/vault/VaultContext.tsx) by design — it is the single vault-state owner and crypto boundary; tasks there are intentionally sequential
- `VaultContextValue` shape must NOT change — consumers (`Layout`, `HomePage`, `ChordGrid`, dialogs) are untouched by this feature
- No DB schema/index changes, no migration, no new dependencies
- Commit after each task or logical group
