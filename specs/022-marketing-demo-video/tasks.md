# Tasks: End-to-End Marketing Demo Video

**Input**: Design documents from `/specs/022-marketing-demo-video/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/script-scenes.md, contracts/deliverables.md, quickstart.md

**Tests**: Per the project Constitution (Principle II), no unit tests. Verification = the per-asset acceptance gates defined in contracts/deliverables.md (manual review tasks below).

**Organization**: Tasks grouped by user story. US1 (script) is the MVP; US2 (voiceover) consumes the approved script; US3 (video) consumes both. This feature is a media pipeline — "implementation" means authoring the script, building the four pipeline scripts in `media/marketing-video/`, and producing/reviewing the three committed assets. `backend/`, `frontend/`, `shared/`, and root `package.json` MUST remain untouched throughout.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

All new files live under `media/marketing-video/` (isolated pipeline folder, NOT an npm workspace) per plan.md's Structure Decision. Spec docs live in `specs/022-marketing-demo-video/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the isolated pipeline folder and install its tooling

- [X] T001 Create `media/marketing-video/` with its own `package.json` (private, `"type": "module"`, devDeps: `playwright`, `msedge-tts`, `ffmpeg-static`; npm scripts `seed`, `voice`, `record`, `assemble` mapping to the four `.mjs` files) and `media/marketing-video/output/.gitignore` ignoring `scenes/` intermediates and `node_modules` — do NOT modify the root `package.json` workspaces array
- [X] T002 Run `npm install` + `npx playwright install chromium` inside `media/marketing-video/` and verify installs: `ffmpeg-static` resolves to a runnable binary (`-version` prints), `msedge-tts` imports cleanly under Node 24
- [X] T003 [P] Start the local dev stack from repo root (`npm run dev:node`) and verify `http://localhost:8787/api/health` → `database: ok` against `vii_pass_preview` (required by seeding and recording; keep running for T004, T014–T016)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Demo account + vault data that both the recording (US3) and the script's on-screen actions (US1 accuracy check) depend on

**⚠️ CRITICAL**: The demo data must exist before any recording; the script's scene actions must be walkable against it

- [X] T004 Create `media/marketing-video/seed-demo.mjs` (Playwright, headed or headless): register account via the REAL UI at `http://localhost:5173` — admin username `viidemo`, view-only username `viidemoview`, display name `Alex Morgan`, password `demo123`, security question + answer `rex`; then create 2 sections (`Work`, `Personal`, distinct colors) and 4 credential entries with fake-by-construction values per data-model.md (e.g., "Acme Mail" / `https://mail.example.com` / `alex@example.com` / `Fake!Pass1`); make re-runs safe by detecting an existing `viidemo` login and printing drop-and-reseed instructions. Run it and verify the vault renders all 4 entries at a 390×844 viewport with no error banners

**Checkpoint**: Demo vault exists in `vii_pass_preview` — script authoring and recording can proceed

---

## Phase 3: User Story 1 - One-Minute Marketing Script (Priority: P1) 🎯 MVP

**Goal**: The approved narration script — scene table covering the full FR-002 feature inventory in a sign-in-first, demo-navigable order, timed to 50–70s

**Independent Test**: Read the script aloud at natural pace — lands in 50–70s; every FR-002 checklist item appears in some scene's `covers` tags; scene order is walkable in one continuous session against the seeded demo vault

- [X] T005 [US1] Author `media/marketing-video/script.md` as the 8-scene table (S1–S8) per contracts/script-scenes.md: columns sceneId, headline (≤5 words), narration, onScreenAction, covers; total narration 150–165 words; scene narration 8–35 words each; include an optional TTS-input column for phonetic overrides (e.g., "Vee Pass") that does not change displayed text
- [X] T006 [US1] Verify script coverage + order: build the coverage map (union of `covers` == FR-002 inventory: dual-username registration, username sign-in, color-coded sections, reorderable cards, entries w/ titles/links/typed fields, masking/reveal/copy, E2E encryption + server layer + password-never-leaves, security-question reset preserving vault, themes, responsive/mobile) and walk S2–S7 against the seeded demo vault in a 390×844 browser confirming single-session navigability (FR-003) and truthfulness rules (contracts/script-scenes.md rule 7)
- [X] T007 [US1] Duration + review gate (SC-001): time a natural read-aloud (or word-count check 150–165 @ ~155wpm ≈ 57–63s); present script to product owner for approval — approval freezes the FR-002 coverage list for US2/US3 (per spec Assumptions)

