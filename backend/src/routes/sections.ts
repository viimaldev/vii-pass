import { Hono } from 'hono';
import type { SectionResponse, SectionsResponse } from '@vii-pass/shared';
import type { AppEnv } from '../env';
import { requireAdmin, requireSession } from '../middleware/requireSession';
import { parseJsonBody } from '../middleware/validate';
import { createSectionSchema, reorderSchema } from '../schemas/sections.schema';
import {
  createSection,
  deleteSection,
  listSections,
  reorderSections,
  updateSection,
} from '../services/sections.service';

/**
 * Sections router (`/api/sections`). Every route requires a valid session and
 * operates only on the authenticated user's own sections (FR-018, FR-019).
 * Mutating routes additionally require an admin-role session (`requireAdmin`,
 * specs/011-dual-user-roles FR-007); reads — including the lazy "Mine"
 * provisioning inside `GET /` — stay role-agnostic. The chord sub-resources
 * are served by the chords router.
 */
export const sectionsRouter = new Hono<AppEnv>();

// All section routes are session-protected.
sectionsRouter.use('*', requireSession);

/**
 * `GET /api/sections` — list the user's sections in order, auto-provisioning the
 * default "Mine" section on first use (FR-002, FR-003).
 */
sectionsRouter.get('/', async (c) => {
  const user = c.get('user');
  const sections = await listSections(c.env, user.id);
  return c.json({ sections } satisfies SectionsResponse);
});

/**
 * `POST /api/sections` — create a section, appended to the end. The client
 * selects it after creation (FR-007).
 */
sectionsRouter.post('/', requireAdmin, async (c) => {
  const user = c.get('user');
  const input = await parseJsonBody(c, createSectionSchema);
  const section = await createSection(c.env, user.id, input);
  return c.json({ section } satisfies SectionResponse, 201);
});

/**
 * `POST /api/sections/reorder` — reorder the user's sections from a full ordered
 * id list; positions are rewritten 0..n-1 (FR-015, FR-017).
 */
sectionsRouter.post('/reorder', requireAdmin, async (c) => {
  const user = c.get('user');
  const { orderedIds } = await parseJsonBody(c, reorderSchema);
  const sections = await reorderSections(c.env, user.id, orderedIds);
  return c.json({ sections } satisfies SectionsResponse);
});

/**
 * `PATCH /api/sections/:sectionId` — rename/recolor a section (US2 edit).
 */
sectionsRouter.patch('/:sectionId', requireAdmin, async (c) => {
  const user = c.get('user');
  const input = await parseJsonBody(c, createSectionSchema);
  const section = await updateSection(c.env, user.id, c.req.param('sectionId'), input);
  return c.json({ section } satisfies SectionResponse);
});

/**
 * `DELETE /api/sections/:sectionId` — delete a section and all its chords
 * (cascade). The default "Mine" section cannot be deleted (`400`).
 */
sectionsRouter.delete('/:sectionId', requireAdmin, async (c) => {
  const user = c.get('user');
  await deleteSection(c.env, user.id, c.req.param('sectionId'));
  return c.body(null, 204);
});
