# UI Contract: Motion & Micro-Animations

**Feature**: specs/020-ui-animations | **Date**: 2026-07-20
**Complements**: specs/017-button-style-unification/contracts/buttons-ui.md (button set +
shape unchanged), specs/014-section-color-theming/contracts/chord-card-theming.md (card
ramps unchanged), specs/016-loading-spinner/contracts/spinner-ui.md (spinner motion
unchanged).

This contract defines the observable motion behavior. It is frontend-only; no API surface
changes.

---

## 1. Button hover sweep

**Applies to** (exactly the feature-017 rectangular set): `.btn` (all variants — primary,
secondary, section), `.chord-add`, `.user-menu__item`.
**Excluded**: `.section-tab` (own hover language), circular controls (avatar, badge,
swatches), icon-only controls (eye/copy/edit, theme radios, dialog header icons, move
arrows).

| Property | Requirement |
|----------|-------------|
| Direction | Hover fill enters from the RIGHT edge, advances LEFT |
| Duration | `--motion-sweep` = 500ms, linear timing |
| Mechanism | Right-anchored background layer (`background-position: right`, `background-size` 0%→100%); resting fill remains beneath |
| Hover color | Carried by `--btn-sweep-color` per variant; `--bs-btn-hover-bg` is pinned to the resting bg so Bootstrap's instant swap is inert |
| Un-hover | Same transition reversed; no stuck partial fill |
| Disabled/busy | `:hover:not(:disabled)` gate — no sweep on disabled or spinner-busy buttons |
| Activation | Click/tap/Enter/Space fire immediately at any sweep progress — the animation MUST NOT gate behavior |
| Active/pressed | `--bs-btn-active-bg` unchanged and instant (pressed feedback stays crisp) |
| Touch | Sweep styling scoped under `@media (hover: hover)` — no stuck hover after tap |

## 2. Chord card hover glow

**Applies to**: `.chord-card`.

| Property | Requirement |
|----------|-------------|
| Effect | Outer glow added to the existing elevation shadow: `0 0 18px 2px color-mix(in srgb, var(--section-color) 55%, transparent)` (exact radii/alpha tunable ±) |
| Duration | `--motion-glow` = 500ms ease, in and out |
| Layout | `box-shadow` only — card size/position and neighbors MUST NOT move |
| Legibility | Glow renders OUTSIDE the card; interior (theme-invariant per 014) unchanged in both themes, any section color |
| Touch | Scoped under `@media (hover: hover)` |
| Drag | `.chord-card.is-dragging` keeps its 0.5 opacity; glow may coexist |

## 3. Staggered card entrance

**Applies to**: chord card wrappers inside `.chord-grid` (the `.chord-add` tile does NOT
stagger — it appears with the grid).

| Property | Requirement |
|----------|-------------|
| Keyframes | `chord-enter`: `opacity 0, translateY(8px)` → neutral |
| Duration | `--motion-enter` = 300ms ease-out, `animation-fill-mode: backwards` |
| Stagger | `animation-delay: min(calc(var(--enter-index) * var(--motion-enter-step)), 1100ms)`; `--motion-enter-step` = 60ms |
| Total cap | Last card fully visible ≤1.5s regardless of count (FR-007) |
| Replay boundary | Plays on grid container (re)mount only: initial vault load + section switch (container React-keyed by `enterKey` = selected section id). Add = new card animates alone. Edit/delete/reorder = NO replay |
| Interactivity | Cards accept input for their entire entrance (opacity never blocks hit-testing); animation MUST NOT block any control |
| Empty section | No cards → no entrance artifacts; empty state renders as today |

**Component API change** (`ChordGrid.tsx`):

```ts
export interface ChordGridProps {
  // ...existing props unchanged...
  /** Remount key for the entrance animation; changes on section switch. */
  enterKey?: string;
}
```

`HomePage.tsx` passes `enterKey={selectedId ?? undefined}`. No other component changes.

## 4. Input focus trace

**Applies to**: `.form-control` text inputs app-wide (login, register, reset, unlock,
entry/section dialog fields). **Excluded**: `.form-select`, checkboxes/radios, color input.

| Property | Requirement |
|----------|-------------|
| Baseline ring | Existing instant border-color + Bootstrap ring on `:focus` is PRESERVED — focus is never invisible for any instant (FR-009, WCAG 2.4.7) |
| Trace | 2px `var(--color-primary)` line, left-anchored (`background-position: left bottom`), `background-size` 0%→100% over `--motion-trace` = 300ms linear |
| Direction | Draws LEFT → RIGHT |
| Blur | Trace retracts/clears; no artifacts |
| Error state | `.is-invalid` danger border remains distinguishable alongside the trace |
| Themes | Uses theme-scoped `--color-primary` token — visible in light and dark |

## 5. Dialog zoom-in

**Applies to**: `.vault-modal` (every VaultModal surface: create/edit section, create/edit
entry, delete confirmations) + `.vault-modal__backdrop`.

| Property | Requirement |
|----------|-------------|
| Panel | `modal-zoom-in`: `opacity 0, scale(0.94)` → neutral, `--motion-zoom` = 200ms ease-out, on mount |
| Backdrop | Fade 0→1 over 150ms |
| Close | Unmounts immediately as today (no exit animation — out of scope) |
| Focus | First-focusable autofocus fires on mount exactly as today; panel is interactive throughout the zoom |
| Escape/cancel mid-zoom | Closes cleanly; no stuck overlay |

## 6. Accessibility & degradation (applies to ALL of the above)

| Environment | Behavior |
|-------------|----------|
| `prefers-reduced-motion: reduce` | ALL five animations removed: hover/focus/open states change instantly (still visibly communicated); no sweep, glow fade, stagger, trace, or zoom motion (SC-005) |
| `forced-colors: active` | Sweep layer and glow suppressed; UA-native hover/focus rendering wins; instant focus ring remains |
| `@media print` | Glow suppressed alongside existing print guards; animations are irrelevant in print |
| Semantics | Zero changes to roles, labels, focus order, keyboard behavior, or announcements (FR-012) |
| Performance | Only `opacity`/`transform`/`background-size`/`box-shadow` animate; no layout properties; no JS timers/loops (FR-013) |

## 7. Non-goals

- Exit/close animations of any kind.
- Animating section tabs, the user-menu panel open, page transitions, or the spinner.
- Any behavior, timing-of-action, data, or backend change.
- New dependencies or animation libraries.
