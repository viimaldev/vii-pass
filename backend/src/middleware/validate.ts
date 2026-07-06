import type { Context } from 'hono';
import { z, type ZodTypeAny } from 'zod';
import { AppError } from './error';

/**
 * Reusable Zod validation helpers used at the API boundary (FR-009).
 *
 * On failure they throw an {@link AppError} with status 400, which the central
 * error handler renders as a non-leaky {@link ApiError}. On success they return
 * fully typed, parsed data via Zod inference.
 */

function formatIssues(error: z.ZodError, fallbackPath: string): string {
  return (
    error.issues
      .map((issue) => `${issue.path.join('.') || fallbackPath}: ${issue.message}`)
      .join('; ') || 'Invalid request.'
  );
}

/** Parse and validate a JSON request body against `schema`. */
export async function parseJsonBody<T extends ZodTypeAny>(
  c: Context,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new AppError(400, 'invalid_json', 'Request body must be valid JSON.');
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new AppError(400, 'validation_error', formatIssues(result.error, 'body'));
  }
  return result.data;
}

/** Parse and validate query parameters against `schema`. */
export function parseQuery<T extends ZodTypeAny>(c: Context, schema: T): z.infer<T> {
  const result = schema.safeParse(c.req.query());
  if (!result.success) {
    throw new AppError(400, 'validation_error', formatIssues(result.error, 'query'));
  }
  return result.data;
}
