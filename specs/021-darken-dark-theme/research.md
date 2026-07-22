# Research: Darker, Less Colorful Dark Theme

**Feature**: 021-darken-dark-theme | **Date**: 2026-07-21

All unknowns from the Technical Context and the one spec `[NEEDS CLARIFICATION]`
(FR-009) are resolved below. No external research was required — the decisions build
on the codebase's own established mechanisms (features 013/014/017 theming stack).

---

## Decision 1: How to darken — retune the existing dark token block, no new mechanism

**Decision**: Change only the *values* inside the existing `[data-bs-theme='dark']`
token block in `frontend/src/styles/tokens.css`, moving the palette from medium-gray
to deep dark-gray (not near-black). Proposed working values (final tuning happens at
implementation against measured AA contrast):

| Token | Current (013) | New (proposed) | Notes |
|---|---|---|---|
| `--color-bg` | `#3a3f44` | `#26292d` | page background — clearly darker, not black |
| `--color-surface` | `#2f3439` | `#1e2226` | cards/panels/menus/dialogs/inputs |
| `--color-border` | `#565e66` | `#484f56` | keeps visible edges on darker surfaces |
| `--color-text` | `#f0f2f4` | `#f0f2f4` (keep) | contrast only improves (≈12.5:1 on new bg) |
| `--color-text-muted` | `#b8c0c8` | `#aab3bb` | may dim slightly; ≥7:1 on new surfaces |
| `--color-primary` | `#6fb4f2` | `#7fa9d2` | desaturated blue; ≥4.5:1 on new bg |
| `--color-primary-contrast` | `#0c2d4d` | `#0c2237` (or keep) | re-check on new primary |
| `--color-danger` | `#ff8a80` | `#ef9a91` | muted but unmistakably "error" |
| `--color-success` | `#57c878` | `#5cb97a` | muted but unmistakably "success" |
| `--color-focus` | `#8bc2f5` | `#93b6d8` | must stay clearly visible on all surfaces |

The `--bs-*` remaps (`--bs-primary-rgb`, `--bs-link-color`, etc.) and the dark
`.btn-primary` / `.alert--error` / `.alert--success` overrides are retuned to match.

**Rationale**: Feature 013 explicitly designed the dark token block as the single
theming point ("future themes = token block edits"). Every component already keys off
`--color-*`/`--bs-*`, so darkening the values re-themes the whole app — page, header,
auth cards, tab bar shell, menus, dialogs, form fields — with zero component edits and
zero risk to light theme (its values live in `:root`, untouched).

**Alternatives considered**:
- *A second `data-bs-theme="darker"` value + new block*: rejected — the spec changes
  the one existing dark theme, not adds a fourth mode; would touch ThemeContext, the
  pre-paint script, and the menu for no user value.
- *Near-black palette (`#000`–`#121212`)*: rejected — spec assumption explicitly rules
  out pure black (smearing/eye-strain), and the dialog header/footer bands already use
  `#000` — surfaces must stay distinguishable from them.
- *A global `filter: brightness()/saturate()` on `<html>` in dark theme*: rejected —
  wrecks fixed-position stacking, degrades text rendering, applies to photos/logo
  unpredictably, and violates the token-based design system.

## Decision 2: How to mute section colors — override the DERIVED ramps, not `--section-color`

**Decision**: `--section-color` is set as an *inline style* by components
(SectionTabs, ChordGrid, AddChordDialog) and inline always beats stylesheet rules — so
it stays untouched. Instead, dark theme adds override rules for every *derived*
variable that turns the section color into pixels, pre-mixing toward a neutral dark
gray before the existing ramp math, via a shared local custom property:

```css
[data-bs-theme='dark'] .section-tab,
[data-bs-theme='dark'] .chord-card,
[data-bs-theme='dark'] .btn-section {
  /* muted section color: ~70% color, ~30% neutral — "a bit" less vivid, still identifiable */
  --section-color-muted: color-mix(in srgb, var(--section-color) 70%, #3a4046);
}
```

then re-declares the dark values of `--tab-top`/`--tab-bottom` (unselected, selected,
hover states), the `.btn-section` `--bs-btn-*` fills, and the `.chord-card` ramps in
terms of `--section-color-muted`. The chord-card body/header ramps additionally mix
toward a slightly off-white (`#e9eaec` instead of `#ffffff`), which both mutes and
gently darkens the card interior while keeping it a light AA contrast band.

