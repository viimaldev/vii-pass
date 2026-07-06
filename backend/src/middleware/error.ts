import type { Context } from 'hono';
import type { ApiError } from '@vii-pass/shared';

/** HTTP statuses the API deliberately returns via {@link AppError}. */
export type HttpErrorStatus = 400 | 404 | 413 | 415 | 500 | 503;

/**
 * An error that carries an HTTP status and a stable, client-safe error code.
 * Throwing an `AppError` from any handler produces a consistent {@link ApiError}
 * response via {@link onError}.
 */
export class AppError extends Error {
  readonly status: HttpErrorStatus;
  readonly code: string;

  constructor(status: HttpErrorStatus, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

/** Build the standard error envelope. */
export function toApiError(code: string, message: string): ApiError {
  return { error: { code, message } };
}

/**
 * Centralized Hono error handler. Known {@link AppError}s are surfaced with their
 * status and message; anything else is logged server-side and returned as a
 * generic 500 so raw stack traces / internal details never reach clients
 * (FR-010, SC-009).
 */
export function onError(err: Error, c: Context): Response {
  if (err instanceof AppError) {
    return c.json(toApiError(err.code, err.message), err.status);
  }
  console.error('Unhandled error:', err);
  return c.json(toApiError('internal_error', 'Something went wrong. Please try again later.'), 500);
}
