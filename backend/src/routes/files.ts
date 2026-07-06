import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { AppError } from '../middleware/error';
import { getFile, storeFile } from '../services/files.service';

/**
 * Files router (US3): `POST /api/files` (multipart upload) and
 * `GET /api/files/:key` (stream download).
 *
 * Validation (415/413) happens in the service before any write, so rejected
 * uploads store nothing (FR-013).
 */
export const filesRouter = new Hono<AppEnv>();

filesRouter.post('/', async (c) => {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw new AppError(400, 'invalid_form', 'Expected a multipart/form-data upload.');
  }

  const file = form.get('file');
  if (file === null || typeof file === 'string') {
    throw new AppError(400, 'missing_file', 'A file field named "file" is required.');
  }

  const meta = await storeFile(c.env, file);
  return c.json(meta, 201);
});

filesRouter.get('/:key', async (c) => {
  const key = c.req.param('key');
  const object = await getFile(c.env, key);
  if (!object) {
    throw new AppError(404, 'not_found', 'No file was found for that key.');
  }

  const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream';
  return new Response(object.body, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(object.size),
    },
  });
});
