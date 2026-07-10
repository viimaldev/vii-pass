---
description: "Task list for Credential Sections & Chords"
---

# Tasks: Credential Sections & Chords

**Input**: Design documents from `/specs/006-credential-sections-chords/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/openapi.yaml](contracts/openapi.yaml)

**Tests**: Per Constitution Principle II, unit tests are NOT generated. This feature is a
layout/data organizer (not a crypto/auth flow), so no test tasks are included. Verification
is manual via [quickstart.md](quickstart.md) + the lint/typecheck/build gates.

**Organization**: Tasks are grouped by user story. Backend follows the existing
router → service → schema layering (mirroring `auth`); frontend mirrors the
`apiClient`/`AuthContext`/component patterns.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US5 (from spec.md); Setup/Foundational/Polish have no story label

## Path Conventions

Web-app monorepo: `backend/src/`, `frontend/src/`, `shared/types/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared contracts and a place to hang the new UI, before any story logic.

- [X] T001 [P] Add `Section` and `Chord` client-facing interfaces plus request/response shapes (`SectionsResponse`, `SectionResponse`, `ChordsResponse`, `ChordResponse`, `CreateSectionRequest`, `ReorderRequest`, `CreateChordRequest`, `UpdateChordRequest`) to `shared/types/index.ts` per [data-model.md](data-model.md).
- [X] T002 [P] Add section-tab and chord-tile CSS (color-tab, tile grid, dialog/modal, reorder controls) to `frontend/src/styles/tokens.css` using existing design tokens (no one-off styles).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend collections/services and router wiring that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Create `backend/src/services/sections.service.ts`: typed `Collection<SectionDoc>` on the `sections` collection, per-request `getDb`, ensure index `{ userId: 1, position: 1 }`, `toPublicSection` projection, and `isDuplicate`/error helpers (mirror `users.service.ts`).
- [X] T004 [P] Create `backend/src/services/chords.service.ts`: typed `Collection<ChordDoc>` on the `chords` collection, ensure index `{ userId: 1, sectionId: 1, position: 1 }`, `toPublicChord` projection (mirror `users.service.ts`).
- [X] T005 [P] Create `backend/src/schemas/sections.schema.ts`: Zod `createSectionSchema` (name 1–50 trimmed, color `^#[0-9a-fA-F]{6}$`) and `reorderSchema` (`orderedIds: string[]` of ObjectId-shaped strings).
- [X] T006 [P] Create `backend/src/schemas/chords.schema.ts`: Zod `createChordSchema` / `updateChordSchema` (optional `field1`/`field2`/`field3`, each ≤ 200 chars, nullable) and reuse/define `reorderSchema`.
- [X] T007 Create empty routers `backend/src/routes/sections.ts` (`sectionsRouter`) and `backend/src/routes/chords.ts` (`chordsRouter`), each `new Hono<AppEnv>()` with a `requireSession` guard, and mount both behind `/api/*` in `backend/src/index.ts` (`/api/sections`, `/api/chords`). Depends on T003–T006.
- [X] T008 [P] Create the frontend typed client `frontend/src/services/vaultApi.ts` (mirror `apiClient.ts`, `credentials: 'include'`) with functions for list/create/reorder sections, list/create/reorder/edit chords. Depends on T001.

**Checkpoint**: Foundation ready — user stories can now be implemented.

---

## Phase 3: User Story 1 - Browse credentials by section (Priority: P1) 🎯 MVP

**Goal**: A signed-in user sees color-coded section tabs (default **Mine** present) and, on
selecting a tab, the chords of that section.

**Independent Test**: Sign in as a user with existing data; tabs render in creation order
with distinct colors, **Mine** is present, and selecting a tab shows only that section's chords.

