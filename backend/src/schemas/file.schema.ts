import { z } from 'zod';

/**
 * Validation schema for stored file metadata. The runtime upload constraints
 * (allowed content types and maximum size) are enforced in `files.service.ts`
 * using the `ALLOWED_CONTENT_TYPES` and `MAX_UPLOAD_BYTES` environment values,
 * because those limits are configuration-driven (FR-013).
 */
export const fileAssetMetaSchema = z.object({
  key: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().positive(),
  uploadedAt: z.string(),
  recordId: z.string().nullish(),
});

export type FileAssetMetaInput = z.infer<typeof fileAssetMetaSchema>;
