# Research: Button Style Unification & Section-Color Primary Actions

**Feature**: 017-button-style-unification | **Date**: 2026-07-15

No `NEEDS CLARIFICATION` markers existed in the Technical Context. This document records
the design decisions and the alternatives evaluated.

## Decision 1 — Button shape: reuse the section-tab corner treatment verbatim

**Decision**: Apply `border-radius: 0 20px 0 0` — the exact declaration `.section-tab`
already uses (tokens.css) — to all rectangular action buttons via the existing unified
button block: `.btn` (covers sign in, create account, reset steps, unlock, dialog
footers, sign-out-adjacent Bootstrap buttons), `.chord-add` (the "+" tile), and
`.user-menu__item` (the sign-out menu row's hover highlight). `.section-tab--add`
already inherits the radius from `.section-tab`.

**Rationale**: The user asked to "copy the same style" — same corner, same curvature.
One low-specificity rule in the tokens.css button-language block keeps a single source
of truth; component rules can still override (none need to). 20px on a ~38px button
reads as a strong quarter-round on exactly one corner, visually rhyming with the tabs.

**Alternatives considered**:
- *Scaled radius per control size* (e.g. 12px on small buttons): rejected — "copy the
  same style" is explicit, and mixed curvatures would recreate the inconsistency this
  feature exists to remove.
- *Applying the shape to icon-only controls, avatar, and color swatches*: rejected —
  the avatar/badge/swatches are deliberately circular identity/selection affordances,
  and the 32px transparent icon controls (eye/copy/edit/theme) would clip their focus
  wash oddly; the spec's Assumptions already carve these out. Documented as explicit
  non-goals in the contract.

## Decision 2 — Section-colored primary: inline CSS variables + JS-computed label color

**Decision**: A new `.btn-section` class styles the entry dialog's primary button:
opaque `background: var(--section-color)`, hover/active darkened with
`color-mix(in srgb, var(--section-color) 85%, #000)` (matching the tab-ramp idiom), and
`color: var(--section-color-fg)`. The dialog sets both variables inline on the button.
`--section-color-fg` comes from a new pure helper `readableTextColor(hex)`
(`frontend/src/components/colorContrast.ts`): compute WCAG relative luminance of the
section color, return `#ffffff` or `#1b1f24`, whichever yields the higher contrast
ratio. `VaultContext` passes a new optional `sectionColor` prop to `AddChordDialog`
(add mode → selected section's color; edit mode → the color of the section owning the
chord, via `chord.sectionId`). Missing color (defensive) → the button falls back to
`btn-primary` behavior via the CSS variable fallback `var(--section-color,
var(--color-primary))`.

**Rationale**: FR-002 requires the *actual* section color (not a contrast band like the
chord-card header), and FR-006 requires an accessible label for ANY hex the user picks
(the section dialog offers a free color picker). Pure CSS cannot yet choose a readable
foreground (`contrast-color()` is not baseline); a 10-line luminance helper is the
smallest correct tool. The white-vs-`#1b1f24` pair guarantees ≥4.5:1 for every possible
background (whichever of black/white contrasts worse is ≥ ~4.6:1 in the worst case at
mid-luminance; picking the better of the two always clears 4.5:1). The inline-variable
pattern is the established repo idiom (SectionTabs, ChordGrid).

**Alternatives considered**:
- *White label on full-strength color (like selected tabs)*: rejected — fails AA on
  light section colors (white on yellow ≈ 1.07:1).
- *Contrast-band fill (mix toward white, dark text — chord-header approach)*: rejected —
  the button would show a pastel tint, not "the section color" the user asked for.
- *Plumb color through VaultModal footer context*: rejected — the footer is an opaque
  ReactNode prop; the dialog already composes its own footer buttons, so a prop on
  AddChordDialog is the shortest path.
- *CSS `contrast-color()`*: rejected — insufficient browser support in 2026 baseline.

## Decision 3 — "No transparency": solid gray secondary + opaque tint conversions

**Decision**: (a) Cancel buttons in AddChordDialog and SectionDialog switch from
`btn-outline-secondary` (transparent fill) to `btn-secondary` (Bootstrap's solid gray —
"gray as it is", now opaque). (b) The translucent button tints elsewhere convert to
opaque equivalents that LOOK identical on the default background:
`.section-tab--add` / `.chord-add` `rgba(var(--bs-primary-rgb), 0.2)` →
`color-mix(in srgb, var(--color-primary) 20%, var(--color-bg))` (hover 40%), and
`.user-menu__theme-btn[aria-checked='true']` `rgba(..., 0.18)` → the same `color-mix`
pattern at 18%. Because they mix with the theme token `--color-bg`, the computed color
still tracks both themes.

**Rationale**: FR-004 bans see-through fills on standard action buttons. `color-mix`
with the background token produces the identical perceived color with alpha 1, so the
visual language is preserved while satisfying the requirement — and hover states no
longer shift when content scrolls beneath a button.

**Alternatives considered**:
- *Keep outline-secondary and force an opaque `--bs-btn-bg`*: rejected — Bootstrap's
  `btn-secondary` already IS the solid-gray variant; overriding outline internals adds
  a bespoke style for no benefit.
- *Hardcoded hex equivalents*: rejected — would silently break in dark theme; mixing
  with `--color-bg` stays theme-correct automatically.

## Decision 4 — Gap increase: one spacing step in the dialog footer

**Decision**: `.vault-modal__footer` `gap: var(--space-2)` (0.5rem) → `var(--space-3)`
(0.75rem). This is the only surface in the app where two or more standard buttons sit
side by side (auth/reset submits are solitary `w-100` buttons; card/menu icon controls
are out of scope).

**Rationale**: "Increase a little" = one step on the existing spacing scale, applied at
the shared footer rule so both dialogs (and their delete-confirmation variants) pick it
up at once. No wrapping risk at 320px: the dialog is `max-width: 420px` with two
compact buttons.

**Alternatives considered**: a new spacing token or per-dialog utility classes —
rejected as over-engineering for a single shared rule.

## Decision 5 — Dark-theme eye/copy hover parity with the edit icon

**Decision**: Add
`[data-bs-theme='dark'] .chord-field__btn:hover, [data-bs-theme='dark'] .chord-field__btn:focus-visible { background: color-mix(in srgb, var(--color-text) 16%, transparent); }`.
Inside `.chord-card`, `--color-text` is pinned to `#1b1f24` and `--chord-header-fg`
resolves to the same pinned value, so this is *pixel-identical* to the edit icon's
existing hover wash (`.chord-card__icon-btn`). The light-theme rule
(`background: var(--color-surface)`) is left byte-for-byte untouched (FR-008), and
`opacity: 1` on hover/focus continues to apply in both themes (FR-009: focus shares the
hover styling, so focus visibility ≥ hover by construction, plus the global
`:focus-visible` outline).

**Rationale**: The user's reference — "light edit icons hover color in dark theme" — is
the edit control's translucent dark wash, which reads correctly on the theme-invariant
light card. Scoping with `[data-bs-theme='dark']` leaves light theme provably
unchanged. The wash's transparency is fine: the spec's Assumptions exempt card icon
controls from the opacity rule (it's a hover wash on a control, not a button fill).

**Alternatives considered**: sharing one rule for both themes (setting the wash
unconditionally) — rejected because FR-008 demands the light theme stay *exactly* as
is, and the current light hover is `--color-surface`, not a wash.

## Decision 6 — Supersede feature 014's button contract explicitly

**Decision**: `specs/014-section-color-theming/contracts/buttons-ui.md` receives a
short annotation: its "buttons MUST NOT reference `--section-color`" rule now has
exactly one sanctioned exception — `.btn-section` on the entry dialog primary — and
`specs/017-button-style-unification/contracts/buttons-ui.md` is the successor contract.
The tokens.css comment on the unified button block is updated to point at the 017
contract.

**Rationale**: Constitution Principle V — the rule change must be explicit and
documented, not silent drift discovered in a future audit.

**Alternatives considered**: leaving 014's contract untouched — rejected; a future
reader would find two contradictory contracts with no arbitration.
