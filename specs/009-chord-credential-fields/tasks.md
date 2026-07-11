# Tasks: Chord Credential Fields

**Input**: Design documents from `/specs/009-chord-credential-fields/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/chords-api.md, contracts/chord-card-ui.md, quickstart.md

**Tests**: Per the project Constitution (Principle II), NO unit tests are generated. Verification = quality gates (`npm run typecheck` + `npm run lint` + `npm run build --workspaces --if-present`) plus the manual quickstart walkthrough per story.

**Organization**: Tasks are grouped by user story (US1 create, US2 card interactions, US3 edit) so each story is an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (user story phases only)

## Path Conventions

Web app (npm workspaces monorepo): `shared/types/`, `backend/src/`, `frontend/src/` — per plan.md Project Structure.

---

## Phase 1: Setup

**Purpose**: One-time data reset — placeholder-era chords have no `title` and are dropped, not migrated (research Decision 5).

- [X] T001 Drop the placeholder `chords` collection in the dev/preview database (`db.chords.drop()` in mongosh against `vii_pass_preview`) per quickstart.md §2; sections are untouched. (Repeat against production at ship time — see T022.)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The new chord shape (types, validation, storage projection, icon metadata) that every user story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Replace the placeholder chord types in shared/types/index.ts: add `ChordFieldType` (`'username' | 'email' | 'password' | 'other' | 'otherSensitive'`) and `ChordField` (`{ type: ChordFieldType; value: string | null }`); change `Chord` to `{ id, sectionId, position, title: string, url: string | null, fields: ChordField[] }` (exactly 3 entries, documented); change `CreateChordRequest` / `UpdateChordRequest` to `{ title: string; url?: string | null; fields: ChordField[] }`; remove all `field1/field2/field3` members and update TSDoc.
- [X] T003 [P] Rewrite backend/src/schemas/chords.schema.ts per data-model.md Validation Rules: `chordFieldTypeSchema` enum; row schema (`value` trimmed, `''`→`null`, ≤200); `title` (trim, min 1 "Title is required.", max 100); `url` optional/nullable with normalization transform (trim, `''`→`null`, prepend `https://` when scheme-less, must parse via `new URL()` with `http:`/`https:` protocol else "Enter a valid web address.", ≤2048 after normalization); `fields` = `z.array(row).length(3)`; export one payload schema reused as `createChordSchema` and `updateChordSchema` (contracts/chords-api.md — identical shapes). Depends on T002.
- [X] T004 [P] Update the chord document shape in backend/src/services/chords.service.ts: `ChordDoc` gains `title`, `titleNormalized`, `url`, `fields` (drop `field1/2/3`); `getChords` additionally ensures the compound unique index `{ userId: 1, sectionId: 1, titleNormalized: 1 }` alongside the existing ordering index; `toPublicChord` projects `{ id, sectionId, position, title, url, fields }` (never `titleNormalized`/`userId`/timestamps); add a `normalizeTitle` helper (`trim().toLowerCase()`); `listChords`, `reorderChords`, `deleteChord` compile against the new shape unchanged in behavior. Depends on T002.
- [X] T005 [P] Create frontend/src/components/chordFieldTypes.tsx exporting `CHORD_FIELD_TYPES: Record<ChordFieldType, { label: string; isSensitive: boolean; icon: ReactElement }>` (labels: Username, Email, Password, Other, Other sensitive; `isSensitive` true for `password`/`otherSensitive`; inline Bootstrap-Icons SVGs `person`/`envelope`/`key`/`tag`/`shield-lock`, `aria-hidden`, per research Decision 4) plus shared inline-SVG icon components for eye, eye-off, copy, check, and link used by the card and dialog. Depends on T002.

**Checkpoint**: `shared` + `backend` typecheck clean against the new shape (frontend components still reference old fields until US1) — foundation ready.

---

## Phase 3: User Story 1 — Create a chord with real credential fields (Priority: P1) 🎯 MVP

**Goal**: Add form with mandatory Title, optional URL, three type/value rows; save creates the chord; card shows title + per-type icon rows with sensitive values masked; duplicate/blank titles rejected.

**Independent Test**: Quickstart §4 "Create (US1)" — create "GitHub" with URL + username + password rows; verify card rendering, masked password, blank-title rejection, case-insensitive duplicate rejection in the same section (allowed in a different section), and cancel discarding input.

### Implementation for User Story 1

