# Quickstart: UI Fixes & Polish — Verification

Manual walkthrough to verify all seven fixes. Run the app locally
(`npm run dev` frontend + `npm run dev:node` backend) and check at **mobile (~320px)**,
**tablet**, and **desktop** widths where UI is involved.

## Prerequisites

- A registered user with at least one section and a couple of chords.
- Browser devtools open with a responsive/device-toolbar for width checks.

## 1. Page title (FR-001)

1. Load the app on the login route.
2. **Expect**: browser tab reads **"Vii Pass"**.
3. Sign in and navigate to home, then sign out to signup.
4. **Expect**: tab still reads **"Vii Pass"** on every route.

## 2. Auth pages — no header, brand on card (FR-002, FR-003)

1. Sign out and open **/login**.
2. **Expect**: no top navigation/header bar anywhere on the page.
3. **Expect**: the card shows **"Vii Pass"** brand text at the top, above the "Sign in" form.
4. Open **/register**.
5. **Expect**: no header; **"Vii Pass"** brand text above the "Sign up" form.
6. Narrow to ~320px — **Expect**: brand + form remain legible and usable.

## 3. Translucent header + Add Chord surface (FR-004, FR-005, FR-006)

1. Sign in and view the home page.
2. **Expect**: the decorative background is visible **behind** the top header.
3. **Expect**: the header surface is translucent (~40%) but its text/controls are fully
   legible.
4. Open **Add Chord** (and an existing chord's **Edit**).
5. **Expect**: the dialog surface is white at ~40% opacity — background faintly visible —
   while fields/labels remain fully legible.

## 4. Fluid chord grid (FR-007, FR-008)

1. On the home page with several chords, widen the window across desktop sizes.
2. **Expect**: cards are never narrower than **350px** and **stretch to fill** the row — no
   large empty gap after the last card.
3. Narrow to tablet then ~320px.
4. **Expect**: cards wrap/stack, stay usable, and no horizontal scrollbar appears.

## 5. Inline delete + confirmation (FR-009, FR-010)

1. Open an existing chord's **Edit** dialog.
2. **Expect**: an **icon-only** delete control appears in the dialog **header**.
3. Activate it.
4. **Expect**: a **confirmation** prompt appears before anything is deleted.
5. Cancel — **Expect**: the chord is **not** deleted and the edit dialog is still usable.
6. Delete again and confirm — **Expect**: the chord is removed.
7. Verify keyboard: the delete control is reachable by Tab and has an accessible label.

## 6. Section title bounds + ellipsis + tooltip (FR-011, FR-012)

1. Create a section with a short name and one with a very long name.
2. **Expect**: each tab is between **100px and 150px** wide.
3. **Expect**: the long name is truncated with an **ellipsis**.
4. Hover (or keyboard-focus) the truncated tab.
5. **Expect**: a **tooltip** reveals the full section name.

## 7. Reject duplicate sections (FR-013)

1. Create a section named **"Work"**.
2. Attempt to create another named **"Work"** (also try **"work"** and **"  Work  "**).
3. **Expect**: each attempt is rejected with a clear message
   ("A section with that name already exists.") and **no duplicate tab** is added.

## Gate checks

- `npm run lint` and `npm run typecheck` (or `tsc --noEmit`) pass with zero errors.
- No console errors in the browser during the flows above.
