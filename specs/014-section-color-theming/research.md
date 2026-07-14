# Research: Section Color Theming for Chords & Unified Buttons

**Feature**: specs/014-section-color-theming | **Date**: 2026-07-14

No `NEEDS CLARIFICATION` markers existed in the Technical Context; the research below
records the decisions that shape the design.

---

## Decision 1 — Color plumbing: inherit `--section-color` from the grid container

**Decision**: `HomePage` derives the selected section's color from the vault context it
already consumes (`sections.find(s => s.id === selectedId)?.color`) and passes it to
`ChordGrid` as a new optional `sectionColor` prop. `ChordGrid` sets it once, inline, on
the `.chord-grid` container: `style={{ '--section-color': sectionColor }}`. CSS custom
property inheritance carries the value into every `.chord-card` descendant.

**Rationale**:
- `--section-color` is already the established per-section theming API — `SectionTabs.tsx`
  sets the same variable inline on each tab (feature 008). Reusing it keeps ONE section
  color mechanism, not two.
- Setting it on the container (not per card) is a single React expression; cards need no
  prop drilling and `ChordCard.tsx` needs **zero changes**.
- Because the grid only ever renders the chords of the currently selected section, the
  container-level variable is atomic with the card list — switching sections swaps both
  in the same render, which is exactly what FR-006 (no stale coloring) requires.
- Theme switches need no JS at all: the `[data-bs-theme]` attribute flip (feature 013)
  re-resolves the CSS ramps instantly (FR-005).

**Alternatives considered**:
- *Per-card prop + inline style on each `.chord-card`*: more code, same result; rejected
  (inheritance is free).
- *Setting the variable in `VaultContext` on a page-level element*: spreads styling
  concerns into state-management code; rejected.
- *Computing gradient colors in JS (e.g. hex math) and passing resolved colors*:
  duplicates what `color-mix()` does natively, adds testable-but-unnecessary code, and
  breaks the "CSS re-resolves on theme flip" property; rejected.

## Decision 2 — Gradients via `color-mix(in srgb, …)` with theme-scoped ramp variables

