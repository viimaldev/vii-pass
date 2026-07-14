<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan at
`specs/014-section-color-theming/plan.md` (and its `research.md`, `data-model.md`,
`contracts/`, and `quickstart.md`).

Runtime note: the API deploys to Cloudflare Workers, so it uses Hono (Express-like,
Workers-native) rather than classic Express, and the official `mongodb` driver + Zod
rather than Mongoose. Sessions are opaque, server-side records (only the SHA-256 of the
token is stored) carried in an HttpOnly cookie; passwords are hashed with PBKDF2 via Web
Crypto. See `plan.md` / `research.md` for rationale.

Auth identity note (feature 004): the login identifier is a **username** (ASCII
alphanumeric `^[A-Za-z0-9]+$`, 3–30 chars, unique case-insensitively, stored lowercased) —
**email is no longer part of the login identity**. `PublicUser` is `{ id, username,
displayName }`. The registration password policy is **3–10 characters** (a deliberate,
documented relaxation from the prior 12-char minimum — see plan Complexity Tracking /
research Decision 3). Session handling, PBKDF2 hashing, and cookies are unchanged.

UI/background note (feature 005): decorative page backgrounds are **CSS-only and
dependency-free**. Placeholder SVGs live in `frontend/public/backgrounds/` (served at stable
`/backgrounds/*` URLs, so final art swaps in by replacing a file — no code change). A single
reusable `.page-bg` class in `frontend/src/styles/tokens.css` reads CSS custom properties
(`--page-bg-image`, `--page-bg-fallback`); per-surface modifiers (`.page-bg--login`,
`.page-bg--home`) set them. On phones every surface **cover-crops its single desktop SVG**
(`background-size: cover`) — no separate mobile file. Backgrounds are
decorative — CSS backgrounds only, never in the a11y tree, never intercept focus/pointer.

Sections/chords note (feature 006): a per-user credential organizer. Two new MongoDB
collections (`sections`, `chords`) hold user-scoped documents (every query filtered by
`userId`; chords also carry `sectionId`). Ordering is an integer `position` per scope,
rewritten 0..n-1 on reorder (client sends the full ordered id list). The default **Mine**
section is lazily auto-provisioned on the first `GET /api/sections` for a user with zero
sections (`isDefault: true`, non-deletable). Session-protected routes live under
`/api/sections` and `/api/chords` (mirror the auth router/service/schema layering). Chord
fields are placeholders `field1/field2/field3` for now — real credential fields come later.
Frontend rebuilds the vault surface on `HomePage` with Bootstrap (CSS only) + native HTML5
drag-and-drop (no new deps) + keyboard move controls for a11y.

Chord fields note (feature 009): chords get their real credential shape — required
**title** (1–100 chars, unique per section case-insensitively via a stored
`titleNormalized` shadow field + compound unique index `{userId, sectionId,
titleNormalized}`, service pre-check → `409 chord_title_taken`), optional hidden **url**
(server-normalized: scheme-less input gets `https://`, only `http(s)` allowed —
`javascript:`/`data:` rejected; card title becomes `<a target="_blank" rel="noopener
noreferrer">`; copy-link button sits immediately before edit), and exactly three typed
**fields** rows `{ type: 'username'|'email'|'password'|'other'|'otherSensitive', value:
string|null }` (empty value = unused row, type still persisted for edit round-trip).
`password`/`otherSensitive` are masked on the card with eye+copy; others copy-only; copy
works without reveal; reveal state is local and always resets to masked. Type
icon/label/sensitivity metadata is centralized in
`frontend/src/components/chordFieldTypes.tsx` (inline Bootstrap-Icons SVGs — no new
deps). Routes/verbs unchanged from feature 006; only payloads changed. Placeholder-era
chords are **dropped, not migrated** (`db.chords.drop()` per environment).

