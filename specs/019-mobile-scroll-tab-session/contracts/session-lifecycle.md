# Contract: Tab-Scoped Session Lifecycle

**Feature**: specs/019-mobile-scroll-tab-session | **Date**: 2026-07-20
**Consumers**: `frontend/src/auth/AuthContext.tsx`, `frontend/src/auth/tabLease.ts` (new),
`backend/src/services/sessions.service.ts`

No routes, verbs, or payloads change. This contract specifies (A) the one changed
cookie attribute and (B) the client-side tab-lease protocol every future change must
preserve.

---

## A. Session cookie contract (backend)

`setSessionCookie` MUST set the `session` cookie with:

| Attribute | Value |
|---|---|
| HttpOnly | true (unchanged) |
| Secure | true (unchanged) |
| SameSite | Lax (unchanged) |
| Path | `/` (unchanged) |
| Domain | `COOKIE_DOMAIN` when configured (unchanged) |
| **Max-Age / Expires** | **ABSENT** — the cookie MUST be a browser-session cookie |

Server-side validity is untouched: `validateSession` still enforces the sliding idle
window and the absolute `expiresAt`; the TTL index still purges expired rows. The cookie
merely stops outliving the browser process.

`clearSessionCookie` unchanged.

## B. Tab-lease protocol (frontend)

### Constants

| Name | Value |
|---|---|
| Lease key (`sessionStorage`) | `vii-pass:tab-lease` |
| Lease value | `'1'` (MUST never encode secrets/identifiers) |
| Channel name (`BroadcastChannel`) | `vii-pass:tabs` |
| Handshake request | `{ "type": "who-is-alive" }` |
| Handshake response | `{ "type": "alive" }` |
| Handshake deadline | 200ms (may be tuned 100–500ms; MUST be bounded) |

### Module surface (`frontend/src/auth/tabLease.ts`)

```ts
/** True when THIS tab already legitimately held the session (refresh/in-tab nav). */
export function hasLease(): boolean;
/** Mark this tab as a legitimate session holder (login, register, adoption, resume). */
export function grantLease(): void;
/** Remove the lease (sign-out, 401 session loss). */
export function releaseLease(): void;
/**
 * Ask other tabs whether any signed-in tab is alive. Resolves true on the first
 * 'alive' answer, false when the deadline elapses or BroadcastChannel is unavailable.
 */
export function probeForLiveTab(): Promise<boolean>;
/** Start answering 'who-is-alive' probes; only answers while predicate() is true. */
export function startLeaseResponder(predicate: () => boolean): () => void;
```

### Bootstrap decision table (AuthContext, BEFORE `GET /api/auth/me`)

| `hasLease()` | `probeForLiveTab()` | Interpretation | Required action |
|---|---|---|---|
| true | (not called) | refresh / in-tab navigation | proceed with `/me` bootstrap as today (FR-007) |
| false | true | new tab beside a live signed-in tab | `grantLease()`, then `/me` bootstrap (FR-008, FR-009) |
| false | false | first visit OR return after last-tab close / browser close / crash | `POST /api/auth/logout` (fire-and-forget, errors ignored), `clearVaultKey()`, start signed out (FR-004, FR-005, FR-006) |

Notes:
- The revoke-on-silence call MUST be idempotent-safe: on a genuine first visit there is
  no cookie and logout is a harmless no-op.
- The signed-in UI MUST NOT flash before the decision resolves (the existing `loading`
  bootstrap state covers the ≤200ms handshake).
- `startLeaseResponder` predicate = "user !== null AND this tab holds the lease"; a tab
  MUST stop answering after sign-out/401 (otherwise it would vouch for a dead session).

### Lease maintenance rules

| Event | Action |
|---|---|
| Successful login / register | `grantLease()` |
| Successful adoption (probe answered) | `grantLease()` |
| Boot with lease present | keep lease |
| Explicit sign-out | `releaseLease()` (before/with existing logout flow) |
| 401 session loss (unauthorized handler) | `releaseLease()` (alongside existing clearVaultKey) |
| Sign-out observed from another tab | that tab's own `/me`/next request 401s → same 401 path (FR-010; no new sync channel required) |

### Degradation

- `BroadcastChannel` unavailable → `probeForLiveTab()` resolves false → every new tab
  requires sign-in. FAILS SAFE (never grants access it shouldn't).
- `sessionStorage` blocked → `hasLease()` false every boot → each refresh behaves like a
  new visit (sign-in required). Fails safe; acceptable degradation, mirror of feature
  013's storage-blocked stance.

### Explicit non-goals

- No `beforeunload`/`pagehide` logout beacons (unreliable; would break refresh — see
  research Decision 3).
- No change to session schema, TTLs, roles, vault crypto, or any API payload.
- No cross-BROWSER or cross-device semantics change.
