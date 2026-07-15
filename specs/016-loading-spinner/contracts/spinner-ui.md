# UI Contract: Loading Spinner

**Feature**: specs/016-loading-spinner | **Date**: 2026-07-15

This contract defines the observable behavior of the spinner across the app.
Any implementation change that breaks a clause here is a regression.

## 1. Anatomy

- One motif everywhere (SC-003): a ring of **10 round dots** on a circle,
  graduated opacity from 1.0 at the "head" dot down to ~0.15 at the "tail",
  visually matching the spinner in `frontend/public/backgrounds/loading.svg`.
  The surrounding artwork in that file MUST never appear in a loading state.
- Dots are `fill="currentColor"` — the spinner inherits the text color of its
  context (body text on pages, button label color inside buttons).
- Rendered as inline SVG by the single `Spinner` component; no image requests.

## 2. Sizes & placement

| Variant | Size | Placement |
|---------|------|-----------|
| `page` | ≈ 48px square | Centered horizontally AND vertically in the visible viewport region below the header (`.page-spinner` flex wrapper filling the page's flex column). No layout shift when it unmounts (FR-007). |
| `button` (default) | `1em` square (scales with button font) | Inline, immediately **before** the busy label text with a small gap (~0.5em). Button height MUST NOT change between idle and busy states (FR-003). |

## 3. Surfaces (closed list, FR-008)

Page-level — spinner replaces the visible text; the text moves to a
visually-hidden span inside the existing live region:

| Surface | Trigger flag | Former text |
|---------|--------------|-------------|
| `ProtectedRoute` | `AuthContext.loading` | "Loading…" |
| `HomePage` | `VaultContext.loading` | "Loading your sections…" |
| `HomePage` (dead branch) | `chordsLoading` (always false) | "Loading entries…" — same treatment or branch removal; must not remain text-only |

Button-level — spinner prepended, existing busy text stays visible:

| Surface | Busy labels |
|---------|-------------|
| `LoginPage` | Signing in… |
| `RegisterPage` | Creating account… |
| `HomePage` UnlockVaultForm | Unlocking… |
| `AddChordDialog` | Saving…, Deleting… |
| `SectionDialog` | Saving…, Deleting… |
| `ResetPasswordPage` | Checking…, Verifying…, Resetting… |
| `UserMenu` | Signing out… |

No other surface gains a spinner; no new loading states are introduced.

## 4. Motion

- Default: continuous rotation via one CSS `@keyframes` full turn
  (`steps(10)` or `linear`; decided in implementation, consistent everywhere).
- `@media (prefers-reduced-motion: reduce)`: animation removed entirely; the
  static graduated ring remains visible (SC-005).

## 5. Accessibility

- The SVG is decorative: `aria-hidden="true"`, `focusable="false"` — never
  announced, never focusable (FR-005).
- Every surface that today exposes a textual loading status keeps it:
  - Page waits keep their `role="status"` / `aria-live="polite"` element with the
    text visually hidden (Bootstrap `.visually-hidden`).
  - Buttons keep visible busy text, `disabled`, and any existing `aria-busy`.
- Contrast: spinner inherits `currentColor` from AA-compliant text colors in both
  themes (FR-006) — no dedicated spinner color tokens.

## 6. Degradation

- **Forced colors**: `currentColor` maps to system ink; spinner stays visible.
  No `forced-color-adjust: none`.
- **Print**: spinner hidden (`display: none` in `@media print`) — mirrors the
  `.page-bg` decorative-asset guard.
- **Responsive**: page spinner fully visible with no horizontal scroll at
  ~320px; button spinner never wraps the label to a second line at 320px
  (SC-002, FR-007).

## 7. Non-goals

- No determinate progress (percentages, bars).
- No minimum display time / anti-flash delay.
- No overlay/scrim blocking interaction.
- No backend, shared-types, or API involvement.
- Identical for admin and normal roles.
