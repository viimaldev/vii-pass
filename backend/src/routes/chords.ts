import { Hono } from 'hono';
import type { ChordResponse, ChordsResponse } from '@vii-pass/shared';
import type { AppEnv } from '../env';
import { requireAdmin, requireSession } from '../middleware/requireSession';
import { parseJsonBody } from '../middleware/validate';
import { reorderSchema } from '../schemas/sections.schema';
import { createChordSchema, updateChordSchema } from '../schemas/chords.schema';
import {
  createChord,
  deleteChord,
  reorderChords,
  updateChord,
} from '../services/chords.service';

/**
 * Chord routes. Chords are credential entries inside a section: a title (unique
 * per section, case-insensitively — duplicates get a `409 chord_title_taken`),
 * an optional normalized `http(s)` URL, and exactly three typed option rows.
 * Section-scoped routes (`sectionChordsRouter`) are mounted under `/api/sections`
 * so their paths read `/:sectionId/chords...`; single-chord editing
 * (`chordsRouter`) is mounted under `/api/chords`. Every route requires a valid
 * session and is scoped to the authenticated user's own data (FR-015); all
 * remaining routes are mutations and additionally require an admin-role session
 * (`requireAdmin`, specs/011-dual-user-roles FR-007). Chord READS are served
 * exclusively by the vault aggregate (`GET /api/vault`,
 * specs/015-vault-perf-caching) — the per-section list route was retired.
 */

/** Section-scoped chord routes, mounted at `/api/sections`. */
export const sectionChordsRouter = new Hono<AppEnv>();

sectionChordsRouter.use('*', requireSession);

/** `POST /api/sections/:sectionId/chords` — add a chord (409 on duplicate title). */
sectionChordsRouter.post('/:sectionId/chords', requireAdmin, async (c) => {
  const user = c.get('user');
  const input = await parseJsonBody(c, createChordSchema);
  const chord = await createChord(c.env, user.id, c.req.param('sectionId'), input);
  return c.json({ chord } satisfies ChordResponse, 201);
});

/** `POST /api/sections/:sectionId/chords/reorder` — reorder chords in a section. */
sectionChordsRouter.post('/:sectionId/chords/reorder', requireAdmin, async (c) => {
  const user = c.get('user');
  const { orderedIds } = await parseJsonBody(c, reorderSchema);
  const chords = await reorderChords(c.env, user.id, c.req.param('sectionId'), orderedIds);
  return c.json({ chords } satisfies ChordsResponse);
});

/** Single-chord routes, mounted at `/api/chords`. */
export const chordsRouter = new Hono<AppEnv>();

chordsRouter.use('*', requireSession);

/** `PATCH /api/chords/:chordId` — edit a chord's title, URL, and option rows. */
chordsRouter.patch('/:chordId', requireAdmin, async (c) => {
  const user = c.get('user');
  const input = await parseJsonBody(c, updateChordSchema);
  const chord = await updateChord(c.env, user.id, c.req.param('chordId'), input);
  return c.json({ chord } satisfies ChordResponse);
});

/** `DELETE /api/chords/:chordId` — delete a chord. */
chordsRouter.delete('/:chordId', requireAdmin, async (c) => {
  const user = c.get('user');
  await deleteChord(c.env, user.id, c.req.param('chordId'));
  return c.body(null, 204);
});
