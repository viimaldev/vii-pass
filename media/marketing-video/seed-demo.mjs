/**
 * seed-demo.mjs — Seed the marketing-demo account + vault through the REAL UI.
 *
 * Registers the demo account (viidemo / viidemoview, "Alex Morgan", pw demo123,
 * security answer "rex") at http://localhost:5173, then creates two sections
 * (Work, Personal) and four fake-by-construction credential entries, exercising
 * the genuine client-side crypto pipeline (research Decision 5 — never insert
 * documents directly into MongoDB).
 *
 * Prereqs: the local dev stack must be running (`npm run dev:node` from repo
 * root) against the preview database. Re-run safety: if `viidemo` can already
 * sign in, the script prints drop-and-reseed instructions and exits(1).
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';

/** Demo identity (specs/022 data-model.md — all values fake by construction). */
const DEMO = {
  adminUsername: 'viidemo',
  viewUsername: 'viidemoview',
  displayName: 'Alex Morgan',
  password: 'demo123',
  securityQuestionId: '0',
  securityAnswer: 'rex',
};

/** Sections with distinct on-brand palette colors (SectionDialog PALETTE hexes). */
const SECTIONS = [
  { name: 'Work', color: '#0b5cad' },
  { name: 'Personal', color: '#1a7f37' },
];

/** Four demo entries — values are obviously fake (example.com, Fake!Pass1 style). */
const ENTRIES = [
  {
    section: 'Work',
    title: 'Acme Mail',
    url: 'https://mail.example.com',
    rows: [
      { type: 'email', value: 'alex@example.com' },
      { type: 'password', value: 'Fake!Pass1' },
      { type: 'other', value: '' },
    ],
  },
  {
    section: 'Work',
    title: 'Bank of Example',
    url: 'https://bank.example.com',
    rows: [
      { type: 'username', value: 'alex.morgan' },
      { type: 'password', value: 'Fake!Pass2' },
      { type: 'otherSensitive', value: '1234-demo-pin' },
    ],
  },
  {
    section: 'Personal',
    title: 'Wi-Fi Home',
    url: '',
    rows: [
      { type: 'other', value: 'HomeNet-5G' },
      { type: 'password', value: 'Fake!Wifi3' },
      { type: 'other', value: '' },
    ],
  },
  {
    section: 'Personal',
    title: 'Streaming',
    url: 'https://stream.example.com',
    rows: [
      { type: 'email', value: 'alex@example.com' },
      { type: 'password', value: 'Fake!Play4' },
      { type: 'other', value: '' },
    ],
  },
];

/**
 * Click helper for this app: Playwright occasionally reports
 * "html intercepts pointer events" (decorative page background), so fall back
 * to a DOM-level click when the normal pointer click cannot land.
 */
async function safeClick(locator) {
  try {
    await locator.click({ timeout: 3000 });
  } catch {
    await locator.evaluate((el) => el.click());
  }
}

/** Wait until no vault modal is open (dialog save round-trip finished). */
async function waitForModalClosed(page) {
  await page.locator('.vault-modal').waitFor({ state: 'detached', timeout: 15000 });
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // --- Re-run guard: if viidemo already signs in, refuse to double-seed. ---
  await page.goto(`${BASE_URL}/login`);
  await page.fill('#login-username', DEMO.adminUsername);
  await page.fill('#login-password', DEMO.password);
  await safeClick(page.getByRole('button', { name: 'Sign in' }));
  const existing = await Promise.race([
    page.locator('.section-tabs').waitFor({ timeout: 10000 }).then(() => true),
    page.locator('[role="alert"]').waitFor({ timeout: 10000 }).then(() => false),
  ]).catch(() => false);
  if (existing) {
    console.error(
      [
        `Demo account "${DEMO.adminUsername}" already exists — refusing to double-seed.`,
        'To reseed, drop the demo data from the preview database and re-run:',
        '  1. mongosh "<preview MONGODB_URI>"',
        '  2. use vii_pass_preview',
        '  3. db.users.deleteMany({"logins.username":"viidemo"}) // then clear its sections/chords/sessions',
        '     (or drop the users/sessions/sections/chords collections entirely for a clean slate)',
        '  4. npm run seed',
      ].join('\n'),
    );
    await browser.close();
    process.exit(1);
  }

  // --- Register the dual-username demo account through the real form. ---
  console.log('Registering demo account…');
  await page.goto(`${BASE_URL}/register`);
  await page.fill('#register-admin-username', DEMO.adminUsername);
  await page.fill('#register-username', DEMO.viewUsername);
  await page.fill('#register-name', DEMO.displayName);
  await page.fill('#register-password', DEMO.password);
  await page.selectOption('#register-question', DEMO.securityQuestionId);
  await page.fill('#register-answer', DEMO.securityAnswer);
  await safeClick(page.getByRole('button', { name: 'Create account' }));
  // Success navigates to "/" and the vault (default "Mine" tab) renders.
  await page.locator('.section-tabs').waitFor({ timeout: 20000 });
  console.log('Registered + signed in as admin.');

  // --- Create the two colored sections. ---
  for (const section of SECTIONS) {
    console.log(`Creating section "${section.name}"…`);
    await safeClick(page.getByRole('button', { name: 'Add a section' }));
    await page.locator('#section-form').waitFor();
    await page.locator('#section-form input[type="text"]').fill(section.name);
    await safeClick(page.getByRole('button', { name: `Use color ${section.color}` }));
    await safeClick(page.locator('button[form="section-form"][type="submit"]'));
    await waitForModalClosed(page);
  }

  // --- Create the four entries in their sections. ---
  for (const entry of ENTRIES) {
    console.log(`Creating entry "${entry.title}" in "${entry.section}"…`);
    await safeClick(page.getByRole('tab', { name: entry.section }));
    await safeClick(page.getByRole('button', { name: 'Add an entry' }));
    await page.locator('#chord-form').waitFor();
    await page.getByLabel(/^Title/).fill(entry.title);
    if (entry.url) {
      await page.getByLabel(/^URL/).fill(entry.url);
    }
    for (let i = 0; i < entry.rows.length; i += 1) {
      const row = page.locator('#chord-form .chord-form-row').nth(i);
      await row.locator('select').selectOption(entry.rows[i].type);
      if (entry.rows[i].value) {
        await row.locator('input').fill(entry.rows[i].value);
      }
    }
    await safeClick(page.locator('button[form="chord-form"][type="submit"]'));
    await waitForModalClosed(page);
  }

  // --- Verify: each section renders its entries, no error banners. ---
  for (const entry of ENTRIES) {
    await safeClick(page.getByRole('tab', { name: entry.section }));
    await page.locator('.chord-card', { hasText: entry.title }).waitFor({ timeout: 10000 });
  }
  const errorBanners = await page.locator('.alert--error, [role="alert"].alert').count();
  if (errorBanners > 0) {
    throw new Error(`Seed verification found ${errorBanners} visible error banner(s).`);
  }

  console.log('Seed complete: 2 sections + 4 entries verified at 390×844.');
  await browser.close();
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