Encryption note (feature 010): chord secrets are **end-to-end encrypted, two layers,
Web Crypto only (zero new deps)**. Level 1 (browser): a random 256-bit **vault key**
encrypts every `fields[].value` + `url` with AES-256-GCM → network carries only
`v1.l1.<iv>.<ct>` envelopes. The vault key is wrapped by a key derived from the login
password (PBKDF2 600k client-side + HKDF split into `authKey`/`wrapKey`) and lives in
AuthContext memory, with a NON-extractable `CryptoKey` copy persisted in IndexedDB
(`frontend/src/vault/keyStore.ts`) so a page refresh silently restores the unlocked
vault — no password re-prompt; both copies are cleared on logout/401. The locked-vault
unlock prompt remains only as a fallback (persisted key missing/unavailable).
The **password never leaves the browser**: login sends `authHash` (HKDF auth branch)
after fetching the per-user salt via the new public `GET /api/auth/salt/:username`
(deterministic decoy salt for unknown users — no enumeration); the server re-hashes
`authHash` through the existing PBKDF2 storage scheme (`lib/password.ts` unchanged).
Level 2 (Worker): before persisting, L1 envelopes are wrapped again with AES-256-GCM
under HKDF(`VAULT_ENC_KEY` secret, salt=userId) → DB stores `v1.l2.<keyId>.<iv>.<ct>`
(key-id enables rotation). Titles/field types stay plaintext (listing/uniqueness/icons).
URL scheme allow-list moved client-side (enforced pre-encrypt + at decrypt-render).
Routes/verbs unchanged from 006/009; register/login payloads changed
(`authHash`/`kdfSalt`/`vaultKeyWrapped`); `users` gains `kdfSalt`+`vaultKeyWrapped`.
Ship step: drop `users`, `sessions`, `chords` per environment (verifier semantics
changed — no migration). Forgotten password = vault unrecoverable (recovery deferred;
design must not preclude it — re-wrap-only password changes, FR-010).

Dual-username/roles note (feature 011): registration creates ONE account with TWO
usernames — admin (full capabilities) + normal (view/reveal/copy ONLY) — sharing a
single password, plus a security question (1 of 5 fixed in shared `SECURITY_QUESTIONS`,
stored as `securityQuestionId` 0–4) and answer for password reset. `UserDoc` is now an
account: `logins: [{username, role}]` with a UNIQUE MULTIKEY index on `logins.username`
(global uniqueness across roles/accounts); one `passwordHash`/`kdfSalt` per account (the
salt endpoint resolves either username). Sessions carry `role` fixed at sign-in; a new
`requireAdmin` middleware 403s (`role_forbidden`) every mutating sections/chords route
for normal-role sessions (GETs unchanged; UI OMITS — not disables — mutation controls
via `readOnly = user.role !== 'admin'`). Recovery = the SAME vault key wrapped a SECOND
time under an answer-derived key (`deriveRecoveryKeys`: PBKDF2 600k over the normalized
answer + `recoverySalt`, HKDF info `vii-pass/recovery-auth`/`recovery-wrap`) →
`vaultKeyWrappedRecovery` on users. Reset flow: POST `/api/auth/reset/question`
(always-200, deterministic decoy question+salt for non-admin/unknown names) → `verify`
(server checks `securityAnswerVerifier`; throttled via NEW `resetAttempts` collection
keyed by the TYPED name so unknown names throttle identically; issues one-time 10-min
reset token + the recovery blob) → `complete` (atomic replace of
passwordHash+kdfSalt+vaultKeyWrapped, burn token, revoke ALL account sessions).
Vault data survives reset (vault key unchanged — FR-011). No new deps, no new env vars
(decoys reuse `SALT_DECOY_PEPPER`). Ship: drop users/sessions/sections/chords per env.

