# Data Model: User Menu Redesign

**Feature**: 012-user-menu-redesign | **Date**: 2026-07-14

## Summary

**No data-model changes.** This feature is a pure presentation restyle of the account
menu panel. No MongoDB collections, shared types, API payloads, or client-side stores
are added or modified.

## Entities consumed (existing, unchanged)

### PublicUser (from `@vii-pass/shared`, provided by `AuthContext`)

| Field | Type | Use in this feature |
|-------|------|---------------------|
| `id` | `string` | Not displayed |
| `username` | `string` | Small secondary line in the identity header; initial-badge fallback when `displayName` is empty/whitespace |
| `displayName` | `string` | Large bold primary line; source of the badge initial (first character, uppercased) |
| `role` | `'admin' \| 'normal'` | Not used — menu content is identical for both roles (spec assumption) |

## Derived (component-local, ephemeral) state

| State | Type | Notes |
|-------|------|-------|
| `open` | `boolean` | Existing — panel visibility |
| `busy` | `boolean` | Existing — logout in progress ("Signing out…") |
| `initial` | `string` | Existing derivation: `(displayName || username || '?').trim().charAt(0).toUpperCase()` — unchanged |

No new state is introduced; the "Change theme" row is stateless by design (FR-006).
