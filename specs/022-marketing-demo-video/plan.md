# Implementation Plan: End-to-End Marketing Demo Video

**Branch**: `topic/vii-1026-marketing-demo-video` | **Date**: 2026-07-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/022-marketing-demo-video/spec.md`

## Summary

Produce three reviewable marketing assets for the Vii Pass launch: (P1) a ~60-second
(50–70s) narration script covering the full feature inventory + security story in a
sign-in-first, demo-navigable order; (P2) an AI-generated voiceover of the approved
script; (P3) a 9:16 portrait (1080×1920) video that pairs the voiceover with real-app
visuals — recorded primarily in the app's responsive mobile layout with one brief framed
desktop glimpse — plus minimal burned-in headline captions per scene.

**Technical approach**: This is a media-pipeline feature, not an app change. All tooling
lives in a new, isolated `media/marketing-video/` folder (its own `package.json`, never
imported by any app workspace; app runtime/deploy untouched). Voiceover = Microsoft Edge
neural TTS via the `msedge-tts` npm package (free, no API key, natural-sounding — local
SAPI voices were probed and rejected as too robotic). Demo capture = Playwright
(chromium) driving the real app at a phone viewport with built-in `recordVideo`, against
the local dev stack (`npm run dev:node`, preview DB) using a purpose-made demo account
seeded through the real UI (which exercises the genuine client-side encryption path).
Assembly = `ffmpeg-static` (no system install; ffmpeg is not on PATH): concat scene
clips, scale/pad to 1080×1920, overlay the framed desktop glimpse, draw headline
captions, mux the voiceover, export H.264/AAC MP4.

## Technical Context

**Language/Version**: Node.js 24 (ESM `.mjs` scripts); no app-code changes (backend/, frontend/, shared/ untouched)

**Primary Dependencies**: `playwright` (screen capture via `recordVideo`), `msedge-tts` (neural voiceover, no API key), `ffmpeg-static` + `fluent-ffmpeg`-free direct CLI invocation (video assembly) — all dev-only, isolated in `media/marketing-video/package.json`, NOT added to any app workspace

**Storage**: Files only — script (markdown), voiceover (MP3), scene clips (WebM intermediates, git-ignored), final video (MP4, committed as the deliverable)

**Testing**: No unit tests (Constitution II). Acceptance = manual review of the three assets against spec checklists (duration window, coverage map, sync drift, frame-level demo-data-only review)

**Target Platform**: Deliverable plays on common surfaces (desktop player, browser, mobile) — H.264 + AAC in MP4 is the universally supported combination. Pipeline runs on the developer's Windows machine

**Project Type**: Media asset pipeline (single isolated folder; not an app workspace)

**Performance Goals**: Final video 50–70s runtime; ≤1s narration-to-visual sync drift at every narrated feature moment; file size ≤ ~40MB (social-platform friendly)

**Constraints**: 9:16 portrait 1080×1920; demo data only (no real secrets in any frame); minimal headline captions burned in (FR-011); one brief framed desktop glimpse; app shown clean (no errors/dev tooling); assets independently revisable (script → audio → video cascade only forward)

**Scale/Scope**: 3 deliverables, ~8 narration scenes, ~4 pipeline scripts, 1 demo account + ~2 sections / ~4 credential entries of seeded demo data

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Code Quality | Pipeline scripts are plain, single-purpose `.mjs` files with TSDoc-style comments; they live outside app workspaces but MUST still be lint-clean (media folder added to eslint scope or kept trivially clean). No dead code shipped; intermediates git-ignored. | PASS |
| II. Testing Standards | No unit tests — correct per constitution. Verification = manual asset review (the spec's own acceptance scenarios/SCs). No CI gates added. | PASS |
| III. UX Consistency | No UI is added or changed — the video *showcases* the existing UI. The 9:16 mobile-layout recording actively demonstrates the constitution's mobile-first mandate. Captions must be legible (contrast) — mirrored from WCAG spirit into FR-011. | PASS |
| IV. Performance Requirements | No runtime code paths touched. Media budgets defined instead (runtime window, sync drift, file size — see Technical Context). | PASS |
| V. Scalability & Maintainability | Pipeline is modular (script → voice → record → assemble; each stage re-runnable independently per SC-007). Zero deps added to app workspaces; deploy artifacts unaffected. No hardcoded secrets — demo credentials are throwaway and documented as such. | PASS |
| Security gate | Demo account/vault only; recorded against local dev stack + preview DB, never production. No secrets committed (demo password is intentionally public/throwaway). Frame-level review pass required (SC-004). | PASS |

**Result: PASS — no violations, Complexity Tracking not needed.**

*Post-Phase-1 re-check (after data-model + contracts written): still PASS — design added
no app-code surface, no new workspace deps, no UI changes.*

## Project Structure

### Documentation (this feature)

```text
specs/022-marketing-demo-video/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (scene/asset model + demo data set)
├── quickstart.md        # Phase 1 output (regenerate-everything guide)
├── contracts/
│   ├── script-scenes.md # Scene-by-scene narration ↔ visual ↔ caption contract
│   └── deliverables.md  # Acceptance contract for the 3 assets (format, budgets, review gates)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
media/
└── marketing-video/           # NEW — isolated pipeline, never imported by app code
    ├── package.json           # own dev-deps: playwright, msedge-tts, ffmpeg-static
    ├── script.md              # P1 deliverable — the approved narration script (scene table)
    ├── seed-demo.mjs          # one-time: register demo account + seed vault via real UI (Playwright)
    ├── generate-voiceover.mjs # P2: script text → voiceover.mp3 (msedge-tts, per-scene + full)
    ├── record-demo.mjs        # P3a: Playwright walkthrough → per-scene .webm clips (mobile + desktop glimpse)
    ├── assemble-video.mjs     # P3b: ffmpeg concat/scale/captions/audio mux → final MP4
    └── output/
        ├── .gitignore         # intermediates (clips, per-scene audio) ignored
        ├── voiceover.mp3      # P2 deliverable (committed)
        └── vii-pass-marketing-9x16.mp4  # P3 deliverable (committed)

backend/   # UNTOUCHED
frontend/  # UNTOUCHED
shared/    # UNTOUCHED
```

**Structure Decision**: A new top-level `media/marketing-video/` folder keeps the
pipeline fully out of the npm-workspaces graph (root `package.json` workspaces list is
NOT extended — the folder is standalone with its own lockfile), so app typecheck/lint/
build/deploy pipelines and the Worker bundle are provably unaffected. The two final
assets plus the script are committed as the reviewable deliverables (FR-010); bulky
intermediates are git-ignored.

## Complexity Tracking

> No constitutional violations — table intentionally empty.