**Decision**: Define the card ramps as intermediate custom properties on `.chord-card`
(same pattern as `.section-tab`'s `--tab-top`/`--tab-bottom`):

```css
.chord-card {
  /* Light theme (default): header blends toward WHITE, body is a light tint. */
  --chord-header-top:    color-mix(in srgb, var(--section-color) 25%, #ffffff);
  --chord-header-bottom: color-mix(in srgb, var(--section-color) 45%, #ffffff);
  --chord-body-top:      color-mix(in srgb, var(--section-color) 10%, #ffffff);
  --chord-body-bottom:   color-mix(in srgb, var(--section-color) 18%, #ffffff);
  --chord-header-fg:     var(--color-text);
}

[data-bs-theme='dark'] .chord-card {
  /* Dark theme: header blends toward BLACK, body is a dark shade. */
  --chord-header-top:    color-mix(in srgb, var(--section-color) 45%, #000000);
  --chord-header-bottom: color-mix(in srgb, var(--section-color) 30%, #000000);
  --chord-body-top:      color-mix(in srgb, var(--section-color) 22%, #101214);
  --chord-body-bottom:   color-mix(in srgb, var(--section-color) 14%, #101214);
  --chord-header-fg:     #ffffff;
}
```

`.chord-card__header` / `.chord-card__body` then just paint
`linear-gradient(to bottom, var(--chord-…-top), var(--chord-…-bottom))`.

**Rationale**:
- `color-mix()` is already a shipped dependency of this app — the section tabs have used
  it since feature 008 — so browser support (Chrome/Edge 111+, Firefox 113+, Safari
  16.2+) is a settled question, not a new risk.
- Ramp variables + theme-scoped overrides mirror the tab implementation exactly →
  design-system coherence (Constitution III).
- The percentages are **contrast bands, not aesthetics** (see Decision 3): they are
  chosen so the header always lands in a luminance range where the chosen foreground
  passes AA *regardless* of the section color. They are declared implementation-time
  tunables in the spec (Assumptions) and get a dedicated audit task.
- Feature 013's flat dark pin `[data-bs-theme='dark'] .chord-card__header { background:
  #1f2327 }` is **superseded and must be removed** when this lands (dead rule otherwise).

**Alternatives considered**:
- *`oklch`/relative color syntax*: better perceptual mixing, but narrower browser
  support than `color-mix(in srgb)` and inconsistent with the tabs; rejected.
- *Opacity overlays (section color layer + black/white layer)*: works but produces
  compound backgrounds that are harder to audit for contrast and interact badly with the
  card's `overflow: hidden` + shadow; rejected.

## Decision 3 — Contrast strategy: bounded blend bands + audited foreground

**Decision**: Guarantee FR-004 (readable for ANY section color) structurally:

- **Light header** (25–45% color toward white): worst case is pure black `#000000` as the
  section color → bottom stop = 45% black = `#8c8c8c`, contrast vs `--color-text`
  (`#1b1f24`) ≈ **4.96:1** — AA passes at the darkest possible stop, so every other color
  passes by construction. Header foreground = `--chord-header-fg: var(--color-text)`.
- **Dark header** (30–45% color toward black): worst case is pure white → top stop = 45%
  white = `#737373`, contrast vs `#ffffff` ≈ **4.75:1** — AA passes at the lightest
  possible stop. Header foreground = `#ffffff`.
- **Light body** (≤18% color toward white): worst case 18% black = `#d1d1d1`, contrast vs
  body text `#1b1f24` ≈ **12:1**. Body keeps the normal text tokens.
- **Dark body** (≤22% color toward `#101214`): worst case 22% white ≈ `#3f4143`, contrast
  vs dark-theme body text ≈ **8:1+**. Body keeps the dark-theme text tokens.

An explicit audit task recomputes all pairs (including muted text, field icons, masked
dots, the danger-colored per-field error, and focus outlines) at the extreme section
colors (`#000000`, `#ffffff`, saturated neons) in both themes and nudges percentages if
any pair dips under 4.5:1 — the same computational method used for feature 013's T014.

**Consequence for existing CSS**: the header currently hardcodes white foreground
(`color: #ffffff`, white focus outline on the title link, `rgba(255,255,255,.16)` hover
wash on header icon buttons). These become `var(--chord-header-fg)`-driven (hover wash
via `color-mix(in srgb, var(--chord-header-fg) 16%, transparent)`) so the light theme's
dark-on-light header stays accessible.

**Alternatives considered**:
- *Computing a per-color foreground (white vs black) from luminance in JS*: adds runtime
  logic and a flash-of-wrong-color risk; the bounded-band approach makes it unnecessary;
  rejected.
- *Restricting the section color picker to "safe" colors*: changes feature 006 scope and
  user freedom; rejected.

## Decision 4 — Unified button design language: one tokens.css block, no markup churn

**Decision**: Codify the button rules centrally in `tokens.css`:

1. **No bold anywhere**: `.btn`, and every custom button class (`.section-tab`,
   `.section-tab--add`, `.chord-add`, `.chord-card__icon-btn`, `.chord-field__btn`,
   `.chord-form-row__reveal`, `.user-menu__avatar`, `.user-menu__item`,
   `.field-info__button`, theme selector buttons) get `font-weight: 400`. Concretely
   this removes exactly two existing bold declarations:
   - `.section-tab.is-selected { font-weight: 700 }` → selected state is already
     distinguished by its full-strength color ramp; bold is redundant and violates FR-007.
   - `.user-menu__avatar { font-weight: 700 }` → the initial glyph drops to 400 (the
     non-button panel badge `.user-menu__badge` may keep its weight — it is not a button,
     but for visual consistency with the trigger it is normalized too).
2. **Variant identity by design + size** (FR-009), documented in
   `contracts/buttons-ui.md`: filled primary (brand bg), outline secondary (border, no
   fill), filled danger, and icon-only (transparent, fixed square hit target ≥32px,
   ≥44px on coarse pointers — already present). Bootstrap's `.btn` base already uses
   `font-weight: 400`, consistent padding and `--radius`, so page-level buttons need **no
   markup changes** — the unified language is an explicit contract plus a guard rule,
   not a rewrite.
3. **Buttons never adopt `--section-color`** (FR-008): icon buttons inside the card
   header/body inherit the theme-aware *foreground* for legibility, but their accent
   colors (primary/danger) stay functional. A note in the contract makes this the rule
   for all future surfaces.

**Rationale**: The audit (grep of `frontend/src`) found all button call sites already
use Bootstrap variants or the custom classes above; only the two bold declarations
violate the target language. Centralizing the rules where the design tokens live is the
Constitution-mandated home for them.

**Alternatives considered**:
- *A React `<Button>` wrapper component*: nice long-term, but pure churn for a visual
  unification with zero behavioral change (YAGNI); rejected.
- *`button { font-weight: 400 }` element selector only*: misses `<a class="btn">` links
  (ResetPasswordPage uses one) and `.section-tab` is a `<button>` but its bold came from
  a higher-specificity class rule; the explicit class list is deterministic; a low-
  specificity element rule is still added as a backstop.

## Decision 5 — Forced-colors, print, and degraded rendering

**Decision**: Extend the existing degradation pattern (`.page-bg` has print +
forced-colors guards) to the card gradients:

```css
@media (forced-colors: active) {
  .chord-card__header, .chord-card__body { background: Canvas; color: CanvasText; }
}
@media print {
  .chord-card__header, .chord-card__body { background: none; color: #000; }
}
```

(Exact properties finalized in implementation; the contract requires: forced palettes
win, focus indicators remain visible, printed cards are legible — FR-011.)

**Rationale**: Gradients are decorative; in forced-colors mode `color-mix` backgrounds
are overridden by the UA anyway, but explicit rules keep the foreground/background
pairing coherent and mirror the established `.page-bg` precedent.

**Alternatives considered**: relying on UA defaults alone — close, but the hardcoded
header foreground would fight forced palettes; rejected.

## Decision 6 — Feature 013 dependency handling

**Decision**: Implement this feature **on top of** feature 013 (theme support). Before
implementation, merge `topic/vii-1014-theme-support` into
`topic/vii-1015-section-color-theming` (or land PR for 013 on `main` first and rebase).
The dark-theme rules in this feature are written against 013's `[data-bs-theme='dark']`
attribute and its dark token values (`--color-bg: #3a3f44`, dark body text, etc.).

**Rationale**: The spec's dark/light blend direction is defined by the active theme;
without 013 there is no dark theme to blend toward. Building light-theme-only first and
retrofitting dark would double the audit work.

**Alternatives considered**: shipping light-only and gating dark rules behind 013 —
pointless staging for two branches owned by the same developer; rejected.

## Decision 7 — What explicitly does NOT change

- `ChordCard.tsx` markup, behavior, reveal/copy/edit logic — untouched (FR-010).
- `Section`/`Chord` shared types, all API routes/payloads, backend services — untouched.
- Section tabs keep their existing ramp (spec Assumption); only cards gain the treatment.
- The add-chord tile and add-section tab keep their faint-primary styling (they are
  buttons → FR-008 says no section color).
- Read-only (normal-role) rendering path — identical coloring, no role dependency.
