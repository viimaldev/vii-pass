/**
 * record-demo.mjs — Record the demo footage for the marketing video (US3).
 *
 * Strategy: scenes S1–S7 are ONE continuous Playwright recording of a single
 * mobile page (390×844 CSS px @2x — the session cookie, vault key, and tab
 * lease all survive because the page never closes; contract rule 2: single
 * continuous session). Scene boundaries are captured as timestamps and written
 * to `output/scenes/clips.json`; the assembler cuts each scene out of the
 * continuous take. S8 is a separate desktop-viewport (1280×800) take whose
 * sign-in happens before the scene timestamp (never on camera twice).
 *
 * Each scene is paced so its footage lasts at least the scene's narration
 * duration (from durations.json) + a safety buffer, so the assembler can trim
 * exactly to the audio (contract rule 4).
 *
 * Prereqs: dev stack running, demo vault seeded, `npm run voice` done.
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCENES_DIR = path.join(HERE, 'output', 'scenes');
const BASE_URL = 'http://localhost:5173';
const USERNAME = 'viidemo';
const PASSWORD = 'demo123';
/** Extra footage per scene beyond the narration length (trim headroom). */
const SCENE_BUFFER_S = 0.7;
/** Typing cadence for on-camera keystrokes (ms/char) — visibly human. */
const TYPE_DELAY = 100;

/** Click helper: fall back to a DOM click when the decorative background
 * intercepts pointer events (known Playwright quirk in this app). */
async function safeClick(locator) {
  try {
    await locator.click({ timeout: 3000 });
  } catch {
    await locator.evaluate((el) => el.click());
  }
}

/** Measure a media file's decoded duration in seconds via ffmpeg null-decode. */
function durationOf(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-i', file, '-f', 'null', '-'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', () => {
      const times = [...stderr.matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)];
      if (times.length === 0) return reject(new Error(`Could not measure ${file}`));
      const [, h, m, s] = times[times.length - 1];
      resolve(Number(h) * 3600 + Number(m) * 60 + Number(s));
    });
  });
}

/**
 * Scene clock: marks scene start/end offsets relative to an anchor timestamp
 * taken right after the recorded page was created. The final offsets are
 * corrected by the actual video length after the take is saved (any recording
 * lead-in before the anchor shifts every scene equally).
 */
class SceneClock {
  constructor() {
    this.t0 = Date.now();
    this.marks = [];
  }

  start(id) {
    this.current = { id, start: (Date.now() - this.t0) / 1000 };
  }

  /** Hold the scene until it has lasted at least `seconds` from its start. */
  async holdUntil(page, seconds) {
    const elapsed = (Date.now() - this.t0) / 1000 - this.current.start;
    if (elapsed < seconds) await page.waitForTimeout((seconds - elapsed) * 1000);
    this.current.end = (Date.now() - this.t0) / 1000;
    this.marks.push(this.current);
  }

  /** Total wall-clock seconds since the anchor. */
  total() {
    return (Date.now() - this.t0) / 1000;
  }
}

/** Record the continuous mobile take covering S1–S7. */
async function recordMobileSession(browser, need) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    recordVideo: { dir: SCENES_DIR, size: { width: 780, height: 1688 } },
  });
  const page = await context.newPage();
  const clock = new SceneClock();

  // --- S1: brand beat on the login page (no interaction). ---
  await page.goto(`${BASE_URL}/login`);
  await page.locator('img.auth-logo').waitFor();
  clock.start('S1');
  await clock.holdUntil(page, need('S1'));

  // --- S2: type credentials, sign in, vault appears. ---
  clock.start('S2');
  await page.locator('#login-username').pressSequentially(USERNAME, { delay: TYPE_DELAY });
  await page.locator('#login-password').pressSequentially(PASSWORD, { delay: TYPE_DELAY });
  await safeClick(page.getByRole('button', { name: 'Sign in' }));
  await page.locator('.section-tabs').waitFor({ timeout: 20000 });
  await clock.holdUntil(page, need('S2'));

  // --- S3: switch between the color-coded section tabs. ---
  clock.start('S3');
  for (const tab of ['Work', 'Personal', 'Mine', 'Personal', 'Work']) {
    await safeClick(page.getByRole('tab', { name: tab }));
    await page.waitForTimeout(1300);
  }
  await clock.holdUntil(page, need('S3'));

  // --- S4: linger on an entry card (title link + typed field rows). ---
  const card = page.locator('.chord-card', { hasText: 'Acme Mail' });
  await card.scrollIntoViewIfNeeded();
  clock.start('S4');
  await clock.holdUntil(page, need('S4'));

  // --- S5: reveal the one sanctioned fake password, copy it, re-mask. ---
  clock.start('S5');
  await page.waitForTimeout(800);
  await safeClick(card.getByRole('button', { name: 'Show Password' }));
  await page.waitForTimeout(2200);
  await safeClick(card.getByRole('button', { name: 'Copy Password' }));
  await page.waitForTimeout(1800);
  await safeClick(card.getByRole('button', { name: 'Hide Password' }));
  await clock.holdUntil(page, need('S5'));

  // --- S6: create an entry on camera (the encrypted save moment). ---
  clock.start('S6');
  await safeClick(page.getByRole('button', { name: 'Add an entry' }));
  await page.locator('#chord-form').waitFor();
  await page.getByLabel(/^Title/).pressSequentially('Team Wiki', { delay: TYPE_DELAY });
  await page
    .locator('#chord-form .chord-form-row')
    .first()
    .locator('input')
    .pressSequentially('alex.morgan', { delay: 70 });
  await safeClick(page.locator('button[form="chord-form"][type="submit"]'));
  await page.locator('.vault-modal').waitFor({ state: 'detached', timeout: 15000 });
  await page.locator('.chord-card', { hasText: 'Team Wiki' }).waitFor();
  await clock.holdUntil(page, need('S6'));

  // --- S7: theme montage via the user menu (dark → light → auto). ---
  clock.start('S7');
  await safeClick(page.getByRole('button', { name: /Account menu for/ }));
  await page.waitForTimeout(1200);
  await safeClick(page.getByRole('menuitemradio', { name: 'Dark theme' }));
  await page.waitForTimeout(2200);
  await safeClick(page.getByRole('menuitemradio', { name: 'Light theme' }));
  await page.waitForTimeout(1800);
  await safeClick(page.getByRole('menuitemradio', { name: 'Auto theme' }));
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');
  await clock.holdUntil(page, need('S7'));

  // --- Off-camera cleanup (after the last scene mark, cut away later):
  // delete the entry S6 created so re-runs stay idempotent. ---
  await safeClick(page.getByRole('button', { name: 'Edit Team Wiki' }));
  await page.locator('.vault-modal').waitFor();
  await safeClick(page.getByRole('button', { name: 'Delete entry' }));
  await safeClick(page.getByRole('button', { name: 'Delete entry' }).last());
  await page.locator('.vault-modal').waitFor({ state: 'detached', timeout: 15000 });

  const elapsedAtClose = clock.total();
  const video = page.video();
  await context.close();
  const file = path.join(SCENES_DIR, 'mobile-session.webm');
  await video.saveAs(file);
  await video.delete();

  // Correct offsets: any footage recorded before the clock anchor shifts all
  // scenes forward by the same lead-in amount.
  const videoSeconds = await durationOf(file);
  const leadIn = Math.max(0, videoSeconds - elapsedAtClose);
  return clock.marks.map((mark) => ({
    id: mark.id,
    layout: 'mobile',
    file: 'mobile-session.webm',
    start: Math.max(0, mark.start + leadIn),
    end: mark.end + leadIn,
  }));
}