User-menu note (feature 012): the account-menu panel is restyled (frontend-only —
only `frontend/src/components/UserMenu.tsx` + the `.user-menu__*` block in
`frontend/src/styles/tokens.css` change). Panel = identity header (circular initial
badge — never a photo — beside a big bold displayName over a smaller muted username,
divider below) then icon-led rows: "Change theme" (palette icon, a REAL focusable
`role="menuitem"` button with intentionally NO effect — placeholder until theming
ships) above "Log out" (box-arrow-right icon; logic unchanged — busy state, redirect
to `/login`). Icons are inline Bootstrap-Icons SVGs local to UserMenu.tsx (no new
deps; do NOT generalize `chordFieldTypes.tsx`). Trigger button, outside-click/Escape
close, ARIA menu semantics, and the 280px/viewport panel clamp are all preserved;
menu content is identical for admin and normal roles.

Theme note (feature 013): three theme modes — **Auto** (default; follows
`prefers-color-scheme` when declared, else local time 06:00-incl→light /
18:00-excl→dark), **Dark** (MEDIUM-gray palette, not near-black), **Light** —
selected via three `role="menuitemradio"` icon buttons (circle-half/moon-fill/
sun-fill, order Auto,Dark,Light) that REPLACE feature-012's inert "Change theme"
row in UserMenu. **Frontend-only, zero new deps, zero backend/API changes.**
Mechanism: `ThemeProvider` (`frontend/src/theme/ThemeContext.tsx`, mounted OUTSIDE
AuthProvider — themes signed-out pages too) sets `data-bs-theme="light|dark"` (the
RESOLVED value, never 'auto') + `color-scheme` on `<html>`; Bootstrap 5.3 re-themes
natively and one `[data-bs-theme='dark']` block in tokens.css re-points all
`--color-*`/`--bs-*` tokens (components must never hardcode colors). Persistence =
localStorage `vii-pass:theme` (`auto|dark|light`; absent/invalid→auto; NEVER cleared
on sign-out; storage-blocked → in-memory for the visit). A tiny inline `<head>`
script in `frontend/index.html` mirrors the resolution pre-paint (no flash of wrong
theme). Auto reacts live to matchMedia changes + a 60s timer for the time fallback;
explicit Dark/Light ignore the environment. Dark mode dims `.page-bg` art with a
gradient overlay (artwork files unchanged). Identical for admin/normal roles.

Section-color theming note (feature 014): chord cards inherit the selected section's
color — FRONTEND-ONLY, CSS-first, zero new deps. `ChordGrid` sets the existing
`--section-color` custom property inline on the `.chord-grid` container (from a new
`sectionColor` prop that HomePage derives via vault context `sections`+`selectedId`);
tokens.css derives header/body ramps with `color-mix(in srgb, …)` (same pattern as the
section tabs): header blends toward WHITE (25–45% color) in light theme / BLACK
(30–45%) in dark; body is a light tint (≤18%) / dark shade over #101214 (≤22%). Bands
are CONTRAST BANDS guaranteeing AA for any hex section color; header foreground is
theme-aware `--chord-header-fg` (dark text light theme, white dark theme — replaces the
hardcoded white header fg + white focus outline). Feature 013's flat dark header pin
(`[data-bs-theme='dark'] .chord-card__header{background:#1f2327}`) is SUPERSEDED —
remove it. Plus a unified BUTTON language app-wide: `font-weight: 400` on every button
(removes the two bolds: `.section-tab.is-selected` and `.user-menu__avatar`), variants
distinguished by design/size, buttons NEVER adopt `--section-color` (see
contracts/buttons-ui.md). Forced-colors/print guards mirror `.page-bg`. DEPENDS on
feature 013 (`data-bs-theme`) — merged into this branch.
ChordCard.tsx, backend/, shared/ untouched.

CI/CD note: deployment is automated via GitHub Actions — push to `main` auto-deploys the
single-origin Worker (`vii-pass-api`) to production; topic branches deploy on manual
`workflow_dispatch` to a separate isolated preview Worker (`vii-pass-api-preview`) whose
`MONGODB_URI` points at a non-production database. Secrets live in GitHub Environments
(`CLOUDFLARE_API_TOKEN`) and as Cloudflare Worker secrets (`MONGODB_URI`), never in YAML.
<!-- SPECKIT END -->

# vii-pass — Project Instructions

