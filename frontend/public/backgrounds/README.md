# Page background assets

Decorative, **placeholder** SVG backgrounds for the vii-pass SPA (feature 005). These are
intentionally generic and meant to be replaced by final artwork later.

## Why this folder

Files here live under Vite's `public/` directory, so they are served **verbatim** at stable,
unhashed URLs:

```text
frontend/public/backgrounds/login-desktop.svg  →  /backgrounds/login-desktop.svg
```

That stability is the whole point: **replacing a file with the final design requires no code
change** — overwrite the file at the same path/name and the page picks it up.

## Files & naming

Name assets `‹surface›-‹variant›.svg` (lowercase, hyphenated):

| File | Surface | Variant | Used when |
|------|---------|---------|-----------|
| `login-desktop.svg` | login | desktop | All sizes; phones cover-crop this same file |
| `home-desktop.svg` | home | desktop | All sizes; phones cover-crop this same file |

- `desktop` variants use a **landscape** `viewBox` (here `0 0 1600 1000`).
- One graphic per surface — `background-size: cover` cover-crops it on phones, so **no
  separate mobile art is needed**.

## Requirements for each SVG

- Valid **static** SVG with a `viewBox`. **No** `<script>`, event handlers, animation
  (`<animate>`/SMIL/CSS), `<foreignObject>`, external URLs, or embedded raster images — keep it
  self-contained (referenced via CSS `url()`, so scripts would never run, but keep them out anyway).
- Use the brand palette — primary `#0b5cad` (`--color-primary`) and light tints of `#f4f6f8`
  (`--color-surface`) — at **low visual weight**, since page content sits on opaque cards above it.
- Keep the file small (target a few KB) so it never delays page interactivity.
- Purely decorative: it carries no information a user must read (it is hidden from assistive tech).

## How the backgrounds are applied

The reusable mechanism is defined once in [`../../src/styles/tokens.css`](../../src/styles/tokens.css):
a `.page-bg` base class driven by CSS custom properties, plus per-surface modifiers.

```css
.page-bg { /* cover / center top / no-repeat + fallback color; reads --page-bg-image */ }
.page-bg--login { --page-bg-image: url('/backgrounds/login-desktop.svg'); }
.page-bg--home  { --page-bg-image: url('/backgrounds/home-desktop.svg'); }
```

A page opts in by wrapping its content:

```tsx
<div className="page-bg page-bg--login flex-grow-1">
  <div className="container …">…</div>
</div>
```

## Replacing a placeholder with final art

1. Export the final design as an optimized SVG.
2. Save it over the existing file **using the same name** (e.g. overwrite `login-desktop.svg`).
3. Done — no code, class, or markup change. If the new art has a different aspect ratio, only its
   `viewBox` differs; `background-size: cover` adapts automatically.

## Adding a background to a new surface/container

Pick one:

1. **Reuse** an existing look: add `className="page-bg page-bg--home"` (or `--login`).
2. **New surface**: add `‹name›-desktop.svg` here, add a `.page-bg--‹name›` modifier in
   `tokens.css` setting `--page-bg-image`, then apply `className="page-bg page-bg--‹name›"`.
3. **Ad-hoc**: apply `className="page-bg"` and set the variable inline, e.g.
   `style={{ ['--page-bg-image']: "url('/backgrounds/foo-desktop.svg')" }}`.

No per-container background CSS is written — only variables are set.
