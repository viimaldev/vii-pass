# Quickstart: Credential Sections & Chords

This walks through verifying the feature end to end using the working local loop.

## Prerequisites

- Local dev loop running against the preview DB: from the repo root run `npm run dev:node`
  (starts the Node API on :8787 + Vite SPA on :5173). See repo memory for details.
- A registered user (register via the SPA if needed). All section/chord routes require a
  valid session cookie.

## 1. Backend smoke check (optional, via SPA session)

The vault endpoints are session-protected. Easiest is to exercise them through the SPA
(cookies flow automatically in the browser). Direct PowerShell calls need the HttpClient
cookie workaround documented in repo memory.

Expected routes (all under `/api`):

- `GET  /sections` → `{ sections: [...] }` (auto-creates **Mine** on first call)
- `POST /sections` `{ name, color }` → `{ section }`
- `POST /sections/reorder` `{ orderedIds }` → `{ sections }`
- `GET  /sections/{sectionId}/chords` → `{ chords: [...] }`
- `POST /sections/{sectionId}/chords` `{ field1?, field2?, field3? }` → `{ chord }`
- `POST /sections/{sectionId}/chords/reorder` `{ orderedIds }` → `{ chords }`
- `PATCH /chords/{chordId}` `{ field1?, field2?, field3? }` → `{ chord }`

## 2. UI walkthrough (browser at http://localhost:5173)

1. **Sign in.** After login you land on the vault surface (HomePage).
2. **Default section.** Confirm a **Mine** tab is present and selected on first visit, with
   only the **add chord** tile in its (empty) chord grid. (US1)
3. **Create a section.** Click the trailing **+** tab. The dialog opens with an empty
   **Section name** and a color picker pre-filled with a random color. Enter a name, keep or
   change the color, click **Save**. The new tab appears at the end (before **+**) and is
   selected. (US2)
   - Try **Save** with an empty name → blocked with a "name is required" message.
   - Try **Cancel** → dialog closes, nothing created.
4. **Add a chord.** In the selected section, click the **add chord** tile (same size as a
   chord). The dialog opens with placeholder fields 1, 2, 3. Fill any, click **Save** → a new
   chord tile appears at the end. **Cancel** creates nothing. (US3)
5. **Reorder.** Drag a section tab to a new position — the **+** tab stays last. Drag a chord
   within a section — the **add chord** tile stays last. Use keyboard move controls too. (US4)
6. **Persist.** Reload the page (and re-login) — sections and chords appear in your customized
   order with your names and colors. (US4)
7. **Show / copy / edit.** On a chord tile, reveal a hidden value, copy a value to the
   clipboard, and open the edit affordance. (US5)
8. **Isolation.** Sign in as a different user → you see only that user's sections/chords
   (a fresh user sees just **Mine**). (FR-018)

## 3. Responsive check

At 320–375px width: the section tab strip scrolls horizontally without clipping; chord tiles
reflow into a single column; dialogs are usable with touch-sized targets. At tablet/desktop
widths the chord grid shows multiple columns. (FR-020, SC-005)

## 4. Quality gates

From the repo root:

```powershell
npm run typecheck   # all 3 workspaces
npm run lint        # eslint .
npm run build --workspaces --if-present   # frontend Vite build
```

All must pass green (no unit tests per Constitution Principle II).
