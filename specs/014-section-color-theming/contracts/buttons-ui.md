# UI Contract: Unified Button Design Language

**Feature**: specs/014-section-color-theming | **Date**: 2026-07-14

> **⚠️ SUPERSEDED (feature 017)**: this contract's successor is
> [specs/017-button-style-unification/contracts/buttons-ui.md](../../017-button-style-unification/contracts/buttons-ui.md),
> which now governs the app-wide button language. Notable changes there:
> rule 3 below ("buttons never adopt the section color") now has **exactly one
> sanctioned exception** — the `.btn-section` class on the entry dialog's
> primary Save action; the Secondary variant is now SOLID gray
> (`.btn-secondary`, no translucent/outline fills); and every rectangular
> action button carries the section-tab silhouette (`border-radius: 0 20px 0 0`).
> The no-bold rule (rule 1) is carried forward unchanged.

This contract defines the app-wide button design language (FR-007–FR-009). It applies to
**every page and dialog**: login, register, reset password, vault (tabs, cards, grid),
all modals, and the user menu — for both light and dark themes and both roles.

## Core rules

1. **No bold labels** (FR-007): every button label renders at `font-weight: 400`.
   - Applies to Bootstrap `.btn` (all variants, including `<a class="btn">` links) and
     every custom button class in the app.
   - A low-specificity backstop rule (`button { font-weight: 400 }` in tokens.css) plus
     explicit class rules guarantee no higher-specificity bold sneaks back in.
   - **Removals required by this contract**: `.section-tab.is-selected` bold (selection
     is already conveyed by the full-strength color ramp + `aria-current`) and the
     `.user-menu__avatar` bold initial.
2. **Variants are distinguished by design and size, never by weight** (FR-009):

   | Variant | Design identity | Size identity | Usage |
   |---------|-----------------|---------------|-------|
   | Primary | Filled, brand background (`--color-primary`), white label | Bootstrap default padding; `w-100` on auth forms | The single main action of a form/dialog |
   | Secondary | Outline (`.btn-outline-secondary`): border, transparent fill | Bootstrap default padding | Cancel/dismiss |
   | Danger | Filled, `--color-danger` background | Bootstrap default padding | Destructive confirm (e.g. delete section) |
   | Icon-only | Transparent fill, glyph-only, opacity ramp on hover/focus | Fixed square hit target ≥ 32×32px (header) / ≥ 26×24px (in-row), ≥ 44px on coarse pointers | Card copy/eye/edit, form reveal, info popovers |
   | Tab/tile | Gradient (tabs) or faint-primary tint (add tile/tab) | Tab strip 35px min-height; add tile matches the 125px card footprint | Section navigation, add affordances |

3. **Buttons never adopt the section color** (FR-008): functional colors only. Icon
   buttons inside a themed card header inherit the theme-aware header *foreground*
   (`--chord-header-fg`) for legibility, but no button background/border may reference
   `--section-color`. This rule binds future features too.
4. **Consistent primitives**: all buttons use `--radius` corner rounding, token-driven
   colors, and the global `:focus-visible` outline (3px `--color-focus`); focus
   indicators MUST stay visible over gradient backgrounds in both themes (FR-012).
5. **States**: hover/active/disabled/busy states restyle color/opacity only — never
   weight or size (no layout shift). Disabled/busy buttons keep the unified design.

## Verification (SC-003)

A full-app sweep MUST confirm:

- Zero computed `font-weight` > 400 on any `button`, `[role="button"]`, or `.btn`
  element across: LoginPage, RegisterPage, ResetPasswordPage, HomePage (tabs, cards,
  add tile), SectionDialog, AddChordDialog, VaultModal chrome, UserMenu (trigger, theme
  selector, logout), FieldInfo.
- Zero buttons whose background/border resolves from `--section-color`.
- Every variant remains visually distinguishable in both themes.

## Out of scope

- Non-button bold text (headings, the panel identity name, brand mark, form labels) is
  unaffected by this contract.
- No markup/class-name changes are required at call sites; this is a tokens.css-level
  contract.