- [X] T009 [US1] Implement `listSections` in `backend/src/services/sections.service.ts`: find `{ userId }` sorted by `position`; if none, lazily create the default **Mine** section (`position: 0`, `isDefault: true`, fixed brand color) then return it (FR-002, research Decision 3). Depends on T003.
- [X] T010 [US1] Implement `listChords(userId, sectionId)` in `backend/src/services/chords.service.ts`: verify the section is owned by `userId` (404 otherwise), return chords `{ userId, sectionId }` sorted by `position`. Depends on T004, T009.
- [X] T011 [US1] Add `GET /api/sections` (returns `{ sections }`, auto-provisions **Mine**) to `backend/src/routes/sections.ts` and `GET /api/sections/:sectionId/chords` (returns `{ chords }`) to `backend/src/routes/chords.ts`. Depends on T007, T009, T010.
- [X] T012 [P] [US1] Create `frontend/src/components/ChordCard.tsx`: renders one chord tile (placeholder fields, sized as a tile) — display only for this story. Depends on T001.
- [X] T013 [P] [US1] Create `frontend/src/components/SectionTabs.tsx`: renders the color-coded tab strip (creation order, selected state, horizontally scrollable on mobile) — no `+`/reorder yet. Depends on T001, T002.
- [X] T014 [P] [US1] Create `frontend/src/components/ChordGrid.tsx`: responsive grid of `ChordCard`s for the selected section — no add tile yet. Depends on T012.
- [X] T015 [US1] Rebuild `frontend/src/pages/HomePage.tsx` as the vault surface: on mount fetch sections (auto **Mine**) via `vaultApi`, track selected section, fetch + render that section's chords through `SectionTabs` + `ChordGrid`; handle loading/empty/error states. Depends on T008, T013, T014.

**Checkpoint**: A user can open the app and browse sections + chords. MVP viable.

---

## Phase 4: User Story 2 - Create a new section (Priority: P1)

**Goal**: The trailing **+** tab opens a dialog (name* + random-default color picker); Save
appends and selects the new section; Cancel does nothing.

**Independent Test**: Click **+**, enter a name, Save → new tab appears at the end and is
selected; empty-name Save is blocked; Cancel closes with no change.

- [X] T016 [US2] Implement `createSection(userId, { name, color })` in `backend/src/services/sections.service.ts`: append at `position = current count`, `isDefault: false`, timestamps; return the public section. Depends on T009.
- [X] T017 [US2] Add `POST /api/sections` (validate with `createSectionSchema`, 201 `{ section }`) to `backend/src/routes/sections.ts`. Depends on T011, T016, T005.
- [X] T018 [US2] Create `frontend/src/components/CreateSectionDialog.tsx`: accessible modal (`role="dialog"`, focus trap, Esc) with required Section name, native color picker pre-set to a random palette color, Save/Cancel; blocks Save on empty name. Depends on T002.
- [X] T019 [US2] Wire the trailing **+** tab in `SectionTabs.tsx` and the create flow in `HomePage.tsx`: open `CreateSectionDialog`, POST via `vaultApi`, append the returned section and select it (optimistic reconcile). Depends on T013, T015, T018, T017.

**Checkpoint**: Users can create and select new sections.

---

## Phase 5: User Story 3 - Add a chord to a section (Priority: P1)

**Goal**: A trailing **add chord** tile (same size as a chord) opens a dialog with
placeholder fields 1/2/3; Save appends a chord to the current section.

**Independent Test**: Select a section, click **add chord**, fill fields, Save → a new chord
tile appears at the end; Cancel creates nothing.

- [X] T020 [US3] Implement `createChord(userId, sectionId, fields)` in `backend/src/services/chords.service.ts`: verify section ownership (404 otherwise), append at `position = count in section`; return the public chord. Depends on T010.
- [X] T021 [US3] Add `POST /api/sections/:sectionId/chords` (validate with `createChordSchema`, 201 `{ chord }`) to `backend/src/routes/chords.ts`. Depends on T011, T020, T006.
- [X] T022 [US3] Create `frontend/src/components/AddChordDialog.tsx`: accessible modal with placeholder fields 1/2/3 and Save/Cancel. Depends on T002.
- [X] T023 [US3] Add the trailing **add chord** tile in `ChordGrid.tsx` and wire the flow in `HomePage.tsx`: open `AddChordDialog`, POST via `vaultApi`, append the returned chord to the current section. Depends on T014, T015, T022, T021.

**Checkpoint**: Users can populate sections with chords.

---

## Phase 6: User Story 4 - Reorder sections and chords (Priority: P2)

**Goal**: Drag/keyboard reorder of tabs and chords persists per user; **+** and **add chord**
tiles stay last.

**Independent Test**: Reorder a tab and a chord, reload/re-login → customized order persists.

