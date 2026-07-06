import type { FileAssetMeta } from '@vii-pass/shared';
import type { Bindings } from '../env';
import { getObject, putObject } from '../lib/r2';
import { AppError } from '../middleware/error';

/**
 * File/image storage backed by Cloudflare R2 (US3, FR-013).
 *
 * Upload constraints are enforced from configuration BEFORE any bytes are
 * written, so an invalid upload never results in a partial object:
 * - disallowed content type → `415`
 * - oversized payload       → `413`
 */

function parseAllowedContentTypes(env: Bindings): string[] {
  return env.ALLOWED_CONTENT_TYPES.split(',')
    .map((type) => type.trim())
    .filter(Boolean);
}

function parseMaxUploadBytes(env: Bindings): number {
  const value = Number(env.MAX_UPLOAD_BYTES);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Generate a stable, collision-resistant object key, preserving any extension. */
function generateKey(filename: string): string {
  const dot = filename.lastIndexOf('.');
  const ext = dot > 0 ? filename.slice(dot).toLowerCase() : '';
  return `${crypto.randomUUID()}${ext}`;
}

/**
 * Validate then store an uploaded file, returning its {@link FileAssetMeta}.
 * Throws {@link AppError} (415/413) when the file violates the configured limits.
 */
export async function storeFile(env: Bindings, file: File): Promise<FileAssetMeta> {
  const contentType = file.type || 'application/octet-stream';

  const allowed = parseAllowedContentTypes(env);
  if (allowed.length > 0 && !allowed.includes(contentType)) {
    throw new AppError(
      415,
      'unsupported_media_type',
      `Files of type "${contentType}" are not allowed.`,
    );
  }

  const maxBytes = parseMaxUploadBytes(env);
  if (maxBytes > 0 && file.size > maxBytes) {
    throw new AppError(413, 'payload_too_large', `Files must be ${maxBytes} bytes or smaller.`);
  }

  const key = generateKey(file.name || 'upload');
  const bytes = await file.arrayBuffer();
  await putObject(env.BUCKET, key, bytes, contentType);

  return {
    key,
    contentType,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    recordId: null,
  };
}

/** Retrieve a stored object by key, or `null` when it does not exist. */
export async function getFile(env: Bindings, key: string): Promise<R2ObjectBody | null> {
  return getObject(env.BUCKET, key);
}
