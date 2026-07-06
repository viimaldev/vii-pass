<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan at
`specs/001-mern-cloudflare-setup/plan.md` (and its `research.md`, `data-model.md`,
`contracts/`, and `quickstart.md`).

Runtime note: the API deploys to Cloudflare Workers, so it uses Hono (Express-like,
Workers-native) rather than classic Express, and the official `mongodb` driver + Zod
rather than Mongoose. See `plan.md` / `research.md` for rationale.
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
- **React** — single-page front-end application.
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