**Rationale**: Keeps the muting logic in tokens.css (the design-system layer), needs
zero TSX changes, and automatically covers every current and future consumer of the
ramp variables. The 70/30 mix reduces chroma noticeably ("reduce the color a bit")
while a vivid red still reads red and a lime still reads green — preserving section
identity and the selected-tab affordance (edge case in spec).

**Alternatives considered**:
- *Mute at the source (components emit a darker hex in dark theme)*: rejected — puts
  palette logic in TSX, duplicates the theme decision outside tokens.css, and changes
  what's persisted/displayed in the color picker.
- *`filter: saturate(0.7)` on colored elements*: rejected — filters create stacking
  contexts (breaks the tab overlap/z-index choreography from feature 008) and affect
  child text too.
- *Muting inside `--section-color` itself via a wrapper var consumed everywhere*:
  rejected — requires renaming the variable across many rules and components for the
  same visual result; higher regression risk in light theme.

## Decision 3 (resolves spec FR-009): Chord cards ARE in scope — muted, still light

**Decision**: In dark theme, chord-card interiors keep the feature-014 architecture
(light AA contrast bands, pinned dark text/tokens) but their ramps are rebuilt from
`--section-color-muted` and mixed toward off-white `#e9eaec` rather than pure white —
so the cards become measurably less vivid and slightly less glaring, while remaining
clearly lighter than the page (they stay the visual focus). The pinned dark-text
tokens on `.chord-card` and `--chord-header-fg` are unchanged; AA is re-verified for
the worst-case band (near-black section color).

**Rationale**: The cards and tabs are the most colorful elements in the dark UI — the
user's "too much color" complaint cannot be satisfied while leaving them at current
vividness. Precedent already exists: the dark theme *already* deviates from strict
theme-invariance (feature 014's ramps were deepened for dark "by user request" in a
prior follow-up), so muting them further is an evolution of an established exception,
not a reversal of 014's core contract (contrast-band guarantee + pinned interior
tokens), which is preserved. Going fully dark-interior (option B in the spec question)
was rejected as a larger redesign than "reduce the color a bit" implies.

**Alternatives considered**:
- *Keep cards exactly as-is (option A)*: rejected — leaves the dominant source of
  perceived color untouched; fails SC-001 ("darker AND less colorful").
- *Fully dark card interiors (option B)*: rejected — reverses feature 014's
  deliberate contrast-band design, requires re-deriving every pinned interior token
  and re-checking dozens of AA pairs for marginal extra benefit over muting.

## Decision 4: Background artwork — dim harder via overlays, files untouched

**Decision**: Raise the existing dark-theme `.page-bg` dim overlay from
`rgba(20, 22, 25, 0.55)` to ≈`rgba(16, 18, 20, 0.72)`, and give
`.page-bg--home` (which currently shows its dark-tuned SVG with *no* overlay) a
gradient overlay of ≈`rgba(16, 18, 20, 0.45)` so the home artwork also recedes.
Artwork files in `frontend/public/backgrounds/` are not edited (spec assumption;
feature 005 swap-the-file contract preserved).

**Rationale**: The overlay mechanism already exists for exactly this purpose (feature
013 introduced it); alpha tuning is the minimal, reversible lever. The home page gets
its own gentler value because its artwork is already dark-tuned.

**Alternatives considered**: editing/duplicating SVGs per theme — rejected (violates
the stable-URL swap contract and spec assumption); `filter: brightness()` on
`.page-bg` — rejected (overlay is the established pattern; filters add stacking
contexts).

## Decision 5: What explicitly does NOT change

- **ThemeContext / pre-paint script / persistence** — resolution logic, storage key,
  Auto behavior all untouched (FR-005). Auto flipping to dark simply lands on the new
  values (edge case covered by construction — one source of truth).
- **Forced-colors / print / reduced-motion guards** — attribute-agnostic rules from
  features 005/016/020; not edited (FR-008).
- **Dialog header/footer black lattice bands** (feature 013) — already the darkest
  element; unchanged, and the darker surfaces now sit closer to them harmoniously.
- **Logo brightness filter** (feature 018 `brightness(1.8)`) — re-checked visually on
  the darker header in quickstart; expected to stand, adjusted only if illegible.
- **Light theme, backend, shared, all TSX/HTML** — untouched.
