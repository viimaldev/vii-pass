import { z } from 'zod';

/**
 * Zod schemas validating the sections request bodies at the API boundary.
 * Sections are color-coded tabs owned by the authenticated user; the name is a
 * free label (not unique) and the color is a validated hex string so it can be
 * used directly as a CSS value.
 */

/** Hex color `#RRGGBB` (case-insensitive). */
const colorField = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #3366cc.');

/** Create-section input: a required name (1–50 chars) and a hex color. */
export const createSectionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Section name is required.')
    .max(50, 'Section name must be 50 characters or fewer.'),
  color: colorField,
});

/**
 * Reorder input: the full ordered list of ids in the scope. The server rewrites
 * positions 0..n-1 from this list, so it must contain every id exactly once.
 */
export const reorderSchema = z.object({
  orderedIds: z
    .array(z.string().trim().min(1, 'Ids must be non-empty.'))
    .min(1, 'orderedIds must contain at least one id.'),
});

export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type ReorderInput = z.infer<typeof reorderSchema>;
