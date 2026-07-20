/**
 * Per-tab session lease + cross-tab presence handshake
 * (specs/019-mobile-scroll-tab-session, contracts/session-lifecycle.md §B).
 *
 * The session itself lives in an HttpOnly cookie the SPA can never read; this
 * module only decides whether the booting tab may USE that cookie or must
 * treat it as stale:
 *
 * - A `sessionStorage` flag (the LEASE) marks "this tab already legitimately
 *   held the session". `sessionStorage` is per-tab and survives refresh and
 *   in-tab navigation but dies with the tab — exactly the lifetime needed for
 *   FR-007 (refresh resumes) vs FR-004 (tab close ends the session).
 * - A `BroadcastChannel` handshake lets a brand-new tab (no lease) ask whether
 *   any signed-in tab is alive. An answer means the session is legitimately
 *   active elsewhere and this tab may adopt it (FR-008); silence means the
 *   last tab was closed and the caller must revoke the stale session.
 *
 * The lease value and the broadcast messages NEVER carry tokens, user ids, or
 * any secret — they are pure presence markers. Every storage/channel access is
 * guarded: when `sessionStorage` or `BroadcastChannel` is unavailable the
 * module degrades to "no lease / no peer", which fails SAFE (new tabs simply
 * require sign-in; access is never granted that shouldn't be).
 */

/** `sessionStorage` key marking this tab as a legitimate session holder. */
const LEASE_KEY = 'vii-pass:tab-lease';

/** Lease value — a pure boolean marker, never a secret. */
const LEASE_VALUE = '1';

/** `BroadcastChannel` name for the cross-tab presence handshake. */
const CHANNEL_NAME = 'vii-pass:tabs';

/** How long a probing tab waits for an `alive` answer before concluding silence. */
const PROBE_DEADLINE_MS = 200;

/** Handshake request broadcast by a booting tab with no lease. */
const MSG_WHO_IS_ALIVE = 'who-is-alive';

/** Handshake response sent by a signed-in, lease-holding tab. */
const MSG_ALIVE = 'alive';

/**
 * True when THIS tab already legitimately held the session (i.e. this boot is
 * a refresh or an in-tab navigation, not a brand-new tab). Blocked or missing
 * `sessionStorage` reads as "no lease" — fails safe.
 */
export function hasLease(): boolean {
  try {
    return window.sessionStorage.getItem(LEASE_KEY) === LEASE_VALUE;
  } catch {
    return false;
  }
}

/**
 * Mark this tab as a legitimate session holder. Called after a successful
 * login/register and after adopting a session from a live sibling tab.
 * Silently a no-op when storage is blocked (the tab then behaves like a new
 * visit on its next refresh — safe degradation).
 */
export function grantLease(): void {
  try {
    window.sessionStorage.setItem(LEASE_KEY, LEASE_VALUE);
  } catch {
    // Storage blocked: degrade to per-visit behavior (fails safe).
  }
}

/** Remove the lease (explicit sign-out or 401 session loss). Idempotent. */
export function releaseLease(): void {
  try {
    window.sessionStorage.removeItem(LEASE_KEY);
  } catch {
    // Nothing to release when storage is unavailable.
  }
}

/**
 * Ask other tabs whether any signed-in tab is currently alive. Resolves `true`
 * on the first `alive` answer, `false` when the deadline elapses or when
 * `BroadcastChannel` is unavailable (fails safe — the caller then treats the
 * session as stale and the user signs in again).
 */
export function probeForLiveTab(): Promise<boolean> {
  if (typeof BroadcastChannel === 'undefined') {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    const finish = (alive: boolean): void => {
      channel.close();
      resolve(alive);
    };
    const timer = window.setTimeout(() => finish(false), PROBE_DEADLINE_MS);
    channel.onmessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === MSG_ALIVE) {
        window.clearTimeout(timer);
        finish(true);
      }
    };
    channel.postMessage({ type: MSG_WHO_IS_ALIVE });
  });
}

/**
 * Start answering `who-is-alive` probes from booting tabs. The responder
 * answers ONLY while `predicate()` is true — the caller supplies "a signed-in
 * user is present AND this tab holds the lease", so a signed-out or 401'd tab
 * never vouches for a dead session. Returns a cleanup function that stops the
 * responder (call on sign-out/unmount). No-op (returns a no-op cleanup) when
 * `BroadcastChannel` is unavailable.
 */
export function startLeaseResponder(predicate: () => boolean): () => void {
  if (typeof BroadcastChannel === 'undefined') {
    return () => undefined;
  }
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent) => {
    if ((event.data as { type?: string } | null)?.type === MSG_WHO_IS_ALIVE && predicate()) {
      channel.postMessage({ type: MSG_ALIVE });
    }
  };
  return () => channel.close();
}
