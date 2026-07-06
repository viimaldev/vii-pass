import { z } from 'zod';

/**
 * Validation schema for the create-record request body (FR-009).
 * `title` is trimmed and required; `content` is bounded to keep documents small.
 */
export const createRecordSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required.')
    .max(200, 'Title must be 200 characters or fewer.'),
  content: z.string().max(5000, 'Content must be 5,000 characters or fewer.').optional(),
  fileKey: z.string().nullish(),
});

export type CreateRecordInput = z.infer<typeof createRecordSchema>;

/** Validation schema for the list-records query parameters. */
export const listRecordsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type ListRecordsQuery = z.infer<typeof listRecordsQuerySchema>;
