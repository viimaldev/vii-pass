# Research: UI Micro-Animations

**Feature**: specs/020-ui-animations | **Date**: 2026-07-20

No `NEEDS CLARIFICATION` markers remained in the Technical Context; the research below
records the technique decisions for each of the five animations and the cross-cutting
accessibility/performance strategy.

---

## Decision 1 — Button hover sweep: right-anchored `background-size` transition

**Decision**: Implement the right→left hover sweep by layering the hover color as a
`background-image: linear-gradient(<hover-color>, <hover-color>)` anchored at
`background-position: right center` with `background-size: 0% 100%`, transitioned to
`background-size: 100% 100%` over `500ms linear` on `:hover`. Because the layer is anchored
to the RIGHT edge, growing its width makes it advance leftward — exactly the requested
direction. The resting `background-color` stays underneath, so un-hover simply shrinks the
layer back toward the right edge (smooth reversal for free, FR-002). Bootstrap's instant
hover swap is neutralized per variant by setting `--bs-btn-hover-bg` equal to the resting
`--bs-btn-bg` and carrying the real hover color in the sweep layer (a new
`--btn-sweep-color` custom property set alongside each variant's existing `--bs-btn-*`
overrides in tokens.css: `.btn-primary`, `.btn-secondary`, `.btn-section`; `.chord-add` and
`.user-menu__item` get their wash color moved into the same mechanism). Border-color hover
changes remain instant (subtle, and animating them would desynchronize from the sweep).
The sweep is gated with `:hover:not(:disabled)` so disabled/busy buttons never play it
(FR-003), and activation is untouched — `transition` never delays `click` events (FR-002).

**Rationale**:

- Pure CSS on the button element itself: no pseudo-elements, no `position:
  relative`/`overflow: hidden`/z-index management, no risk of covering the label or the
  feature-016 button spinner (background layers always paint below content).
- Plays perfectly with the feature-017 `border-radius: 20px` silhouette (background layers
  are clipped by the border box automatically).
- Reversal on pointer-exit is the same transition run backward — no stuck partial fills
  (SC-002).

**Alternatives considered**:

- **`::before` pseudo-element with `transform: scaleX()` (origin right)** — compositor-friendly,
  but requires `position: relative` + `overflow: hidden` + `z-index` juggling on every
  button variant and risks stacking above the label/spinner; rejected as more invasive for
  no visible benefit at button sizes.
- **`background-position` slide on an oversized gradient** — needs a 200%-wide gradient and
  produces a moving hard edge that distorts near corners; `background-size` is simpler.
- **Animating `background-color` alone** — cannot express a directional sweep (the whole
  requirement); rejected.

**Scope**: exactly the feature-017 rectangular-button set — `.btn` (all variants incl.
auth submits, dialog footers, unlock, reset), `.chord-add`, `.user-menu__item`. Section
tabs, circular avatar/badge/swatches, theme radios, and small icon-only controls are
excluded (spec assumption; 017 contract non-goals).

## Decision 2 — Chord card glow: transitioned `box-shadow` in the section color

