# Quickstart: Chord Credential Fields

**Feature**: 009-chord-credential-fields | **Date**: 2026-07-11

## 1. Prerequisites

- Node 22+, repo dependencies installed (`npm install` at root).
- `backend/.dev.vars` present (MONGODB_URI etc.); `frontend/.env.local` with
  `VITE_API_BASE_URL="http://localhost:8787"`.

## 2. One-time data reset (placeholder chords are NOT migrated)

Placeholder-era chords have no `title` and would violate the new required/unique rules.
Drop the collection in each environment **before** testing (dev/preview first; prod at
deploy time):

```javascript
// mongosh, against the target database (e.g. vii_pass_preview)
db.chords.drop()
```

The service recreates the collection and both indexes (ordering index + the new unique
`{ userId, sectionId, titleNormalized }` index) lazily on first use. Sections are
untouched.

## 3. Run locally

```powershell
npm run dev:node   # Node API :8787 + Vite SPA :5173 (no wrangler)
```

Sign in (or register) at http://localhost:5173.

## 4. Manual verification walkthrough

### Create (US1)

1. Open a section → add chord. Form shows: Title, URL, three type/value rows, Save/Cancel.
2. Save with an empty Title → inline "Title is required.", nothing created.
3. Create "GitHub" with URL `github.com/login`, row 1 username `octocat`,
   row 2 password `s3cret`, row 3 empty → card shows title, person-icon + `octocat`,
   key-icon + masked dots. Empty row not rendered.
4. Add another chord titled `  github ` in the same section → rejected with the
   duplicate-title message. Create it in a **different** section → succeeds.
5. Cancel a filled form → nothing created.

### Card interactions (US2)

1. Hover the "GitHub" title → link cursor. Click → opens `https://github.com/login` in a
   new tab; vault stays put. Confirm the URL text appears nowhere on the card.
2. Copy-link button (immediately left of edit) → clipboard = URL only; check feedback.
3. Username row copy → clipboard = `octocat`.
4. Password row: starts masked; eye reveals, eye again re-masks; copy while masked →
   clipboard = `s3cret` (real value).
5. Switch sections and back → password masked again.
6. A chord without URL → plain title, no link cursor, no copy-link button.

### Edit (US3)

1. Edit "GitHub" → form pre-filled (title, URL, row types + values).
2. Rename to `GITHUB` (casing only) → saves fine (no self-conflict).
3. Rename to another existing title in the section → 409 message, chord unchanged.
4. Change password value → card still masked; copy yields new value.
5. Enter URL `javascript:alert(1)` → rejected ("Enter a valid web address.").

### Responsive & a11y (Constitution III)

- At ~320px, 768px, desktop: form usable, card controls ≥44px, no overlap/overflow,
  long titles/values truncate.
- Keyboard: tab to title link, copy buttons, eye toggles (aria-pressed announces state);
  all controls labelled.

## 5. Quality gates

```powershell
npm run typecheck                       # all 3 workspaces
npm run lint
npm run build --workspaces --if-present # frontend vite build
```

## 6. Deploy notes

- Remember step 2 (`db.chords.drop()`) against the **production** DB when the feature
  ships (push to `main` auto-deploys the Worker).
- No new secrets, vars, or wrangler config; no dependency changes.
