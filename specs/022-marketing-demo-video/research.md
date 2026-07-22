# Research: End-to-End Marketing Demo Video

**Feature**: 022-marketing-demo-video | **Date**: 2026-07-22

All Technical Context unknowns resolved below. No NEEDS CLARIFICATION markers remain
(spec clarifications 2026-07-22 already settled aspect ratio 9:16, mobile-first framing
with one desktop glimpse, and minimal headline captions).

---

## Decision 1: AI voiceover engine — `msedge-tts` (Microsoft Edge neural voices)

**Decision**: Generate the voiceover with the `msedge-tts` npm package, which uses the
same free neural TTS endpoint the Microsoft Edge browser's Read Aloud feature uses.
Voice: `en-US-AriaNeural` (professional, warm female) as default; `en-US-GuyNeural` as
the documented alternate. Output MP3, generated per-scene AND as one full track.

**Rationale**:
- **Local SAPI rejected by probe**: the machine has only `Microsoft David Desktop` and
  `Microsoft Zira Desktop` (legacy robotic voices) — unacceptable for marketing per
  FR-005's "clearly intelligible / professional" bar and the mispronunciation edge case.
- **No API key / no cost**: cloud TTS (Azure Speech, ElevenLabs, OpenAI TTS) produces
  equal or better quality but requires accounts, keys, and billing — new secrets and
  vendor onboarding for a one-minute asset is disproportionate. `msedge-tts` needs none.
- **Neural quality**: Edge neural voices are the same voice models as Azure Speech's
  standard neural tier — good enough that they are widely used for exactly this kind of
  short-form marketing narration.
- **Pronunciation control**: the package accepts SSML-ish input; "Vii Pass" can be
  spelled phonetically in the input text (e.g., "Vee Pass") if the first render
  mispronounces it — satisfying the regeneration edge case without changing the
  displayed script.
- Per-scene MP3s (plus the full track) let assembly align each scene clip to its own
  narration segment, which is how the ≤1s sync-drift budget (SC-005) is met by
  construction rather than by manual nudging.

**Alternatives considered**:
- **Azure / ElevenLabs / OpenAI TTS**: higher ceiling quality, but paid + key management
  (violates "no new secrets for a media asset" simplicity); rejected.
- **Windows SAPI (`System.Speech`)**: zero-dep, but probe shows only legacy robotic
  voices; fails marketing quality; rejected.
- **Record a human**: out of scope — user explicitly asked for an AI-generated voice.

## Decision 2: Demo capture — Playwright chromium with `recordVideo`, phone viewport

**Decision**: Script the walkthrough with Playwright (chromium), context option
`recordVideo` capturing WebM, viewport 390×844 (iPhone-class portrait) with
`deviceScaleFactor: 2` for crisp 780×1688 native footage that upscales cleanly to
1080×1920. One additional short recording at 1280×800 provides the desktop glimpse,
which assembly composes framed inside the portrait canvas. Recorded against the local
dev stack (`npm run dev:node` → API :8787 + Vite :5173, preview DB). Each scene is
recorded as its own clip (one context per scene, resuming the signed-in state) so scene
durations can be fitted to the per-scene narration lengths.

**Rationale**:
- **Repo-proven**: Playwright has been used throughout this project for verification
  (features 010–021 all verified with it); its known quirks on this app are already
  documented in repo memory (e.g., `page.evaluate(el.click())` for intercepted pointer
  events) — lowest-risk capture path.
- **Built-in recording**: `recordVideo` needs no OS screen-recorder, no window
  chrome/cleanup problems (FR-007's "no browser clutter" is automatic — the capture is
  the viewport only), deterministic sizing, headless-capable.
