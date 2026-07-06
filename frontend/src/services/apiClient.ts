import type { ApiError } from '@vii-pass/shared';

/**
 * Minimal typed API client for the vii-pass SPA. Built on `fetch` and the
 * build-time `VITE_API_BASE_URL` (research.md Decision 5). All non-2xx responses
 * are surfaced as a typed {@link ApiClientError} carrying an actionable message.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/** Error thrown when the API returns a non-2xx response. */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    return (await res.json()) as T;
  }
  let code = 'request_failed';
  let message = 'The request failed. Please try again.';
  try {
    const body = (await res.json()) as ApiError;
    if (body?.error) {
      code = body.error.code || code;
      message = body.error.message || message;
    }
  } catch {
    // Response body was not JSON; keep the friendly defaults.
  }
  throw new ApiClientError(res.status, code, message);
}

/** Perform a GET request and parse the JSON response. */
export async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
  });
  return parseResponse<T>(res);
}

/** Perform a POST request with a JSON body. */
export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

/** Perform a POST request with a `multipart/form-data` body (file uploads). */
export async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    body: form,
  });
  return parseResponse<T>(res);
}