These instructions apply to all work in this repository and MUST be followed for every
user story, feature, and change — no additional prompting required. They complement the
project Constitution at `.specify/memory/constitution.md`.

## Project Overview

vii-pass is a **password protection / password manager** application. It lets users
securely store their passwords and retrieve them from anywhere in the world. Security,
correctness, and a consistent user experience are the top priorities.

## Architecture — MERN + TypeScript

- **MongoDB** — persistence for user accounts and the encrypted password vault.
- **Express.js (Node.js)** — REST API / back-end.
- **React** — single-page front-end application, styled with **Bootstrap** for a
  responsive, mobile-first UI.
- **TypeScript everywhere** — both front-end and back-end are written in TypeScript.

Typical layout (adjust to the current plan):

```text
backend/          # Express + Node API (TypeScript)
  src/
    models/       # Mongoose models & schemas
    routes/       # Express routes
    services/     # Business logic
    middleware/   # Auth, validation, error handling
frontend/         # React app (TypeScript)
  src/
    components/
    pages/
    services/     # API clients
    types/        # Shared front-end types
```

## Coding Standards (apply to every user story)

### TypeScript & Types

- Use **strict, explicit typing** throughout. Avoid `any`; if it is truly unavoidable,
  isolate it and justify it with a short comment.
- Define `interface`/`type` declarations for API request & response payloads, database
  models, React component props, and service return values.
- Keep `strict` mode enabled in `tsconfig.json`. Do not disable type checks to silence
  errors — fix the underlying type instead.
- Prefer shared, reusable types over duplicating the same shape across front-end and
  back-end.

### Linting & Formatting

- Follow the configured **ESLint** rules. All code MUST be lint-clean before it is
  considered done; do not leave or merge code with lint errors.
- Use a consistent formatter (e.g., Prettier) and keep formatting uniform across the
  codebase. Do not hand-format in ways that fight the linter/formatter.
- Do not blanket-disable ESLint rules. If a rule must be suppressed, scope it narrowly
  and add a brief justification comment.

### Comments & Documentation

- Add **clear, meaningful comments** in generated code. Explain the intent and the "why",
  not the obvious "what".
- Use JSDoc/TSDoc for exported functions, services, and non-trivial logic (parameters,
  return values, and thrown errors).
- Keep comments accurate and update them whenever the related code changes.

### Responsive & Mobile-First UI

- Every user-facing surface MUST be **responsive** and **mobile-first**: it MUST render
  and function correctly across screen sizes, from small mobile phones (~320px wide)
  through tablets and desktops. Mobile support is a first-class requirement, not an
  afterthought.
- Use **Bootstrap** (its responsive grid, breakpoints, and utility classes) as the
  layout/responsiveness framework. Prefer Bootstrap's grid and utilities over bespoke
  media queries; when custom CSS is unavoidable, integrate it with the existing design
  tokens (`frontend/src/styles/tokens.css`) instead of adding one-off styles.
- Build for touch: adequately sized tap targets, no hover-only interactions, and
  forms/menus that stay usable on narrow viewports.
- **Every user story that adds or changes UI MUST include responsive/mobile coverage** —
  verify the layout at mobile, tablet, and desktop widths as part of that story's
  implementation, not as a later change.

### Testing

- **Do NOT create unit tests for this project.** Do not spend effort building or
  maintaining unit-test suites.
- You MAY add a very small number of lightweight integration/end-to-end checks ONLY for
  critical security flows (authentication, vault encryption/decryption) when they add
  clear value — this is optional and never a blocker.

### Security (this is a password application)

- **Never** store plaintext passwords. Hash account credentials with a strong algorithm
  (e.g., bcrypt/argon2) and encrypt stored vault data.
- Keep all secrets (DB URIs, JWT secrets, encryption keys) in environment variables —
  never hardcode or commit them.
- Validate and sanitize all input at the API boundary; use parameterized/ODM queries to
  avoid injection.
- Enforce authentication/authorization on every protected route, and return actionable,
  non-leaky error messages.