- **Mobile layout natively fills 9:16** (clarification #1): 390×844 renders the app's
  real responsive layout — also showcasing the constitution's mobile-first mandate.
- **Per-scene clips** make sync a construction property: clip *n* is trimmed/held to
  match narration segment *n*'s duration, so drift cannot accumulate.
- **Local dev + preview DB**: spec requires non-production; dev:node is the verified
  local loop (repo memory). Demo data seeded via the real UI so on-screen values decrypt
  genuinely (seeding via API would require re-implementing client crypto in the seeder).

**Alternatives considered**:
- **OS screen recorder (OBS, Xbox Game Bar)**: manual, non-reproducible, captures
  browser chrome, needs human dexterity for smooth navigation; rejected.
- **Headed browser + CDP screencast**: more moving parts than `recordVideo` for no
  quality gain; rejected.
- **Screenshots + Ken-Burns pans**: loses the "real navigation" feel the user asked for
  ("logging in and navigating to all the features"); rejected.

## Decision 3: Assembly — `ffmpeg-static` binary driven directly via `child_process`

**Decision**: Use the `ffmpeg-static` npm package (bundles a real ffmpeg binary; probe
confirmed ffmpeg is NOT on PATH) invoked directly with `spawn` from `assemble-video.mjs`.
Pipeline: (1) trim/pad each scene WebM to its narration segment duration, scale to
1080×1920 (mobile scenes: scale + minimal crop; desktop glimpse: scale to width inside a
branded blurred/solid background band = "framed" per clarification #1); (2) burn one
headline caption per scene with `drawtext` (Arial — probe confirmed `C:\Windows\Fonts\
arial.ttf` exists — white text on a semi-opaque dark pill for guaranteed legibility per
FR-011); (3) concat scenes; (4) mux the full voiceover MP3 → AAC; output H.264 (libx264,
`yuv420p`, CRF ~21) MP4 with `+faststart` for web playback.

**Rationale**:
- **No system install**: ffmpeg-static removes the "install ffmpeg first" prerequisite —
  the pipeline is `npm install && node ...` reproducible on any machine.
- **H.264/AAC MP4** is the only combination that satisfies FR-009/SC-006 (desktop
  player + browser + mobile without re-encoding). WebM/VP9 fails on some mobile/social
  surfaces.
- **`drawtext` captions** keep captions in the reproducible pipeline (re-runs regenerate
  them); a video editor would make caption changes manual and unrepeatable (violates
  SC-007's independent-revision requirement).
- **Direct `spawn` over wrapper libs** (fluent-ffmpeg): the wrapper is unmaintained and
  adds an abstraction over ~6 well-understood command lines; plain args are easier to
  review (Constitution I).

**Alternatives considered**:
- **Video editor (DaVinci/Clipchamp/CapCut)**: manual, unrepeatable, license/watermark
  concerns; rejected.
- **Remotion (React-based video)**: powerful but a heavy new framework + licensing terms
  for company use; massive overkill for one 60s asset; rejected.
- **editly / etro**: abandoned or immature; rejected.

## Decision 4: Script format & duration engineering

**Decision**: `script.md` is a scene table — for each of ~8 scenes: scene id, headline
caption (FR-011), narration text, on-screen action, feature-coverage tags (mapping to
FR-002 items). Narration totals ~150–165 words (natural marketing pace ≈ 150–160 wpm →
~57–63s, inside the 50–70s window). Duration is verified empirically: generate the
voiceover, measure with ffprobe, and trim/extend wording if outside the window.

**Rationale**: The word-count budget makes the 50–70s target designable up front
(SC-001); the scene table IS the coverage map required by SC-002 and doubles as the
sequencing contract for recording and assembly (single source of truth per US1).

**Alternatives considered**: Free-prose script (loses the scene↔visual↔caption mapping,
makes coverage verification manual); rejected.

## Decision 5: Demo account & data

**Decision**: Demo account registered via the real UI by `seed-demo.mjs`: admin username
`viidemo`, view-only username `viidemoview`, display name "Alex Morgan", password
`demo123` (3–10 char policy), security question answer `rex` — all intentionally
throwaway and safe to show on screen. Vault: 2 sections ("Work" #0b5cad-family color,
"Personal" distinct color) + 4 entries with realistic-but-fake data (e.g., "Acme Mail"
with url `https://mail.example.com`, username `alex@example.com`, password
`Fake!Pass1` — fake by construction, revealed on camera in exactly one scene). Seeded
into the preview DB (`vii_pass_preview`) via the local dev stack.

**Rationale**: FR-007/SC-004 require demo-only data; seeding through the real UI
exercises genuine client-side encryption so the recorded reveal/copy interactions are
authentic. `example.com` domains are reserved for exactly this purpose. The dual
usernames also let the video truthfully show the dual-identity feature (FR-002).

**Alternatives considered**: Direct DB insert (would need to re-implement the client
crypto pipeline in Node — fragile duplicate of `frontend/src/vault/crypto.ts`);
rejected. Reusing existing test accounts (themeadmin etc. — history/contents not
curated for camera); rejected.

## Decision 6: Where assets live & what gets committed

**Decision**: Pipeline + deliverables in `media/marketing-video/` (outside npm
workspaces; own `package.json` + lockfile). Committed: the 4 `.mjs` scripts,
`script.md`, `output/voiceover.mp3` (~1MB), `output/vii-pass-marketing-9x16.mp4`
(target ≤40MB). Git-ignored: `node_modules`, per-scene WebM/MP3 intermediates. Root
workspaces array is NOT modified.

**Rationale**: FR-010 requires the three assets be reviewable — committing them makes
review/PR possible and keeps everything versioned together. Keeping the folder out of
the workspaces graph guarantees zero impact on app installs, typecheck, lint config
resolution, CI, and the Worker bundle (Constitution V; verified approach — the CI
composite action runs `npm ci` at root, which ignores non-workspace folders).
40MB is well under GitHub's 100MB hard limit; if the H.264 encode lands bigger, raise
CRF before considering Git LFS.

**Alternatives considered**: Git LFS (extra setup for one file, not needed under
100MB); storing assets outside the repo (breaks FR-010 reviewability); adding a
`media` workspace (pollutes app dependency graph for zero benefit); all rejected.
