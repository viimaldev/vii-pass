# Contract: Chord Card & Form UI

**Feature**: 009-chord-credential-fields | **Date**: 2026-07-11

## Chord form (`AddChordDialog` — create & edit)

Rendered inside the existing `VaultModal` (focus trap, Esc, restore focus). Same dialog
serves create (empty defaults) and edit (pre-filled from the chord, including unused
rows' remembered types).

| # | Control | Rules |
|---|---------|-------|
| 1 | **Title** text input | Required; `maxLength` 100; blank submit → inline "Title is required."; server 409 → inline duplicate message |
| 2 | **URL** text input | Optional; `inputMode="url"`; invalid address → inline "Enter a valid web address."; never echoed on the card |
| 3–5 | **Option rows ×3** | Each: type `<select>` (Username, Email, Password, Other, Other sensitive — with type icon shown beside the row) + value text input (`maxLength` 200). Empty value = unused row. Row 3 defaults: username / password / other |
| — | **Save** / **Cancel** | Footer, existing button styles; Cancel (or Esc) discards everything; Save disabled while submitting |
| — | **Delete** (edit only) | Unchanged from feature 006 (header trash icon + confirm step) |

Value inputs use `type="text"` with `autoComplete="off"` (values are being *stored*,
not entered as the user's own login — browser password managers must not capture them).

A11y: every input labelled; validation messages linked via `aria-describedby` +
`aria-invalid`; type selects have visible labels ("Type") or `aria-label`s per row.

## Chord card (`ChordCard`)

```text
┌──────────────────────────────────────────────┐
│  Title (link if url)          [copy-link] [✎]│   ← header
│  [icon] value                        [copy]  │   ← non-sensitive row
│  [icon] ••••••••               [eye] [copy]  │   ← sensitive row
└──────────────────────────────────────────────┘
```

### Header

- **Title with URL**: rendered as `<a href={chord.url} target="_blank"
  rel="noopener noreferrer">` — native link cursor on hover (FR-004), opens in a new
  tab/window, never navigates the vault. URL text itself is **never** displayed.
- **Title without URL**: plain heading text — no link cursor, no navigation (FR-006).
- **Actions order (left → right)**: copy-link button (only when `url` present,
  `aria-label` "Copy link for {title}") **then** edit button — copy-link sits
  immediately **before** edit (FR-005). Drag handle/move affordances unchanged.

### Rows

- Only rows with a non-null value are rendered, in slot order 1→3.
- Each row: type icon (inline SVG, `aria-hidden`) + visually-hidden type name for screen
  readers + value.
- **Non-sensitive** (`username`, `email`, `other`): value in plain text; single **copy**
  button.
- **Sensitive** (`password`, `otherSensitive`): value masked as `••••••••` (fixed-length
  mask — does not leak value length); **eye** toggle (`aria-pressed`, reveals/re-masks)
  then **copy** button. Copy uses the real value without requiring reveal. Reveal state
  is per-card, per-row, resets to masked on any re-render/unmount (FR-012).

### Copy feedback (all copy buttons, incl. copy-link)

- Success: transient check state ≈1.5s (`aria-label` unchanged; visible glyph swap).
- Failure (clipboard unavailable/denied): transient visible failure state — never silent.

### Icons (single source: `chordFieldTypes.tsx`)

| Type | Icon (Bootstrap Icons path) |
|------|------------------------------|
| username | `person` |
| email | `envelope` |
| password | `key` |
| other | `tag` |
| otherSensitive | `shield-lock` |

Eye/eye-off, copy, and link icons also move to inline SVGs for visual consistency.

### Responsive

- Card grid unchanged (1/2/3 columns). At ~320px: title truncates with ellipsis
  (`title` attr keeps full text), values truncate, buttons keep ≥ 44px touch targets,
  controls never overlap or overflow (SC-005).
- Long values: truncated visually; copy always copies the full stored value.
