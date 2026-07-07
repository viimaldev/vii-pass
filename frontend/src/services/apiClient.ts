import type { ApiError } from '@vii-pass/shared';

/**
 * Minimal typed API client for the vii-pass SPA. Built on `fetch` and the
 * build-time `VITE_API_BASE_URL` (research.md Decision 10). All requests send the
 * session cookie (`credentials: 'include'`), and all non-2xx responses are
 * surfaced as a typed {@link ApiClientError} carrying an actionable message.
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

/**
 * Optional handler invoked whenever the API returns `401`. The auth layer
 * registers this to centrally reset auth state and route to the login page
 * (FR-006), so individual callers need not handle session loss themselves.
 */
type UnauthorizedHandler = (error: ApiClientError) => void;
let unauthorizedHandler: UnauthorizedHandler | undefined;

/** Register (or clear) the global `401` handler. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | undefined): void {
  unauthorizedHandler = handler;
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    if (res.status === 204) {
      return undefined as T;
    }
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
  const error = new ApiClientError(res.status, code, message);
  if (res.status === 401) {
    unauthorizedHandler?.(error);
  }
  throw error;
}

/** Perform a GET request and parse the JSON response. */
export async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  return parseResponse<T>(res);
}

/** Perform a POST request with an optional JSON body. */
export async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
  });
  return parseResponse<T>(res);
}
