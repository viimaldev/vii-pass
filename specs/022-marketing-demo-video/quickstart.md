# Quickstart: Regenerating the Marketing Video

**Feature**: 022-marketing-demo-video

End-to-end guide to (re)produce all three deliverables from a clean checkout.

## Prerequisites

- Node.js ≥ 22 (repo standard; probed: v24 works)
- Repo root deps installed (`npm ci`) — needed only to run the local app stack
- Internet access (msedge-tts calls Microsoft's free TTS endpoint; Playwright may
  download its chromium build on first install)
- Nothing else: ffmpeg ships via `ffmpeg-static`; no API keys, no system installs

## 1. Install the pipeline (one-time)

```powershell
cd media/marketing-video
npm install          # playwright, msedge-tts, ffmpeg-static (isolated package.json)
npx playwright install chromium   # if the browser isn't already present
```

## 2. Start the local app stack (separate terminal, repo root)

```powershell
npm run dev:node     # API :8787 (preview DB vii_pass_preview) + SPA :5173
```

Verify: `http://localhost:8787/api/health` → `database: ok`.

## 3. Seed the demo account & vault (one-time, re-runnable)

```powershell
npm run seed         # node seed-demo.mjs
```

Registers `viidemo`/`viidemoview` ("Alex Morgan", pw `demo123`, answer `rex`) via the
real UI and creates 2 sections + 4 fake entries (see data-model.md). If the account
already exists, drop the preview `users`/`sessions`/`sections`/`chords` docs for it (or
the whole preview collections) and re-run.

## 4. Deliverable 1 — the script

Author/adjust `script.md` (scene table per contracts/script-scenes.md). Keep total
narration at 150–165 words. **Review gate**: read aloud + approve before continuing.

## 5. Deliverable 2 — the voiceover

```powershell
npm run voice        # node --use-system-ca generate-voiceover.mjs → output/voiceover.mp3
```

(The `--use-system-ca` flag makes Node trust the Windows certificate store — required
behind TLS-inspecting proxies; harmless elsewhere.)

Check the printed ffprobe duration is 50–70s. If "Vii Pass" is mispronounced, set the
phonetic override in the script's TTS column (displayed text unchanged) and re-run.
**Review gate**: listen end-to-end.

## 6. Deliverable 3 — record + assemble the video

```powershell
npm run record       # continuous mobile take (S1–S7) + S8 desktop take → .webm + clips.json
npm run assemble     # → output/vii-pass-marketing-9x16.mp4
```

`assemble-video.mjs` sizes each scene clip to its per-scene narration duration, burns
the headline captions, frames the desktop glimpse, muxes the audio, and prints final
runtime/size.

## 7. Acceptance pass (contracts/deliverables.md)

- Runtime 50–70s; 1080×1920; ≤ ~40MB
- Watch end-to-end: sync ≤1s at each narrated feature; captions legible
- Frame-level hygiene review: demo data only, no errors/dev tooling/browser chrome
- Play on 3 surfaces: desktop player (e.g., Media Player), a browser tab, a phone
- Muted watch-through: headlines + visuals still tell the story
- `git diff backend/ frontend/ shared/ package.json` → empty

## Revision cheat-sheet (SC-007)

| You changed… | Re-run |
|--------------|--------|
| Narration wording | steps 5 → 6 (assemble) |
| Voice choice | step 5 → 6 (assemble) |
| A visual/retake | step 6 only (record affected scene + assemble) |
| Caption text only | step 6 assemble only |
| Demo data | steps 3 → 6 (record + assemble) |
