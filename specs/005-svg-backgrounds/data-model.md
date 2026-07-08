# Phase 1 Data Model: SVG Background Placeholders

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-07-08

This feature persists no database records. The "data model" here is the **design model** that binds
the spec's Key Entities (Background asset, Background surface) to concrete artifacts: static files, a
CSS class, and a small set of CSS custom properties. It defines the shapes, the naming/validation
rules, and the relationships that the contract ([contracts/background-assets.md](./contracts/background-assets.md))
formalizes.

---

## Entity 1 — Background Asset

A single decorative, scalable graphic file used as a backdrop. Intentionally a **placeholder** to be
replaced by final art.

| Attribute | Type / Format | Rule |
|-----------|---------------|------|
| `fileName` | kebab-case `<surface>-<variant>.svg` | e.g. `login-desktop.svg`, `home-desktop.svg`. Lowercase ASCII + hyphens only. |
| `location` | path | MUST be `frontend/public/backgrounds/` (single source folder). |
| `url` | absolute site path | Derived: `/backgrounds/<fileName>`. Stable and unhashed (Vite `public/`). |
| `format` | `image/svg+xml` | Static SVG 1.1. No `<script>`, no `<animate>`, no external `href`/`xlink:href`, no embedded rasters. |
| `variant` | `desktop` | `desktop` = landscape `viewBox` (e.g. 16:10), used at every size and cover-cropped on phones. |
| `palette` | brand tokens | Colors drawn from `--color-primary` (`#0b5cad`) and light tints of `--color-surface` (`#f4f6f8`); low visual weight. |
| `size` | bytes | Budget: a few KB each (keep well under ~30 KB) so it never blocks interactivity (FR-010). |

**Lifecycle / state**: `placeholder` → (designer swaps file) → `final`. The swap is a file
replacement at the same `url`; no attribute above changes and no code references move.

**Validation notes**:
- SVG must be self-contained and script-free (security: referenced via CSS `url()`, never inlined).
- SVG has no intrinsic pixel size dependency — it scales crisply at any DPR (FR-008), so no `@2x`
  raster variants are needed.

---

## Entity 2 — Background Surface (Slot)

A named place a background is applied. Today: **login** and **home**; extensible to future
containers via the same mechanism.

| Attribute | Type / Format | Rule |
|-----------|---------------|------|
| `name` | identifier | e.g. `login`, `home`. Maps to a modifier class `.page-bg--<name>`. |
| `desktopAsset` | Background Asset ref | REQUIRED. Set via `--page-bg-image: url('/backgrounds/<name>-desktop.svg')`. Used at every size; phones cover-crop it. |
| `fallbackColor` | color token | Defaults to `--color-surface`; overridable per surface via `--page-bg-fallback`. Shown if the asset fails to load (FR-011). |
| `appliedTo` | DOM element | A full-bleed wrapper `<div>` around the page's Bootstrap `.container`, carrying `page-bg page-bg--<name> flex-grow-1`. |

**Instances for this feature**:

| Surface | desktopAsset | Mobile strategy |
|---------|--------------|-----------------|
| `login` | `login-desktop.svg` | **Cover-crop the desktop file** |
| `home` | `home-desktop.svg` | **Cover-crop the desktop file** |

**Relationships**:
- A Surface **references** exactly one `desktopAsset` (required).
- Many Surfaces **share** one base mechanism (`.page-bg`); they differ only in the variables they set.
- An Asset MAY be referenced by multiple Surfaces (not required here).

---

## Entity 3 — CSS Variable Contract (the reusable mechanism)

The interface every surface uses. Defined once on `.page-bg`; set per surface by the modifier class
(or inline for ad-hoc containers).

| Variable | Consumed by | Default | Meaning |
|----------|-------------|---------|---------|
| `--page-bg-image` | `.page-bg` `background-image` | `none` | The surface graphic (`url(...)`); cover-cropped at every viewport. |
| `--page-bg-fallback` | `.page-bg` `background-color` | `var(--color-surface)` | On-brand color shown on load failure / behind transparent art. |

**Fixed base declarations on `.page-bg`** (not variable): `background-size: cover;`
`background-position: center top;` `background-repeat: no-repeat;` plus the
`@media print`/`@media (forced-colors: active)` rules that set `background-image: none;`.

---

## Traceability (entities → requirements)

| Requirement | Covered by |
|-------------|------------|
| FR-001 / FR-002 (login & home backgrounds) | Surfaces `login`, `home` |
| FR-003 (replaceable placeholders) | Asset `url` stable/unhashed; swap = file replace |
| FR-004 (single location) | Asset `location` = `public/backgrounds/` |
| FR-005 (legibility) | Content on opaque `.card`s; low-weight art |
| FR-006 (responsive) | `mobileAsset` variant + cover-crop at `sm` |
| FR-007 (reusable mechanism) | Entity 3 CSS variable contract + `.page-bg` |
| FR-008 (crisp at all sizes/DPR) | SVG format |
| FR-009 (decorative-only) | CSS background (Entity 2 `appliedTo`), no a11y-tree node |
| FR-010 (no perf regression) | Asset `size` budget; non-blocking `background-image` |
| FR-011 (fallback on failure) | `--page-bg-fallback` |
| FR-012 (uses design tokens) | Asset `palette`; fallback token |
