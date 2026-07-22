/**
 * generate-voiceover.mjs — AI voiceover for the marketing script (US2).
 *
 * Parses the scene table in `script.md`, synthesizes each scene's narration
 * with Microsoft Edge neural TTS (`msedge-tts`, voice en-US-AriaNeural — free
 * endpoint, no API key), pads a short breath of silence after each scene,
 * concatenates the scenes into `output/voiceover.mp3`, and writes
 * `output/scenes/durations.json` (per-scene + total seconds) for the video
 * assembler (contract rule 4: sync unit = scene).
 */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_MD = path.join(HERE, 'script.md');
const SCENES_DIR = path.join(HERE, 'output', 'scenes');
const FULL_TRACK = path.join(HERE, 'output', 'voiceover.mp3');

/**
 * Neural voice for the narration (research Decision 1). Override with the
 * VOICE env var to audition alternatives (e.g. `en-US-GuyNeural` for male).
 */
const VOICE = process.env.VOICE || 'en-US-AriaNeural';
/**
 * Gentle speaking-rate lift: Aria's natural pace (~137 wpm) lands the 161-word
 * script just over the 70s ceiling; +10% brings it to ~67s while still
 * sounding natural (script wording unchanged — SC-001).
 */
const RATE = '+10%';
/** Trailing silence per scene (breathing room between scenes), seconds. */
const SCENE_PAD_SECONDS = 0.35;

/**
 * Parse the scene table out of script.md. Rows look like:
 * `| S1 | Headline | Narration | TTS input | On-screen action | Covers |`
 * The TTS-input cell `(same)` means "read the narration column verbatim".
 */
async function parseScenes() {
  const md = await readFile(SCRIPT_MD, 'utf8');
  const scenes = [];
  for (const line of md.split('\n')) {
    const match = /^\|\s*(S\d+)\s*\|/.exec(line);
    if (!match) continue;
    const cells = line.split('|').map((cell) => cell.trim());
    // cells[0] is the empty string before the leading pipe. Skip short rows
    // (e.g. the word-count table) — only the 6-column scene table qualifies.
    if (cells.length < 7) continue;
    const [, id, headline, narration, ttsInput] = cells;
    scenes.push({
      id,
      headline,
      narration,
      // Strip inline-code backticks so the voice never reads punctuation noise.
      ttsText: (ttsInput === '(same)' ? narration : ttsInput).replaceAll('`', ''),
    });
  }
  if (scenes.length === 0) throw new Error(`No scene rows found in ${SCRIPT_MD}`);
  return scenes;
}

/** Run the bundled ffmpeg binary, failing loudly on a non-zero exit. */
function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (code) =>
      code === 0 ? resolve(stderr) : reject(new Error(`ffmpeg ${args[0]} failed:\n${stderr}`)),
    );
  });
}

/** Measure a file's real decoded duration in seconds (ffmpeg null decode). */
async function durationOf(file) {
  const stderr = await ffmpeg(['-i', file, '-f', 'null', '-']);
  const times = [...stderr.matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)];
  if (times.length === 0) throw new Error(`Could not measure duration of ${file}`);
  const [, h, m, s] = times[times.length - 1];
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/** Synthesize one scene's narration to an MP3 file via Edge TTS (msedge-tts v2). */
async function synthesize(text, outFile) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioStream } = await tts.toStream(text, { rate: RATE });
  await new Promise((resolve, reject) => {
    const sink = createWriteStream(outFile);
    audioStream.pipe(sink);
    audioStream.on('error', reject);
    sink.on('error', reject);
    sink.on('finish', resolve);
  });
}

async function main() {
  await mkdir(SCENES_DIR, { recursive: true });
  const scenes = await parseScenes();
  console.log(`Parsed ${scenes.length} scenes from script.md — synthesizing with ${VOICE}…`);

  const entries = [];
  for (const scene of scenes) {
    const raw = path.join(SCENES_DIR, `${scene.id}.raw.mp3`);
    const padded = path.join(SCENES_DIR, `${scene.id}.mp3`);
    await synthesize(scene.ttsText, raw);
    // Re-encode with a short trailing pad: breathing room between scenes and a
    // consistent bitstream for the concat step.
    await ffmpeg([
      '-y', '-i', raw,
      '-af', `apad=pad_dur=${SCENE_PAD_SECONDS}`,
      '-c:a', 'libmp3lame', '-q:a', '4',
      padded,
    ]);
    const seconds = await durationOf(padded);
    entries.push({ id: scene.id, headline: scene.headline, file: `${scene.id}.mp3`, seconds });
    console.log(`  ${scene.id}: ${seconds.toFixed(2)}s — "${scene.headline}"`);
  }

  // Concatenate the padded scene tracks into the full voiceover.
  const listFile = path.join(SCENES_DIR, 'concat.txt');
  await writeFile(
    listFile,
    entries.map((e) => `file '${path.join(SCENES_DIR, e.file).replaceAll('\\', '/')}'`).join('\n'),
  );
  await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', FULL_TRACK]);

  const total = await durationOf(FULL_TRACK);
  await writeFile(
    path.join(SCENES_DIR, 'durations.json'),
    JSON.stringify({ voice: VOICE, scenes: entries, totalSeconds: total }, null, 2),
  );

  console.log(`\nFull track: output/voiceover.mp3 — ${total.toFixed(2)}s`);
  if (total < 50 || total > 70) {
    console.error('WARNING: total duration is outside the 50–70s window (SC-001).');
    process.exitCode = 2;
  } else {
    console.log('Duration within the 50–70s window (SC-001) ✓');
  }
}

main().catch((err) => {
  console.error('Voiceover generation failed:', err);
  process.exit(1);
});