/** Record the S8 desktop-glimpse take (sign-in happens BEFORE the scene mark). */
async function recordDesktopGlimpse(browser, need) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: SCENES_DIR, size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();
  const clock = new SceneClock();

  // Off-camera portion: sign in and let the desktop vault settle.
  await page.goto(`${BASE_URL}/login`);
  await page.fill('#login-username', USERNAME);
  await page.fill('#login-password', PASSWORD);
  await safeClick(page.getByRole('button', { name: 'Sign in' }));
  await page.locator('.section-tabs').waitFor({ timeout: 20000 });
  await safeClick(page.getByRole('tab', { name: 'Work' }));
  await page.waitForTimeout(1000);

  // On-camera portion: the desktop layout beauty shot with one tab switch.
  clock.start('S8');
  await page.waitForTimeout(2000);
  await safeClick(page.getByRole('tab', { name: 'Personal' }));
  await clock.holdUntil(page, need('S8'));

  const elapsedAtClose = clock.total();
  const video = page.video();
  await context.close();
  const file = path.join(SCENES_DIR, 'desktop-glimpse.webm');
  await video.saveAs(file);
  await video.delete();

  const videoSeconds = await durationOf(file);
  const leadIn = Math.max(0, videoSeconds - elapsedAtClose);
  const mark = clock.marks[0];
  return [
    {
      id: 'S8',
      layout: 'desktop-glimpse',
      file: 'desktop-glimpse.webm',
      start: Math.max(0, mark.start + leadIn),
      end: mark.end + leadIn,
    },
  ];
}

async function main() {
  await mkdir(SCENES_DIR, { recursive: true });
  const durations = JSON.parse(
    await readFile(path.join(SCENES_DIR, 'durations.json'), 'utf8'),
  );
  const audioSeconds = new Map(durations.scenes.map((s) => [s.id, s.seconds]));
  /** Minimum on-camera length for a scene = its narration + trim headroom. */
  const need = (id) => {
    const seconds = audioSeconds.get(id);
    if (!seconds) throw new Error(`No narration duration for ${id} — run npm run voice first`);
    return seconds + SCENE_BUFFER_S;
  };

  const browser = await chromium.launch();
  console.log('Recording mobile session (S1–S7)…');
  const mobileClips = await recordMobileSession(browser, need);
  console.log('Recording desktop glimpse (S8)…');
  const desktopClips = await recordDesktopGlimpse(browser, need);
  await browser.close();

  const clips = [...mobileClips, ...desktopClips];
  for (const clip of clips) {
    const have = clip.end - clip.start;
    const wanted = need(clip.id);
    const flag = have + 0.05 >= wanted ? 'ok' : 'SHORT!';
    console.log(
      `  ${clip.id} [${clip.layout}] ${clip.start.toFixed(2)}–${clip.end.toFixed(2)}s ` +
        `(${have.toFixed(2)}s for ${audioSeconds.get(clip.id).toFixed(2)}s audio) ${flag}`,
    );
  }
  await writeFile(
    path.join(SCENES_DIR, 'clips.json'),
    JSON.stringify({ scenes: clips }, null, 2),
  );
  console.log('Wrote output/scenes/clips.json');
}

main().catch((err) => {
  console.error('Recording failed:', err);
  process.exit(1);
});
