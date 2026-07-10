import { z } from 'zod';

/**
 * Zod schemas validating the chords request bodies at the API boundary. Chord
 * fields are placeholders (`field1`/`field2`/`field3`) for this feature — the
 * real credential fields arrive in a later feature. Each is an optional, nullable
 * string capped at 200 characters.
 */

/** A single optional placeholder field: string ≤ 200 chars, or null. */
const placeholderField = z
  .string()
  .max(200, 'Value must be 200 characters or fewer.')
  .nullable()
  .optional();

/** Create-chord input: any subset of the three placeholder fields. */
export const createChordSchema = z.object({
  field1: placeholderField,
  field2: placeholderField,
  field3: placeholderField,
});

/** Update-chord input: same shape as create (all fields optional). */
export const updateChordSchema = z.object({
  field1: placeholderField,
  field2: placeholderField,
  field3: placeholderField,
});

export type CreateChordInput = z.infer<typeof createChordSchema>;
export type UpdateChordInput = z.infer<typeof updateChordSchema>;
