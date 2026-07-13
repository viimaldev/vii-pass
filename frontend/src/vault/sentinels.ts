/**
 * Plaintext-side sentinel values used above the vault crypto boundary
 * (specs/010-credential-encryption). VaultContext maps decryption problems to
 * these constants so components can render distinct states without ever seeing
 * envelopes. They use a leading NUL so no real user value can collide.
 */

/** Per-field sentinel: the stored value could not be decrypted (FR-007). */
export const VALUE_UNREADABLE = '\u0000vii-pass:unreadable';

/** Per-field sentinel: the vault is locked, so the value is not available yet. */
export const VALUE_LOCKED = '\u0000vii-pass:locked';
