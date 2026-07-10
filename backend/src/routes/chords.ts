import { Hono } from 'hono';
import type { ChordResponse, ChordsResponse } from '@vii-pass/shared';
import type { AppEnv } from '../env';
import { requireSession } from '../middleware/requireSession';
import { parseJsonBody } from '../middleware/validate';
import { reorderSchema } from '../schemas/sections.schema';
import { createChordSchema, updateChordSchema } from '../schemas/chords.schema';
import {
  createChord,
  deleteChord,
  listChords,
  reorderChords,
  updateChord,
} from '../services/chords.service';

/**
 * Chord routes. Chords are credential entry tiles inside a section. Section-scoped
 * routes (`sectionChordsRouter`) are mounted under `/api/sections` so their paths
 * read `/:sectionId/chords...`; single-chord editing (`chordsRouter`) is mounted
 * under `/api/chords`. Every route requires a valid session and is scoped to the
 * authenticated user's own data (FR-018, FR-019).
 */

/** Section-scoped chord routes, mounted at `/api/sections`. */
export const sectionChordsRouter = new Hono<AppEnv>();

sectionChordsRouter.use('*', requireSession);

/** `GET /api/sections/:sectionId/chords` — list a section's chords in order. */
sectionChordsRouter.get('/:sectionId/chords', async (c) => {
  const user = c.get('user');
  const chords = await listChords(c.env, user.id, c.req.param('sectionId'));
  return c.json({ chords } satisfies ChordsResponse);
});

/** `POST /api/sections/:sectionId/chords` — add a chord to the section. */
sectionChordsRouter.post('/:sectionId/chords', async (c) => {
  const user = c.get('user');
  const input = await parseJsonBody(c, createChordSchema);
  const chord = await createChord(c.env, user.id, c.req.param('sectionId'), input);
  return c.json({ chord } satisfies ChordResponse, 201);
});

/** `POST /api/sections/:sectionId/chords/reorder` — reorder chords in a section. */
sectionChordsRouter.post('/:sectionId/chords/reorder', async (c) => {
  const user = c.get('user');
  const { orderedIds } = await parseJsonBody(c, reorderSchema);
  const chords = await reorderChords(c.env, user.id, c.req.param('sectionId'), orderedIds);
  return c.json({ chords } satisfies ChordsResponse);
});

/** Single-chord routes, mounted at `/api/chords`. */
export const chordsRouter = new Hono<AppEnv>();

chordsRouter.use('*', requireSession);

/** `PATCH /api/chords/:chordId` — edit a chord's placeholder fields. */
chordsRouter.patch('/:chordId', async (c) => {
  const user = c.get('user');
  const input = await parseJsonBody(c, updateChordSchema);
  const chord = await updateChord(c.env, user.id, c.req.param('chordId'), input);
  return c.json({ chord } satisfies ChordResponse);
});

/** `DELETE /api/chords/:chordId` — delete a chord. */
chordsRouter.delete('/:chordId', async (c) => {
  const user = c.get('user');
  await deleteChord(c.env, user.id, c.req.param('chordId'));
  return c.body(null, 204);
});
