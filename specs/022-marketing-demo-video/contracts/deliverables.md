# Contract: Deliverables — formats, budgets, review gates

**Feature**: 022-marketing-demo-video | **Consumers**: pipeline scripts, product-owner review

Three independently reviewable assets (FR-010). Each has a hard acceptance gate; a
failed gate rejects only that asset (and its downstream dependents per the revision
cascade in data-model.md).

## D1 — Narration script

| Property | Requirement |
|----------|-------------|
| Location | `media/marketing-video/script.md` (committed) |
| Format | Markdown scene table per contracts/script-scenes.md |
| Duration | 150–165 words total; empirically 50–70s when rendered by D2 (SC-001) |
| Coverage | Scene `covers` union == FR-002 checklist (SC-002 coverage map) |
| Order | Sign-in first, single continuous session (FR-003) |
| Claims | Truthful per script-scenes.md rule 7 (FR-004) |
| **Review gate** | Product owner reads + times it; approval freezes coverage list for D2/D3 |

## D2 — Voiceover audio

| Property | Requirement |
|----------|-------------|
| Location | `media/marketing-video/output/voiceover.mp3` (committed); per-scene MP3s git-ignored |
| Engine/voice | msedge-tts, `en-US-AriaNeural` (alternate: `en-US-GuyNeural`) — research D1 |
| Content | Approved script verbatim — no missing/repeated/garbled sentences (FR-005) |
| Duration | 50–70s measured by ffprobe |
| Quality | Intelligible on consumer hardware; no clipping/stutter/cutoffs; brand name pronounced correctly (regenerate with phonetic input if not) |
| **Review gate** | Product owner listens end-to-end against the script |

## D3 — Final video

| Property | Requirement |
|----------|-------------|
| Location | `media/marketing-video/output/vii-pass-marketing-9x16.mp4` (committed) |
| Container/codec | MP4, H.264 (yuv420p) + AAC, `+faststart` (FR-009) |
| Resolution / AR | 1080×1920, 9:16 portrait |
| Runtime | 50–70s (SC-001) |
| Visuals | Real app, mobile layout for all scenes except the single framed desktop glimpse (S8); sign-in opens the demo (FR-006/FR-008) |
| Sync | ≤1s narration↔visual drift at every narrated feature moment (SC-005) |
| Captions | One burned-in headline per scene, legible (FR-011) |
| Data hygiene | Frame-level review: zero real credentials/personal data/secrets; demo data only; no dev tooling, error banners, or browser chrome in any frame (FR-007/FR-008, SC-004) |
| File size | ≤ ~40MB (encode budget; raise CRF if over) |
| Playback | Verified on ≥3 surfaces: desktop player, browser, mobile device (SC-006) |
| Muted viewing | Headline captions + self-explanatory action carry the message with audio off |
| **Review gate** | Product owner watches end-to-end + frame-level data-hygiene pass |

## Pipeline reproducibility contract

- `npm install` inside `media/marketing-video/` is the ONLY setup (ffmpeg via
  ffmpeg-static; no system installs; no API keys).
- Each stage re-runnable independently: `seed-demo.mjs` (idempotent-ish: safe to drop
  + re-seed preview data), `generate-voiceover.mjs`, `record-demo.mjs`,
  `assemble-video.mjs` (SC-007).
- Requires the local dev stack (`npm run dev:node` at repo root, preview DB) running
  during seeding and recording; production is never touched.
- Root npm workspaces, app dependencies, CI workflows, and the Worker bundle are
  UNCHANGED — `git diff backend/ frontend/ shared/ package.json` must be empty at ship.
