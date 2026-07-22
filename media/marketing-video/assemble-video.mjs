/**
 * assemble-video.mjs — Assemble the final 9:16 marketing video (US3).
 *
 * Consumes:
 *  - output/scenes/durations.json  (per-scene narration lengths + headlines, from US2)
 *  - output/scenes/clips.json      (scene → source file + start/end offsets, from record)
 *  - output/scenes/mobile-session.webm / desktop-glimpse.webm (footage)
 *  - output/voiceover.mp3          (approved narration track)
 *
 * Per scene: cut the footage slice, size it to EXACTLY the scene's narration
 * duration (contract rule 4 — sync unit = scene), compose to a 1080×1920
 * portrait frame, and burn the scene's ≤5-word headline caption (white text on
 * a semi-opaque dark pill, safe-area inset — FR-011). Then concat all scenes,
 * mux the voiceover → H.264 yuv420p CRF 21 + AAC, +faststart.
 *
 * Layout notes (verified against recorded frames):
 *  - Playwright never UPSCALES: the mobile take's real content is 390×844 in
 *    the top-left of the 780×1688 canvas (gray padding right/bottom) → crop
 *    the content, cover-crop to 9:16 anchored to the TOP (keeps the header;
 *    the trimmed bottom is decorative background), upscale to 1080×1920.
 *  - S8 (desktop-glimpse) is a clean 1280×800 take → framed scaled-to-width
 *    on a light branded band inside the portrait canvas, with the product
 *    logo + tagline below (end-card; contract rule 8 — never letterboxed).
 */
import { spawn } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCENES_DIR = path.join(HERE, 'output', 'scenes');
const VOICEOVER = path.join(HERE, 'output', 'voiceover.mp3');
const FINAL = path.join(HERE, 'output', 'vii-pass-marketing-9x16.mp4');
/** Product logo (read-only use of the shipped frontend asset). */
const LOGO = path.join(HERE, '..', '..', 'frontend', 'public', 'logo', 'full_logo.png');

/** Windows system font for the burned-in captions (drawtext-escaped). */
const FONT = 'C\\:/Windows/Fonts/arial.ttf';
/** Real content rectangle inside the recorded mobile canvas (see header note). */
const MOBILE_CONTENT = { width: 390, height: 844 };
/** 9:16 crop of the mobile content, anchored to the top (390 × 390*16/9). */
const MOBILE_CROP_HEIGHT = 694;

/** Run the bundled ffmpeg binary (cwd = pipeline folder for relative paths). */
function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { cwd: HERE, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (code) =>
      code === 0 ? resolve(stderr) : reject(new Error(`ffmpeg failed:\n${stderr.slice(-4000)}`)),
    );
  });
}

/** Measure decoded duration (seconds) via a null decode. */
async function durationOf(file) {
  const stderr = await ffmpeg(['-i', file, '-f', 'null', '-']);
  const times = [...stderr.matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)];
  if (times.length === 0) throw new Error(`Could not measure duration of ${file}`);
  const [, h, m, s] = times[times.length - 1];
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/**
 * Caption filter for a scene headline (FR-011): white text on a semi-opaque
 * dark pill, horizontally centered, safe-area inset from the BOTTOM (the top
 * hosts the app header and, in S7, the open user menu — the bottom band is
 * always free of UI in every scene). The text lives in a file so punctuation
 * never fights filter-graph escaping.
 */
function captionFilter(sceneId) {
  return (
    `drawtext=textfile=output/scenes/${sceneId}.caption.txt:fontfile='${FONT}'` +
    ':fontsize=52:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=18' +
    ':x=(w-text_w)/2:y=h-text_h-320'
  );
}

/** Build one mobile scene: crop content → top-anchored 9:16 → 1080×1920. */
async function buildMobileScene(scene, seconds, outFile) {
  const filter =
    `crop=${MOBILE_CONTENT.width}:${MOBILE_CONTENT.height}:0:0,` +
    `crop=${MOBILE_CONTENT.width}:${MOBILE_CROP_HEIGHT}:0:0,` +
    'scale=1080:1920:flags=lanczos,setsar=1,fps=30,format=yuv420p,' +
    captionFilter(scene.id);
  await ffmpeg([
    '-y',
    '-ss', String(scene.start),
    '-i', path.join(SCENES_DIR, scene.file),
    '-t', seconds.toFixed(3),
    '-vf', filter,
    '-an',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '21',
    outFile,
  ]);
}

