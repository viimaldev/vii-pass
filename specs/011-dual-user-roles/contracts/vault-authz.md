# Contract: Role-Based Vault Authorization (Sections & Chords)

**Feature**: specs/011-dual-user-roles | **Date**: 2026-07-13
**Scope**: `/api/sections/*`, `/api/chords/*` route gating + read-only UI contract

Routes, verbs, and payloads are UNCHANGED from features 006/009/010. The only change
is authorization: every mutating route additionally requires the session role to be
`admin` (FR-005–FR-007).

## Server contract — `requireAdmin` middleware

New middleware `backend/src/middleware/requireAdmin.ts`, mounted AFTER
`requireSession` on mutating routes only. Behavior:

- Session role `admin` → pass through.
- Session role `normal` → throw `403 role_forbidden` with message
  "Your sign-in doesn't allow changes. Sign in with the admin username to make changes."
- The 403 must occur BEFORE any body parsing/validation side effects reach a service
  (no partial writes; SC-003 "vault remains unchanged").

### Route gating matrix

| Route | Method | requireSession | requireAdmin |
|---|---|:---:|:---:|
| `/api/sections` | GET | ✅ | — |
| `/api/sections` | POST | ✅ | ✅ |
| `/api/sections/reorder` | POST | ✅ | ✅ |
| `/api/sections/:sectionId` | PATCH | ✅ | ✅ |
| `/api/sections/:sectionId` | DELETE | ✅ | ✅ |
| `/api/sections/:sectionId/chords` | GET | ✅ | — |
| `/api/sections/:sectionId/chords` | POST | ✅ | ✅ |
| `/api/sections/:sectionId/chords/reorder` | POST | ✅ | ✅ |
| `/api/chords/:chordId` | PATCH | ✅ | ✅ |
| `/api/chords/:chordId` | DELETE | ✅ | ✅ |

Notes:

- GET routes stay role-agnostic: both roles read the same account-scoped data
  (SC-002 — identical vault content).
- The default-"Mine" lazy provisioning inside `GET /api/sections` is a server-internal
  write triggered by a read; it MUST keep working for a normal-role session (first
  sign-in may be with the normal username). It is not a user mutation and is exempt
  from the gate.
- Error precedence: `401` (no/invalid session) → `403 role_forbidden` (role) →
  `400/404/409` (validation/ownership/conflict), so a normal-role probe learns nothing
  about payload validity or resource existence beyond what the admin flow reveals.

## Frontend contract — read-only presentation

Derived flag: `readOnly = user.role !== 'admin'` (from `useAuth()`).

| Surface | Admin session | Normal session (readOnly) |
|---|---|---|
| SectionTabs — `+` add tab | shown | **absent** |
| SectionTabs — `‹ ›` move buttons | shown | **absent** |
| SectionTabs — edit/delete section affordances | shown | **absent** |
| SectionTabs — drag-and-drop reorder | active | **not attached** (`draggable` false, no handlers) |
| ChordGrid — trailing add tile | shown | **absent** |
| ChordGrid — drag-and-drop reorder | active | **not attached** |
| ChordCard — edit button | shown | **absent** |
| ChordCard — `↑ ↓` move buttons | shown | **absent** |
| ChordCard — copy-link, reveal (eye), copy value | shown | **shown (unchanged)** |
| Section selection / tab switching | works | **works** |

Rules:

- Controls are **omitted from the DOM**, not disabled — nothing focusable/announced
  that cannot be used (WCAG; Constitution III). Layout must not leave dangling gaps at
  320px (the grid simply has no add tile; the card header has no edit cluster).
- Reveal/copy behavior, masking, and decrypt-render paths are IDENTICAL for both roles
  (spec Assumption; US2 scenario 5).
- If a mutation is attempted anyway (stale UI, crafted request) the server 403 is
  surfaced through the existing error-alert pattern with the server's actionable
  message — never a raw code.
- The role arrives with `AuthResponse.user` / `me`; no separate capability fetch. A
  role change requires a fresh session by construction (role is fixed on the session),
  so the SPA never needs to re-evaluate mid-session.

## Verification (manual, SC-003)

For EVERY row marked `requireAdmin` in the matrix: sign in with the normal username
and issue the request directly (fetch/curl with the session cookie) → expect
`403 role_forbidden` and NO change in the DB; repeat via the UI → control absent.
Then sign in with the admin username → the same request succeeds as today.
