# Data Model: Loading Spinner Indicator

**Feature**: specs/016-loading-spinner | **Date**: 2026-07-15

This feature is purely visual. **No persistent data, collections, indexes, API
payloads, or shared types are added or changed.** The only "model" is transient
UI state that already exists.

## Existing UI state consumed (unchanged)

| State | Owner | Drives |
|-------|-------|--------|
| `loading: boolean` | `AuthContext` | Session-bootstrap wait in `ProtectedRoute` (page spinner) |
| `loading: boolean` | `VaultContext` | Vault load wait in `HomePage` (page spinner) |
| `chordsLoading: boolean` | `VaultContext` (hardcoded `false` since feature 015) | Dead branch in `HomePage` — updated/removed alongside, never renders |
| `submitting` / `busy` / `unlocking: boolean` | Local component state in each form/dialog/menu | Button busy states (button spinner + existing progress text) |

## New component contract (in-memory only)

### `Spinner` (React component, `frontend/src/components/Spinner.tsx`)

| Prop | Type | Default | Meaning |
|------|------|---------|---------|
| `size` | `'page' \| 'button'` | `'button'` | `page` ≈ 48px centered indicator; `button` ≈ `1em`, inline beside button text |

Invariants:

- Renders a single inline SVG: ring of round dots, graduated opacity, `fill="currentColor"`.
- Always `aria-hidden="true"` + `focusable="false"` — never in the a11y tree (FR-005).
- Stateless, no effects, no handlers — pure presentational output.

### `.page-spinner` (CSS wrapper class, tokens.css)

- Flex container centering its content on both axes within the available
  full-height page region ("center of the window", FR-002).
- Hosts the `role="status"` element whose text becomes visually hidden.

## State transitions

None introduced. Spinners mount/unmount purely on the existing boolean flags
above; when a flag flips false (success or error) the spinner unmounts and
existing error rendering is unchanged (spec Edge Cases).