**Decision**: On `.chord-card:hover`, transition the existing elevation shadow to a
two-part shadow — the current elevation plus a soft outer glow derived from the section
color: `box-shadow: 0 2px 8px rgba(0,0,0,0.35), 0 0 18px 2px color-mix(in srgb,
var(--section-color) 55%, transparent)`. Transition `box-shadow 500ms ease` in, matching
ease out (FR-004's "slowly", spec assumption 400–600ms). `box-shadow` affects no layout
(zero shift for neighbors, FR-004) and the glow sits OUTSIDE the card, so interior contrast
is untouched in both themes (FR-005 — the card interior is theme-invariant per feature 014).

**Rationale**: one declaration on an existing rule; section-colored glow reinforces the
feature-014 theming language; `color-mix` with `transparent` is the established pattern in
this stylesheet.

**Alternatives considered**:

- **`filter: drop-shadow()`** — forces the whole card onto its own layer and repaints the
  full card each frame; box-shadow only repaints the shadow region. Rejected.
- **Animated `outline`/`border`** — border changes layout or clips with `overflow: hidden`;
  rejected.
- **Scale-up on hover** — explicitly avoided: FR-004 forbids size change/layout shift.

**Touch note**: glow (and the button sweep hover styling) is wrapped in
`@media (hover: hover)` so tap-to-activate on touchscreens never leaves a stuck glow
(edge case "Touch devices").

## Decision 3 — Staggered card entrance: CSS insertion animation + inline `--enter-index` + remount key

**Decision**: Each chord wrapper in `ChordGrid.tsx` gets an inline custom property
`--enter-index: <i>`; a CSS animation `chord-enter` (from `opacity: 0; transform:
translateY(8px)` to neutral, ~300ms ease-out, `animation-fill-mode: backwards`) plays on
DOM insertion with `animation-delay: min(calc(var(--enter-index) * 60ms), 1100ms)`. The
`min()` cap guarantees the LAST card is fully visible by ~1.4s even with dozens of cards
(FR-007 / SC-003). Replay semantics come from React keying: the grid container receives a
new `enterKey` prop (HomePage passes `selectedId`) used as the container's React `key`, so
a **section switch remounts the grid** and replays the sequence, while single mutations
(add/edit/delete/reorder) reuse existing DOM nodes by key and do NOT replay it — only a
newly ADDED card is a fresh node and animates in individually (spec assumption). Cards are
interactive throughout: `opacity` doesn't block hit-testing, and `animation` never blocks
input (FR-007).

**Rationale**: zero JS animation code, zero timers, zero IntersectionObserver; React's
existing keyed reconciliation gives exactly the required replay boundary; the vault loads
all chords upfront (feature 015), so the grid renders once per section switch — a perfect
insertion-animation trigger.

**Alternatives considered**:

- **JS-driven stagger (setTimeout / requestAnimationFrame loop)** — imperative state,
  cleanup, and race conditions with unmount for no benefit; rejected.
- **`transition-delay` + class toggling** — needs a mounted→shown state flip via
  `useEffect`, i.e. more JS for the same visual; rejected.
- **Web Animations API** — per-element JS invocations; rejected (CSS-first mandate).
- **Uncapped delay (`i * 60ms`)** — 40 cards would take 2.4s+; violates FR-007. The CSS
  `min()` cap keeps it compliant (already used elsewhere in this stylesheet, e.g. `.auth-logo`).

## Decision 4 — Focus trace: instant ring PLUS left-anchored underline `background-size` sweep

**Decision**: Keep the existing instant focus indication on `.form-control:focus`
(border-color + Bootstrap ring, already tokens-aligned) — this is what guarantees FR-009's
"focus is never invisible" (WCAG 2.4.7) — and ADD the directional embellishment: a 2px
accent line in `var(--color-primary)` drawn as a `linear-gradient` background layer
anchored `left bottom`, transitioned from `background-size: 0% 2px` to `100% 2px` over
`300ms linear` on focus. The line draws left→right (left-anchored growth), clears on blur
(transition back), and reads clearly against both themes since it uses the theme-scoped
primary token. Inputs in error state keep `.is-invalid`'s danger border, which remains
distinguishable from the primary-colored trace (US4 scenario 4). Scope: `.form-control`
text inputs (login, register, reset, unlock, dialog title/URL/value fields). `.form-select`
and non-text controls are out of scope (spec: "text box").

**Rationale**: a literal "outline that draws around the box" cannot be animated on a form
control (replaced elements don't support pseudo-elements; wrapping every input in a new
element would touch every form in the app and violate FR-012's no-structural-change
guarantee). The underline-trace is the standard, robust interpretation: directional,
left→right, works on the element itself, and — critically — never replaces the instant
ring, so keyboard tabbing at speed always shows focus (SC-004).

**Alternatives considered**:

- **Animated `outline`/`box-shadow` ring** — neither can sweep directionally; rejected.
- **Wrapper element + `::after` border drawing (clip-path animation)** — requires DOM
  changes in 6+ forms and focus-within bookkeeping; rejected as invasive.
- **Replacing the ring with only the animated line** — would create a brief window where
  focus indication is partial; violates FR-009; rejected.

## Decision 5 — Dialog zoom-in: CSS insertion animations on `.vault-modal` + backdrop fade

**Decision**: `VaultModal` already mounts on open and unmounts on close (no exit animation
required — the spec only mandates opening). Add `animation: modal-zoom-in 200ms ease-out`
on `.vault-modal` (from `opacity: 0; transform: scale(0.94)` to neutral) and `animation:
modal-fade-in 150ms ease-out` on `.vault-modal__backdrop` (opacity 0→1). This covers every
surface built on VaultModal: new/edit section (`SectionDialog`), new/edit entry
(`AddChordDialog`), and their delete confirmations (header-action flows within the same
dialogs). Focus behavior is untouched: the existing `useEffect` focuses the first focusable
element on mount; a CSS transform never affects focusability, and 200ms is short enough
that tabbing mid-zoom simply operates on the (already-interactive) scaling panel (edge case
"Focus during dialog zoom"). Escape/cancel mid-animation unmounts as today — no stuck
overlay (US5 scenario 3).

**Rationale**: insertion animation = zero component changes; `opacity`/`transform` are
compositor-only (60fps); matches the "quick 150–250ms" spec assumption.

**Alternatives considered**:

- **Exit (zoom-out) animation** — requires delayed unmount state machinery in VaultModal
  for a transition the spec doesn't ask for; rejected (YAGNI).
- **Animating from `scale(0)`** — cartoonish and slower to read; small-delta zoom (0.94→1)
  is the established dialog idiom; rejected.

## Decision 6 — Cross-cutting: motion tokens, reduced-motion, forced-colors, print

**Decision**: All durations/easings live as CSS custom properties in the tokens block
(`--motion-sweep: 500ms`, `--motion-glow: 500ms`, `--motion-enter: 300ms`,
`--motion-enter-step: 60ms`, `--motion-trace: 300ms`, `--motion-zoom: 200ms`) so the motion
language is defined once (Constitution III). A single
`@media (prefers-reduced-motion: reduce)` block zeroes ALL of it: sweep/trace transitions
removed (hover/focus states change instantly — still visibly communicated), `chord-enter` /
`modal-zoom-in` / `modal-fade-in` animations set to `none` (cards/dialog appear instantly),
glow transition removed (glow appears instantly — a static state change, no motion). This
mirrors the existing `.spinner` reduced-motion precedent (FR-011 / SC-005).
`@media (forced-colors: active)`: gradients/shadows are already stripped by the UA where it
matters; the sweep layer is additionally disabled so hover states rely on the UA's native
rendering, and the focus trace defers to the always-present ring (edge case
"Forced-colors"). `@media print`: no additions needed — animations don't print — but the
glow shadow is suppressed alongside the existing print guards for clean output.

**Rationale**: WCAG 2.3.3 compliance, one-switch maintainability, and consistency with the
stylesheet's existing degradation guards (`.page-bg`, `.spinner`, `.vault-modal__footer`).

**Alternatives considered**: per-rule reduced-motion exceptions (scattered, easy to miss on
future edits) — rejected in favor of the single block keyed on the motion tokens.