- [X] T006 [US1] Implement `createChord` in backend/src/services/chords.service.ts for the new payload: compute `titleNormalized`; pre-check `findOne({ userId, sectionId, titleNormalized })` → throw `AppError` 409 `chord_title_taken` "A chord with this title already exists in this section."; insert with `title`, `titleNormalized`, `url`, `fields`, appended `position = count`; catch MongoDB duplicate-key error (code 11000) from the unique index and map to the same 409 (race backstop, research Decision 2). Depends on T003, T004.
- [X] T007 [P] [US1] Update TSDoc in backend/src/routes/chords.ts to describe the new payloads and the 409 duplicate-title response (paths/verbs/handlers unchanged per research Decision 7); update the module TSDoc in backend/src/schemas/chords.schema.ts and backend/src/services/chords.service.ts to drop "placeholder fields" wording. Depends on T006.
- [X] T008 [P] [US1] Rebuild the form in frontend/src/components/AddChordDialog.tsx per contracts/chord-card-ui.md: required Title input (`maxLength` 100, inline "Title is required." on blank submit); optional URL input (`inputMode="url"`, client-side mirror of the normalization check with inline "Enter a valid web address."); three option rows — type `<select>` (five options with the row's type icon from chordFieldTypes.tsx shown beside it) + value input (`maxLength` 200, `autoComplete="off"`); defaults for new chords: username / password / other; empty value = unused row (type still submitted); surface server 400/409 messages inline; Save/Cancel/delete-confirm behavior and `VaultModal` usage unchanged. Depends on T005.
- [X] T009 [P] [US1] Rebuild rendering in frontend/src/components/ChordCard.tsx for the new shape: header shows `chord.title` (plain text in this story); body renders only rows with non-null values in slot order — type icon (from chordFieldTypes.tsx, `aria-hidden`) + visually-hidden type name + value; sensitive rows (`isSensitive`) render a fixed-length mask `••••••••` instead of the value; drop the `field1`-derived title fallback and placeholder `FIELDS` array. Depends on T005.
- [X] T010 [US1] Update frontend/src/pages/HomePage.tsx add/edit save handlers to pass the new `{ title, url, fields }` payload through to `vaultApi` and verify frontend/src/services/vaultApi.ts compiles against the new shared request/response types (signatures should be unchanged). Depends on T008.
- [X] T011 [US1] Add token-based styles in frontend/src/styles/tokens.css for the new form rows (type select + value layout) and card rows (icon + value + truncation for long titles/values), responsive from ~320px with ≥44px touch targets; remove styles left dead by the placeholder removal. Depends on T008, T009.
- [X] T012 [US1] Run gates (`npm run typecheck`, `npm run lint`, `npm run build --workspaces --if-present`) and execute quickstart.md §4 "Create (US1)" manually at mobile (~320px) and desktop widths. Depends on T006–T011.

**Checkpoint**: MVP — chords can be created with real fields and display correctly; sensitive values masked.

---

## Phase 4: User Story 2 — Use a chord card: copy, reveal, and open the link (Priority: P2)

**Goal**: Copy controls on every filled row, eye reveal/re-mask on sensitive rows, linked title opening the URL in a new tab, and a copy-link button immediately before edit.

**Independent Test**: Quickstart §4 "Card interactions (US2)" — link cursor + new-tab open, copy-link copies URL only, row copy copies exact value (masked copy works without reveal), eye toggles and resets to masked on section switch, no-URL card has plain title and no copy-link button.

### Implementation for User Story 2

- [X] T013 [US2] Linked title + copy-link in frontend/src/components/ChordCard.tsx: when `chord.url` is non-null render the title as `<a href={chord.url} target="_blank" rel="noopener noreferrer">` (never display the URL text) and add a copy-link button (`aria-label` "Copy link for {title}") positioned immediately **before** the edit button; when `url` is null keep the plain heading and omit the button (FR-004–FR-006). Depends on T009.
- [X] T014 [US2] Row controls in frontend/src/components/ChordCard.tsx: non-sensitive rows get a copy button only; sensitive rows get an eye toggle (`aria-pressed`, reveal/re-mask, local per-row state so every re-render/unmount starts masked — FR-012) followed by a copy button; copy uses the in-memory value without requiring reveal; all copy buttons (including copy-link) show transient success (check ≈1.5s) **and failure** feedback (replace the current silent catch — FR-011, research Decision 6); replace emoji glyphs with the inline SVG icons from chordFieldTypes.tsx. Depends on T013.
- [X] T015 [US2] Styles in frontend/src/styles/tokens.css for the header action group (copy-link + edit ordering), title-link (inherits heading color, underline/cursor affordance on hover, visible focus outline), and copy success/failure feedback states — token-based, touch targets ≥44px. Depends on T014.
- [X] T016 [US2] Run gates and execute quickstart.md §4 "Card interactions (US2)" manually, including keyboard operation (tab to link/eye/copy, `aria-pressed` announced) and touch-target check at ~320px. Depends on T013–T015.

**Checkpoint**: US1 + US2 — full retrieval workflow (copy, reveal, open) works.

---

## Phase 5: User Story 3 — Edit an existing chord (Priority: P3)

**Goal**: Edit re-opens the form pre-filled (title, URL, all row types + values, including unused rows' remembered types); same validation as create; a chord never conflicts with its own title.

**Independent Test**: Quickstart §4 "Edit (US3)" — pre-fill correctness, casing-only rename succeeds, rename to an existing title in the section → 409 and chord unchanged, password change stays masked and copies the new value, `javascript:` URL rejected, cancel keeps previous values.

### Implementation for User Story 3

- [X] T017 [US3] Implement `updateChord` in backend/src/services/chords.service.ts for the new payload: load + owner-check the chord (404 otherwise); duplicate pre-check `findOne({ userId, sectionId, titleNormalized, _id: { $ne: chordId } })` → 409 `chord_title_taken` (self-conflict excluded so casing-only renames succeed — FR-014); replace `title`/`titleNormalized`/`url`/`fields` wholesale, touch `updatedAt`, leave `position`/`sectionId` untouched; map duplicate-key race to the same 409. Depends on T006.
- [X] T018 [US3] Edit pre-fill in frontend/src/components/AddChordDialog.tsx: when `chord` is provided initialize title, URL, and all three rows' types **and** values from the chord (unused rows keep their persisted type with an empty value); confirm frontend/src/pages/HomePage.tsx passes the full edit payload through the existing PATCH flow. Depends on T008, T010.
- [X] T019 [US3] Run gates and execute quickstart.md §4 "Edit (US3)" manually. Depends on T017, T018.

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 [P] Dead-code sweep: `grep` the repo (backend/src, frontend/src, shared) for `field1|field2|field3|placeholder` chord references and remove any stragglers (comments, TSDoc, CSS classes) so no placeholder-era wording or styles remain.
- [ ] T021 Full quickstart.md validation end-to-end, including the responsive & a11y pass (§4 last section) at ~320px / 768px / desktop and the two-section duplicate-title allowance.
- [X] T022 At ship time (before/at merge to `main`): run `db.chords.drop()` against the **production** database per quickstart.md §6, then verify the deployed Worker serves the new payloads (create + list one chord).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — do first (dev DB only; prod drop deferred to T022).
- **Foundational (Phase 2)**: T002 first; then T003, T004, T005 in parallel. **Blocks all stories.**
- **US1 (Phase 3)**: after Phase 2. Backend (T006→T007) and frontend (T008, T009 in parallel → T010, T011) can proceed concurrently; T012 last.
- **US2 (Phase 4)**: after US1's card rendering (T009); frontend-only.
- **US3 (Phase 5)**: T017 after T006 (backend); T018 after T008/T010 (frontend). US3 backend (T017) may start any time after US1's T006 — it does not need US2.
- **Polish (Phase 6)**: after desired stories complete; T022 is the final ship gate.

### Story Graph

```text
Setup (T001)
  └── Foundational (T002 → T003 ∥ T004 ∥ T005)
        └── US1 (T006–T012)  🎯 MVP
              ├── US2 (T013–T016)   [frontend-only, builds on T009]
              └── US3 (T017–T019)   [T017 needs only T006; T018 needs T008/T010]
                    └── Polish (T020–T022)
```

### Parallel Opportunities

- **Phase 2**: T003, T004, T005 — three different files, all only depend on T002.
- **US1**: T007 ∥ T008 ∥ T009 (routes TSDoc, dialog, card — different files); backend track (T006→T007) runs alongside the frontend track (T008/T009→T010/T011).
- **US2 + US3**: after US1, one developer can take US2 (ChordCard) while another takes US3 (service + dialog) — disjoint files except the shared quickstart runs.
- **Polish**: T020 parallel with T021.

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. T001 (drop dev collection) → Phase 2 (T002–T005).
2. Phase 3 (T006–T012) → **STOP and VALIDATE**: create/duplicate/mask flows per quickstart §4.
3. Demo-able MVP: chords with real titles, URLs stored (not yet clickable), typed masked fields.

### Incremental Delivery

1. US1 → validate → MVP.
2. US2 → validate → full retrieval UX (copy/reveal/open-link).
3. US3 → validate → edit round-trip.
4. Polish (T020–T021) → ship: PR, merge to `main` (auto-deploy), T022 prod data reset + smoke check.

---

## Notes

- Total: **22 tasks** (Setup 1, Foundational 4, US1 7, US2 4, US3 3, Polish 3).
- No unit-test tasks by design (Constitution Principle II); every story phase ends with the gates + its quickstart walkthrough.
- Same-file sequencing to respect: chords.service.ts (T004 → T006 → T017), AddChordDialog.tsx (T008 → T018), ChordCard.tsx (T009 → T013 → T014), tokens.css (T011 → T015).
- Commit after each task or logical group; keep the branch `topic/vii-1010-chord-credential-fields`.