/**
 * Build the S8 desktop-glimpse scene: light branded band, desktop clip framed
 * scaled-to-width with a border, logo + tagline end-card below (contract rule 8).
 */
async function buildDesktopScene(scene, seconds, outFile) {
  const filter =
    // Light brand band as the portrait canvas.
    `color=c=0xe8f0f8:s=1080x1920:r=30:d=${seconds.toFixed(3)}[bg];` +
    // Desktop clip scaled to width with a subtle frame line.
    '[0:v]scale=1000:-2,setsar=1,fps=30,' +
    'pad=1008:ih+8:4:4:color=0x0b2a4a[clip];' +
    // Logo scaled for the end-card area.
    '[1:v]scale=640:-1[logo];' +
    '[bg][clip]overlay=(W-w)/2:430[t1];' +
    '[t1][logo]overlay=(W-w)/2:1180[t2];' +
    // Tagline under the logo, then the standard headline caption pill.
    `[t2]drawtext=text='Try Vii Pass today.':fontfile='${FONT}'` +
    ':fontsize=58:fontcolor=0x0b2a4a:x=(w-text_w)/2:y=1420,' +
    `${captionFilter(scene.id)},format=yuv420p[out]`;
  await ffmpeg([
    '-y',
    '-ss', String(scene.start),
    '-i', path.join(SCENES_DIR, scene.file),
    '-i', LOGO,
    '-t', seconds.toFixed(3),
    '-filter_complex', filter,
    '-map', '[out]',
    '-an',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '21',
    '-t', seconds.toFixed(3),
    outFile,
  ]);
}

async function main() {
  const durations = JSON.parse(await readFile(path.join(SCENES_DIR, 'durations.json'), 'utf8'));
  const clips = JSON.parse(await readFile(path.join(SCENES_DIR, 'clips.json'), 'utf8'));
  const audioByScene = new Map(durations.scenes.map((s) => [s.id, s]));

  // Build each scene at exactly its narration duration.
  const processed = [];
  for (const scene of clips.scenes) {
    const audio = audioByScene.get(scene.id);
    if (!audio) throw new Error(`No narration duration for ${scene.id}`);
    const footage = scene.end - scene.start;
    if (footage + 0.05 < audio.seconds) {
      throw new Error(
        `${scene.id}: footage ${footage.toFixed(2)}s < narration ${audio.seconds.toFixed(2)}s — re-record`,
      );
    }
    await writeFile(path.join(SCENES_DIR, `${scene.id}.caption.txt`), audio.headline);
    const outFile = path.join(SCENES_DIR, `${scene.id}.proc.mp4`);
    console.log(`Building ${scene.id} [${scene.layout}] — ${audio.seconds.toFixed(2)}s…`);
    if (scene.layout === 'desktop-glimpse') {
      await buildDesktopScene(scene, audio.seconds, outFile);
    } else {
      await buildMobileScene(scene, audio.seconds, outFile);
    }
    processed.push({ id: scene.id, file: outFile });
  }

  // Concat the scene videos (identical codec params → stream copy) + voiceover.
  const listFile = path.join(SCENES_DIR, 'video-concat.txt');
  await writeFile(
    listFile,
    processed.map((p) => `file '${p.file.replaceAll('\\', '/')}'`).join('\n'),
  );
  console.log('Concatenating scenes + muxing voiceover…');
  await ffmpeg([
    '-y',
    '-f', 'concat', '-safe', '0', '-i', listFile,
    '-i', VOICEOVER,
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    '-shortest',
    FINAL,
  ]);

  // Report the deliverable's tech facts (contracts/deliverables.md D3).
  const runtime = await durationOf(FINAL);
  const bytes = (await stat(FINAL)).size;
  const drift = Math.abs(runtime - durations.totalSeconds);
  console.log('\nFinal: output/vii-pass-marketing-9x16.mp4');
  console.log(`  runtime:    ${runtime.toFixed(2)}s (voiceover ${durations.totalSeconds.toFixed(2)}s, drift ${drift.toFixed(2)}s)`);
  console.log('  resolution: 1080x1920 (9:16), H.264 yuv420p + AAC, +faststart');
  console.log(`  size:       ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  if (runtime < 50 || runtime > 70) {
    console.error('WARNING: runtime outside 50–70s (SC-001)');
    process.exitCode = 2;
  }
  if (bytes > 40 * 1024 * 1024) {
    console.error('WARNING: file exceeds ~40MB budget — raise CRF and re-run');
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error('Assembly failed:', err);
  process.exit(1);
});