- [X] T024 [P] [US4] Implement `reorderSections(userId, orderedIds)` in `backend/src/services/sections.service.ts`: validate all ids belong to the user, bulk-rewrite `position` 0..n-1; return ordered sections. Depends on T016.
- [X] T025 [P] [US4] Implement `reorderChords(userId, sectionId, orderedIds)` in `backend/src/services/chords.service.ts`: verify section ownership + ids in section, bulk-rewrite `position` 0..n-1; return ordered chords. Depends on T020.
- [X] T026 [US4] Add `POST /api/sections/reorder` and `POST /api/sections/:sectionId/chords/reorder` (validate with `reorderSchema`) to the respective routers. Depends on T017, T021, T024, T025.
- [X] T027 [US4] Add native HTML5 drag-and-drop + keyboard move controls to `SectionTabs.tsx` (keeping **+** last) and `ChordGrid.tsx` (keeping **add chord** last); on drop/move call the reorder endpoints via `vaultApi` with optimistic reordering. Depends on T019, T023, T026.

**Checkpoint**: Section and chord order is user-customizable and persistent.

---

## Phase 7: User Story 5 - View, copy, and edit chord values (Priority: P2)

**Goal**: Each chord tile can reveal a hidden value, copy a value to the clipboard, and open
an edit affordance to modify the chord.

**Independent Test**: On a chord tile, toggle show, copy a value, and open edit; each control
is present and operable.

- [X] T028 [US5] Implement `updateChord(userId, chordId, fields)` in `backend/src/services/chords.service.ts`: owner-scoped update of placeholder fields (404 if not owned); return the public chord. Depends on T020.
- [X] T029 [US5] Add `PATCH /api/chords/:chordId` (validate with `updateChordSchema`, 200 `{ chord }`) to `backend/src/routes/chords.ts`. Depends on T021, T028, T006.
- [X] T030 [US5] Add show (reveal), copy-to-clipboard, and edit affordances to `ChordCard.tsx`; wire the edit action to reopen `AddChordDialog` (reused for edit) and PATCH via `vaultApi` in `HomePage.tsx`. Depends on T012, T023, T029.

**Checkpoint**: Everyday retrieval actions (show/copy/edit) work on chords.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T031 [P] Verify responsive layout at 320px→desktop (section strip scrolls, chord grid reflows, dialogs touch-friendly; FR-020, SC-005) and keyboard/a11y (tab roles, dialog focus trap, reorder controls; WCAG 2.1 AA).
- [ ] T032 [P] Confirm per-user isolation: a second user sees only **Mine** and never another user's data (FR-018, SC-006).
- [X] T033 Run quality gates from repo root: `npm run typecheck`, `npm run lint`, `npm run build --workspaces --if-present`; fix any issues. Then walk through [quickstart.md](quickstart.md).

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T008)** → user stories.
- **US1 (T009–T015)** is the MVP and unblocks the vault surface used by later stories.
- **US2 (T016–T019)** and **US3 (T020–T023)** depend on US1's routers/services/`HomePage`.
- **US4 (T024–T027)** depends on US2 + US3 (needs create flows in place to reorder).
- **US5 (T028–T030)** depends on US3 (needs chords + `HomePage` wiring; reuses `AddChordDialog`).
- **Polish (T031–T033)** last.

### Story completion order

P1: US1 → US2 → US3, then P2: US4 → US5.

## Parallel Execution Examples

- **Setup**: T001 and T002 in parallel (different files).
- **Foundational**: T003, T004, T005, T006, T008 in parallel; T007 after T003–T006.
- **US1 frontend**: T012, T013, T014 in parallel (different components) before T015 wires them.
- **US4 services**: T024 and T025 in parallel before T026 exposes them.
- **Polish**: T031 and T032 in parallel; T033 last.

## Implementation Strategy

- **MVP first**: Ship Phase 1–3 (Setup + Foundational + US1) — a browsable, per-user vault
  with the default **Mine** section. This alone is demonstrable.
- **Incremental**: Add create (US2) and add-chord (US3) to make it useful, then reorder (US4)
  and show/copy/edit (US5) for the full experience.
- **Note**: `HomePage.tsx`, `SectionTabs.tsx`, and `ChordGrid.tsx` are touched across
  multiple stories — sequence those cross-story edits (do not parallelize edits to the same file).

