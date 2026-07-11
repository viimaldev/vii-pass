import { z } from 'zod';

/**
 * Zod schemas validating chord request bodies at the API boundary
 * (specs/009-chord-credential-fields). A chord payload carries a required
 * `title`, an optional `url` (normalized here so every stored URL is a safe,
 * absolute `http(s)` address), and exactly three typed option rows.
 */

/** The five credential types selectable on an option row. */
export const chordFieldTypeSchema = z.enum([
  'username',
  'email',
  'password',
  'other',
  'otherSensitive',
]);

/**
 * One option row: a credential type plus a value. Values are trimmed and an
 * empty string becomes `null` (row unused — the type is still persisted so the
 * edit form round-trips the user's dropdown selection).
 */
const chordFieldSchema = z.object({
  type: chordFieldTypeSchema,
  value: z
    .string()
    .max(200, 'Value must be 200 characters or fewer.')
    .nullable()
    .transform((value) => {
      const trimmed = value?.trim() ?? '';
      return trimmed.length > 0 ? trimmed : null;
    }),
});

/** Required display title: trimmed, 1–100 chars (uniqueness enforced in the service). */
const titleField = z
  .string({ required_error: 'Title is required.' })
  .trim()
  .min(1, 'Title is required.')
  .max(100, 'Title must be 100 characters or fewer.');

/**
 * Optional URL, normalized to a safe absolute web address:
 * - blank/absent → `null`;
 * - scheme-less input (e.g. `example.com`) gets `https://` prepended;
 * - the result must parse as a URL with an `http:`/`https:` protocol — every
 *   other scheme (`javascript:`, `data:`, `file:`, …) is rejected. This is the
 *   security boundary that lets the client render `chord.url` directly into an
 *   `href` (OWASP A03: stored-XSS via crafted URLs).
 */
const urlField = z
  .string()
  .max(2048, 'Web address must be 2048 characters or fewer.')
  .nullable()
  .optional()
  .transform((value, ctx) => {
    const trimmed = value?.trim() ?? '';
    if (trimmed.length === 0) return null;
    // Prepend https:// when no scheme is present (e.g. "example.com/login").
    const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid web address.' });
      return z.NEVER;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid web address.' });
      return z.NEVER;
    }
    if (parsed.href.length > 2048) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Web address must be 2048 characters or fewer.',
      });
      return z.NEVER;
    }
    return parsed.href;
  });

/**
 * Full chord payload. Create and update accept the identical shape — the whole
 * editable state (title, url, all three rows) is sent on every save.
 */
const chordPayloadSchema = z.object({
  title: titleField,
  url: urlField,
  fields: z
    .array(chordFieldSchema)
    .length(3, 'Exactly three option rows are required.'),
});

/** Create-chord input. */
export const createChordSchema = chordPayloadSchema;

/** Update-chord input (same shape as create). */
export const updateChordSchema = chordPayloadSchema;

export type CreateChordInput = z.infer<typeof createChordSchema>;
export type UpdateChordInput = z.infer<typeof updateChordSchema>;
