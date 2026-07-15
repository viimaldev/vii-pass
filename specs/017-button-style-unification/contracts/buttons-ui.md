# UI Contract: Unified Button Language v2 (feature 017)

**Feature**: 017-button-style-unification | **Date**: 2026-07-15
**Supersedes**: `specs/014-section-color-theming/contracts/buttons-ui.md` (feature 014).
All rules there remain in force EXCEPT where amended below.

This contract governs every button-like control in the frontend. It is enforced by the
"Unified button language" block in `frontend/src/styles/tokens.css` plus per-component
classes; there is no runtime API surface.

## 1. Shape — the section-tab silhouette

| Rule | Value |
|---|---|
| Corner treatment | `border-radius: 0 20px 0 0` — ONLY the upper-right corner rounded, identical declaration to `.section-tab` |
| Applies to | All `.btn` (sign in, create account, all 3 reset-step submits, back-to-sign-in link-button, unlock, dialog footer save/cancel/delete, any future `.btn`); `.chord-add` ("+" entry tile); `.user-menu__item` (sign-out row hover highlight). `.section-tab` / `.section-tab--add` already carry it |
| Explicit NON-goals (shape unchanged) | Circular identity/selection controls: `.user-menu__avatar`, `.user-menu__badge`, `.color-swatch` (circles). Small icon-only controls: `.chord-card__icon-btn`, `.chord-field__btn`, `.chord-form-row__reveal`, `.user-menu__theme-btn`, `.vault-modal__icon-btn` (keep `var(--radius)` / current shapes) |
| Invariants | Works at any button width (full-width `w-100` submits included); no height change; feature-016 button spinner alignment unchanged |

## 2. Fill opacity — no translucent button fills

| Control | Before | After |
|---|---|---|
| Dialog cancel buttons (AddChordDialog, SectionDialog, both delete-confirm variants) | `btn-outline-secondary` (transparent fill) | `btn-secondary`, LIGHTENED with a WHITE label (both user decisions — a deliberate AA relaxation): fill `color-mix(in srgb, #6c757d 55%, #ffffff)`, hover/active step back toward the original gray (70%/80% mixes) |
| `.section-tab--add`, `.chord-add` ("+" create placeholders) | — | `.section-tab--add` UNCHANGED (translucent `rgba(var(--bs-primary-rgb), 0.2)` / hover `0.4`). `.chord-add` keeps the SAME 0.2/0.4 opacities but tints with the SECTION color: `color-mix(in srgb, var(--section-color, var(--color-primary)) 20%, transparent)` / hover `40%` (reads `--section-color` from `.chord-grid`; glyph color follows too) — post-implementation user decision |
| `.user-menu__theme-btn[aria-checked='true']` | `rgba(var(--bs-primary-rgb), 0.18)` | `color-mix(in srgb, var(--color-primary) 18%, var(--color-bg))` |
| Exemption | The low-opacity IDLE state and translucent hover WASHES of card icon controls (eye/copy/edit) are an established affordance, not a button fill — unchanged except §4 below |

## 3. Section-colored primary — `.btn-section` (amends 014's rule)

Feature 014 ruled "buttons MUST NOT reference `--section-color`". That rule now has
**exactly one sanctioned exception**; everything else still MUST NOT use section color.

| Aspect | Contract |
|---|---|
| Scope | ONLY the entry (chord) create/edit dialog's primary submit button. Section dialog, auth pages, and every other button keep brand `btn-primary` / gray `btn-secondary` |
| Class | `.btn-section` (alongside `btn`), replacing `btn-primary` on that one button |
| Color source | Add mode → the currently selected section's `color`; edit mode → the color of the section owning the chord (`chord.sectionId`). Passed by `VaultContext` as a `sectionColor` prop; set inline as `--section-color` on the **dialog panel** (`VaultModal`'s `style` prop), so the Save button AND the dialog's form-control/form-select focus styles (border + 25% ring via `.vault-modal .form-control:focus`) all follow the section color; dialogs without the var fall back to brand primary |
| Fill | Opaque `var(--section-color, var(--color-primary))`; hover/active darken via `color-mix(in srgb, var(--section-color) 85%, #000)` (hover) / `70%` (active) — the section-tab ramp idiom |
| Label contrast (FR-006) | Label is ALWAYS `#ffffff` (post-implementation user decision — replaces the earlier luminance-based `readableTextColor()` flip; `colorContrast.ts` was removed) |
| Fallback | No `sectionColor` available → CSS variable fallback renders brand primary; never an unstyled button |
| Secondary (FR-003) | Cancel stays gray (`btn-secondary`), never section-colored |

## 4. Dark-theme eye/copy hover parity (FR-007/008/009)

| Aspect | Contract |
|---|---|
| Dark theme | `[data-bs-theme='dark'] .chord-field__btn:hover/:focus-visible` → `background: color-mix(in srgb, var(--color-text) 16%, transparent)` — pixel-identical to the edit icon's wash (`.chord-card__icon-btn`), since both resolve to the pinned `#1b1f24` inside `.chord-card` |
| Light theme | The existing rule (`background: var(--color-surface)`) stays byte-for-byte unchanged |
| Focus | `:focus-visible` shares the hover styling in both themes AND keeps the global 3px outline → focus visibility ≥ hover by construction |

## 5. Spacing

| Rule | Value |
|---|---|
| Side-by-side button gap | `.vault-modal__footer` gap `var(--space-2)` → `var(--space-3)` (one spacing step). Applies to both dialogs + their delete-confirm variants via the shared rule |
| Dialog button footprint | `.vault-modal__footer .btn` gets `min-width: 100px` (same minimum as `.section-tab`) and trimmed vertical padding (3.5px) so the buttons stand ~5px shorter than Bootstrap's default (38px → 33px) |
| Invariant | No overflow/wrap regression at 320px (modal max-width 420px, two compact buttons) |

## 6. Unchanged rules carried forward from 014

- Regular weight everywhere: `button, .btn { font-weight: 400; }` — no bold button labels.
- Variants distinguished by design/size, never boldness.
- Forced-colors / print: decorative fills may be stripped by the platform; buttons must
  remain usable (no `forced-color-adjust: none`).
- Purely visual: no behavior, permission, or flow changes (FR-011); read-only (normal
  role) users see the same styling on the buttons they do see.