**Checkpoint**: Script approved — it is independently valuable as marketing copy even without audio/video

---

## Phase 4: User Story 2 - AI-Generated Voiceover (Priority: P2)

**Goal**: `output/voiceover.mp3` speaking the approved script verbatim in a natural neural voice, 50–70s, plus per-scene MP3s that drive video sync

**Independent Test**: Play `voiceover.mp3` end-to-end — complete script verbatim, intelligible, no artifacts, duration in window

- [X] T008 [US2] Create `media/marketing-video/generate-voiceover.mjs`: parse the scene table from `script.md` (narration or TTS-override column), call `msedge-tts` with voice `en-US-AriaNeural` per scene → `output/scenes/S1.mp3`…`S8.mp3`, concatenate (ffmpeg-static concat) → `output/voiceover.mp3`, then measure and print each scene duration + total via ffprobe (from ffmpeg-static's companion or ffmpeg `-i` parse) and write `output/scenes/durations.json` for the assembler
- [X] T009 [US2] Run the generator and validate against contracts/deliverables.md D2: total duration 50–70s (trim/extend script wording and re-run T008 if outside window — script edits re-open T007 approval only if meaning changes), verbatim content, no clipping/stutter/cutoffs, "Vii Pass" pronounced correctly (set phonetic override + regenerate if not)
- [X] T010 [US2] Review gate: product owner listens to `output/voiceover.mp3` end-to-end against the script; commit the approved MP3

**Checkpoint**: Voiceover approved — usable standalone as launch audio; `durations.json` ready for assembly

---

## Phase 5: User Story 3 - Assembled Marketing Video (Priority: P3)

**Goal**: `output/vii-pass-marketing-9x16.mp4` — 1080×1920 H.264/AAC, mobile-layout walkthrough + one framed desktop glimpse, headline captions, voiceover synced ≤1s, 50–70s, ≤~40MB

**Independent Test**: Watch end-to-end — sign-in opens, each narrated feature shows on screen within its scene, captions legible, demo data only, plays on 3 surfaces

- [X] T011 [US3] Create `media/marketing-video/record-demo.mjs` (Playwright chromium, `recordVideo`): for scenes S1–S7 use a 390×844 viewport @ `deviceScaleFactor: 2` against `http://localhost:5173`, one recorded clip per scene following each scene's onScreenAction from `script.md` (S2 signs in as `viidemo`/`demo123`; reuse `storageState` or re-login per context so S3–S7 resume the signed-in session; pace actions with explicit waits so each clip's length ≥ its `durations.json` narration duration + 0.5s buffer; exactly ONE reveal — S5's fake password); for S8 record a 1280×800 desktop-viewport take; save clips to `output/scenes/S*.webm`; known workaround: use `page.evaluate(el.click())` where Playwright reports "html intercepts pointer events"
- [X] T012 [US3] Run recording against the seeded demo vault (dev stack from T003 running) and inspect each clip: correct scene content, no error banners/loading failures/dev tooling, clean demo data only (FR-007/FR-008), clip durations cover narration durations
- [X] T013 [US3] Create `media/marketing-video/assemble-video.mjs` (ffmpeg-static via `child_process.spawn`): per scene — trim/hold-last-frame to the exact narration duration from `output/scenes/durations.json`, scale mobile clips to 1080×1920 (cover-crop), compose S8's desktop clip scaled-to-width on a branded background band within the portrait canvas, burn one `drawtext` headline per scene (arial.ttf, white text on semi-opaque dark pill, safe-area inset) — then concat all scenes, mux `output/voiceover.mp3` → AAC, encode H.264 `yuv420p` CRF 21 `+faststart` → `output/vii-pass-marketing-9x16.mp4`, printing final runtime/resolution/size
- [X] T014 [US3] Run assembly and validate technical budget: runtime 50–70s (SC-001), 1080×1920, H.264/AAC MP4, file ≤~40MB (raise CRF and re-run if over), captions present on all 8 scenes
- [X] T015 [US3] Acceptance pass per contracts/deliverables.md D3: watch end-to-end for ≤1s sync at every narrated feature moment (SC-005); frame-level data-hygiene review — zero real credentials/personal data/secrets, demo data only (SC-004); muted watch-through — headlines + visuals still carry the message; playback on ≥3 surfaces: desktop player, browser tab, mobile device (SC-006)
- [X] T016 [US3] Review gate: product owner watches the final video; on approval commit `output/vii-pass-marketing-9x16.mp4`

**Checkpoint**: All three deliverables produced and approved

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Repo hygiene and final verification per plan/contracts

- [X] T017 [P] Verify isolation guarantee: `git diff backend/ frontend/ shared/ package.json` is EMPTY; root `npm run typecheck` + `npm run lint` still green; `media/marketing-video/node_modules` and `output/scenes/` intermediates are git-ignored while `script.md`, `output/voiceover.mp3`, and `output/vii-pass-marketing-9x16.mp4` are tracked
- [X] T018 [P] Code-quality pass on the four `.mjs` pipeline scripts (Constitution I): single-purpose, commented intent, no dead code, no hardcoded machine-specific paths (ffmpeg from `ffmpeg-static` import, fonts referenced via a documented constant); demo credentials documented as intentionally throwaway
- [X] T019 Full quickstart.md walkthrough from a clean state (steps 1–7): fresh `npm install`, re-seed check, regenerate voiceover, re-record one scene, re-assemble — confirming the SC-007 revision cascade works as documented

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: no dependencies — start immediately
- **Phase 2 (Foundational)**: needs T001–T003 (pipeline installed + dev stack up)
- **Phase 3 (US1)**: T005 can start immediately after Phase 1 (authoring); T006 needs T004 (walkable demo vault)
- **Phase 4 (US2)**: needs US1 approved (T007) — audio is generated from the frozen script
- **Phase 5 (US3)**: T011 (recorder code) can be written in parallel with US2, but T012 (recording run) needs T004 + the script's onScreenActions (T007), and T013/T014 (assembly) need `durations.json` from T009
- **Phase 6 (Polish)**: after all deliverables (T016)

### User story dependency graph

```text
Setup (T001–T003) ──► Foundational (T004)
                            │
        ┌───────────────────┤
        ▼                   ▼
   US1 script (T005–T007, MVP)
        │ approved script freezes coverage
        ▼
   US2 voiceover (T008–T010) ──► durations.json
        │                             │
        ▼                             ▼
   US3 video: T011 (∥ with US2) → T012 → T013 → T014 → T015 → T016
        │
        ▼
   Polish (T017–T019)
```

### Same-file / same-resource chains

- `script.md`: T005 → T006 → T007 (and any T009 duration trim loops back through T007's approval only for meaning changes)
- Dev stack (one terminal): T003 stays running for T004, T012 (and T019's re-record)
- `durations.json`: produced by T008/T009, consumed by T011 pacing + T013 assembly

## Parallel Execution Examples

- **Phase 1**: T003 (dev stack) in parallel with T002 (installs) after T001
- **US1**: T005 (authoring) in parallel with T004 (seeding) — merge at T006
- **US2/US3 overlap**: T011 (write recorder) in parallel with T008–T010 (voiceover) — different files, recording run itself waits for approved script + durations
- **Polish**: T017 ∥ T018

## Implementation Strategy

**MVP first**: Phases 1–3 deliver the approved script (US1) — already usable as launch marketing copy. Then US2 adds the voiceover (usable standalone as audio ad), then US3 assembles the full video. Each story has its own review gate, so a rejection at any gate only re-opens that asset (plus downstream re-syncs per data-model.md's revision cascade).

**Totals**: 19 tasks — Setup 3, Foundational 1, US1 3, US2 3, US3 6, Polish 3.
