import { toBase64Url, toHex } from './encoding';

/**
 * Opaque session-token utilities (research.md Decision 2). A high-entropy random
 * token is generated for the client cookie; only its SHA-256 hash is persisted,
 * so a database leak cannot reveal usable session tokens.
 */

const TOKEN_BYTES = 32;

/** Generate a new, unguessable session token (URL-safe base64, 256 bits). */
export function generateSessionToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

/** Compute the SHA-256 (hex) hash of a session token for storage and lookup. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}
