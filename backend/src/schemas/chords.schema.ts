import { z } from 'zod';

/**
 * Zod schemas validating chord request bodies at the API boundary
 * (specs/010-credential-encryption). Since end-to-end encryption, `url` and
 * `fields[].value` arrive as Level-1 AES-GCM envelopes (`v1.l1.<iv>.<ct>`)
 * produced in the browser — the server validates the envelope SHAPE only and
 * rejects anything plaintext-looking (FR-009 backstop). The plaintext rules
 * (value length, URL allow-list) are enforced client-side pre-encryption.
 */

/** Level-1 envelope: `v1.l1.<12-byte IV b64url>.<ciphertext b64url>`. */
const L1_ENVELOPE_RE = /^v1\.l1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/;

/** The five credential types selectable on an option row. */
export const chordFieldTypeSchema = z.enum([
  'username',
  'email',
  'password',
  'other',
  'otherSensitive',
]);

/**
 * One option row: a credential type plus an encrypted value. `null` means the
 * row is unused (the type is still persisted so the edit form round-trips the
 * user's dropdown selection); non-null values must be L1 envelopes.
 */
const chordFieldSchema = z.object({
  type: chordFieldTypeSchema,
  value: z
    .string()
    .max(1024, 'Invalid encrypted value.')
    .regex(L1_ENVELOPE_RE, 'Invalid encrypted value.')
    .nullable(),
});

/** Required display title: trimmed, 1–100 chars (uniqueness enforced in the service). */
const titleField = z
  .string({ required_error: 'Title is required.' })
  .trim()
  .min(1, 'Title is required.')
  .max(100, 'Title must be 100 characters or fewer.');

/**
 * Optional URL, encrypted client-side like every other secret value: `null` or
 * an L1 envelope. The `http(s)` allow-list and `https://`-prepend normalization
 * moved to the client (pre-encrypt in the form, re-checked at decrypt-render
 * before use as an `href` — the stored-XSS boundary now sits in the browser).
 */
const urlField = z
  .string()
  .max(4096, 'Invalid encrypted value.')
  .regex(L1_ENVELOPE_RE, 'Invalid encrypted value.')
  .nullable()
  .optional()
  .transform((value) => value ?? null);

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
