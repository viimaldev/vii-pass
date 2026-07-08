# Contract: Background Assets & Reusable `.page-bg` Mechanism

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Date**: 2026-07-08

This is the **UI/asset contract** for the SVG background feature — the stable, public-facing surface
that other code, future surfaces, and designers depend on. It has two parts: (A) the **asset
convention** (where files live, how they are named, what they must contain) and (B) the **CSS API**
(the class + custom properties that apply a background). Honoring this contract is what makes the
placeholders replaceable with zero code change and the treatment reusable on future containers.

---

## A. Asset convention

### A.1 Location (single source of truth)

```text
frontend/public/backgrounds/
├── README.md            # human docs: naming + how to replace
├── login-desktop.svg    # login, desktop/tablet (landscape)
├── login-mobile.svg     # login, phone (portrait)
└── home-desktop.svg     # home, all sizes (phones cover-crop this)
```

- All background assets MUST live in `frontend/public/backgrounds/` and **nowhere else** (FR-004).
- Vite serves this folder at the site root, so each file is reachable at a **stable, unhashed** URL:
  `/backgrounds/<fileName>`.

### A.2 Naming

- Pattern: **`<surface>-<variant>.svg`**, all lowercase ASCII with hyphens.
  - `<surface>` ∈ { `login`, `home`, … future names } and MUST match the modifier class
    `.page-bg--<surface>`.
  - `<variant>` ∈ { `desktop`, `mobile` }.
- Examples: `login-desktop.svg`, `login-mobile.svg`, `home-desktop.svg`.

### A.3 File requirements (each SVG)

| Requirement | Rule |
|-------------|------|
| Format | Valid static **SVG 1.1** with a `viewBox`. |
| Aspect | `desktop` → landscape `viewBox` (≈16:10 recommended). `mobile` → portrait `viewBox` (≈9:16). |
| No scripts | MUST NOT contain `<script>`, event handlers, `<foreignObject>`, or animation (`<animate>`, SMIL, CSS animation). |
| No external refs | MUST NOT reference external URLs or embed raster images (`<image href>`); fully self-contained. |
| Palette | Use brand tokens only — `#0b5cad` (`--color-primary`) and light tints of `#f4f6f8` (`--color-surface`); keep visual weight low so cards stay legible. |
| Size | Target a few KB; keep well under ~30 KB (FR-010). |
| Decorative | Carries no text/information that a user must read (it is hidden from assistive tech). |

> **Replacing placeholder art (the swap contract)**: drop a new file at the **same path/filename**
> (e.g., overwrite `login-desktop.svg`). No code, class, import, or markup changes are required
> (FR-003, SC-004). If the final design changes aspect ratio, only the SVG's `viewBox` changes —
> `background-size: cover` adapts automatically.

---

## B. CSS API (the reusable mechanism)

Defined once in [frontend/src/styles/tokens.css](../../../frontend/src/styles/tokens.css).

### B.1 Base class

```css
.page-bg {
  background-color: var(--page-bg-fallback, var(--color-surface));
  background-image: var(--page-bg-image, none);
  background-repeat: no-repeat;
  background-position: center top;
  background-size: cover;
}

/* Phones (below Bootstrap `sm`): use the mobile variant if defined, else cover-crop the base. */
@media (max-width: 575.98px) {
  .page-bg {
    background-image: var(--page-bg-image-mobile, var(--page-bg-image, none));
  }
}

/* Decorative only: drop the art for print and high-contrast/forced-colors modes. */
@media print {
  .page-bg { background-image: none; }
}
@media (forced-colors: active) {
  .page-bg { background-image: none; }
}
```

### B.2 Custom properties (the inputs)

| Property | Required | Default | Purpose |
|----------|----------|---------|---------|
| `--page-bg-image` | Yes (per surface) | `none` | Desktop/base graphic, `url('/backgrounds/<surface>-desktop.svg')`. |
| `--page-bg-image-mobile` | No | inherits `--page-bg-image` | Phone graphic; omit to cover-crop the base. |
| `--page-bg-fallback` | No | `var(--color-surface)` | Solid color shown on load failure (FR-011). |

### B.3 Surface modifier classes

```css
.page-bg--login {
  --page-bg-image: url('/backgrounds/login-desktop.svg');
  --page-bg-image-mobile: url('/backgrounds/login-mobile.svg'); /* alternate mobile file */
}

.page-bg--home {
  --page-bg-image: url('/backgrounds/home-desktop.svg');
  /* no mobile variable → phones cover-crop the desktop SVG */
}
```

### B.4 Usage (applying a background)

Wrap a page's existing Bootstrap `.container` in a full-bleed element that carries the classes:

```tsx
// LoginPage.tsx / HomePage.tsx
<div className="page-bg page-bg--login flex-grow-1">
  <div className="container py-4 py-md-5">
    {/* existing card/content unchanged */}
  </div>
</div>
```

The application shell enables full-height fill by making `<main>` a flex column:

```tsx
// Layout.tsx
<main id="main-content" className="flex-grow-1 d-flex flex-column">
```

### B.5 Extending to a future container (the reuse contract)

To give any future container a background, do **one** of:

1. **Reuse an existing surface**: add `class="page-bg page-bg--home"` (or `--login`).
2. **Add a new surface**: create `<name>-desktop.svg` (and optionally `<name>-mobile.svg`) in
   `public/backgrounds/`, add a `.page-bg--<name>` modifier setting `--page-bg-image`, then apply
   `class="page-bg page-bg--<name>"`.
3. **Ad-hoc/inline**: apply `class="page-bg"` and set the variable inline, e.g.
   `style={{ ['--page-bg-image']: "url('/backgrounds/foo-desktop.svg')" }}`.

No bespoke background CSS is written per container — only variables are set (FR-007, SC-005).

---

## C. Conformance checklist (verifiable)

- [ ] All background files are under `frontend/public/backgrounds/` and match `<surface>-<variant>.svg`.
- [ ] `.page-bg` sets `cover` / `center top` / `no-repeat` and a `--page-bg-fallback` color.
- [ ] A `@media (max-width: 575.98px)` rule swaps to `--page-bg-image-mobile` (falling back to base).
- [ ] `@media print` and `@media (forced-colors: active)` remove the background image.
- [ ] `.page-bg--login` sets both desktop and mobile variables; `.page-bg--home` sets only desktop.
- [ ] Login and home wrap `.container` in `page-bg page-bg--<surface> flex-grow-1`; `<main>` has
      `d-flex flex-column`.
- [ ] Replacing a file at the same path updates the page with no code change.
- [ ] Backgrounds add no nodes to the accessibility tree and no entries to the focus order.
