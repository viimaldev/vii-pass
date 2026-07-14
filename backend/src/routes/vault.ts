import { Hono } from 'hono';
import type { VaultResponse } from '@vii-pass/shared';
import type { AppEnv } from '../env';
import { requireSession } from '../middleware/requireSession';
import { listSections } from '../services/sections.service';
import { listAllChords } from '../services/chords.service';

/**
 * Vault aggregate router (`/api/vault`, specs/015-vault-perf-caching). One
 * read-only route returns the authenticated user's complete organizer — every
 * section plus every chord (flat, `(sectionId, position)`-sorted) — so the SPA
 * loads the whole vault once per signed-in page visit and serves section
 * switches from memory (FR-001/FR-002).
 *
 * Reads are role-agnostic: `admin` and `normal` sessions receive identical
 * data (FR-007), so there is no `requireAdmin` here. Reusing `listSections`
 * preserves the lazy "Mine" auto-provisioning for first-time users, and
 * `listAllChords` applies the same Level-2 unwrap (with per-field `"v1.err"`
 * isolation) as the mutation responses — clients only ever see L1 envelopes.
 */
export const vaultRouter = new Hono<AppEnv>();

// All vault routes are session-protected.
vaultRouter.use('*', requireSession);

/** `GET /api/vault` — the user's complete organizer in one response. */
vaultRouter.get('/', async (c) => {
  const user = c.get('user');
  // Sections first: this lazily provisions the default "Mine" section for a
  // brand-new user before the (then empty) chord list is built.
  const sections = await listSections(c.env, user.id);
  const chords = await listAllChords(c.env, user.id);
  return c.json({ sections, chords } satisfies VaultResponse);
});
