# Phase 0 Research: MERN Web Application Foundation on Cloudflare

**Feature**: [spec.md](./spec.md) | **Branch**: `topic/vii-1000-mern-cloudflare-setup` | **Date**: 2026-07-06

This document resolves the technical unknowns and records the key architecture decisions
for building a MERN-style web application that deploys onto the requester-mandated
Cloudflare topology:

```text
React (Vite) → Cloudflare Pages → API Layer (Cloudflare Workers) → MongoDB Atlas → Cloudflare R2
```

Two of these decisions deliberately diverge from the general wording in
`.github/copilot-instructions.md` (which mentions "Express.js" and "Mongoose"). The hard
deployment constraint — **Cloudflare Workers** — takes precedence, and the divergences are
called out explicitly below (Decisions 1 and 3). The Project Constitution mandates neither
Express nor Mongoose, so these choices do not violate governance.

---

## Decision 1 — API framework: Hono (Workers-native), not classic Express

- **Decision**: Implement the API layer with **Hono** running on Cloudflare Workers,
  written in TypeScript. Hono provides an Express-like routing and middleware model
  (`app.get`, `app.post`, `app.use`) but targets the Workers V8-isolate runtime natively.
- **Rationale**:
  - Cloudflare Workers run on a V8-isolate runtime, **not** Node.js. Classic Express
    depends on Node's `http` server and a long-lived process model, so it does not run on
    Workers without heavy, fragile compatibility shims.
  - Hono is TypeScript-first, has first-class typing for Workers **Bindings** (e.g.
    `c.env.BUCKET` for R2, secrets), tiny cold-start footprint, and built-in middleware
    (CORS, logger, error handling), which directly supports the constitution's performance
    and UX-consistency principles.
  - Hono can also run under Node for local tooling, preserving a Node-based developer
    experience where useful.
- **Alternatives considered**:
  - **Express on Node (traditional server / container)**: Rejected — contradicts the
    mandated Cloudflare Workers deployment target; would require a separate always-on
    host and abandons edge distribution (SC-005).
  - **Express via `nodejs_compat` shims on Workers**: Rejected — brittle, poor cold-start,
    not an officially supported path.
  - **Raw Workers `fetch` handler with manual routing**: Rejected — re-implements routing,
    validation wiring, and error handling that Hono already provides cleanly.
- **Deviation note**: `copilot-instructions.md` says "Express.js (Node.js)". We honor the
  *intent* (a minimal, Express-style Node/TypeScript API) with Hono, the idiomatic
  Express-like choice for the mandated Workers runtime.

---

## Decision 2 — Database connectivity: official `mongodb` driver on Workers with `nodejs_compat`

- **Decision**: Connect to **MongoDB Atlas** from the Worker using the **official
  `mongodb` Node.js driver** (v6.7+), enabling the `nodejs_compat` compatibility flag in
  `wrangler.toml`. Cache the `MongoClient` at module scope so it is reused across
  invocations within the same isolate.
- **Rationale**:
  - Cloudflare's own "Connect to databases" guide explicitly lists **MongoDB Atlas** as a
    supported serverless database from Workers.
  - Recent driver versions support the Workers runtime via Cloudflare's TCP `connect()`
    socket API under `nodejs_compat`, so standard driver code (`client.db().collection()`)
    works at the edge.
  - Module-scoped client reuse avoids paying the TCP + TLS handshake on every request,
    protecting the p95 < 200ms budget (SC-002).
- **Operational notes**:
  - The Atlas connection string is stored as a Wrangler **secret** (`MONGODB_URI`), never
    in source (FR-008, SC-007).
  - Atlas network access must permit Cloudflare egress (broad allowlist for the edge, or
    per-environment configuration); documented in `quickstart.md`.
- **Alternatives considered**:
  - **Atlas Data API (HTTP)**: Rejected — deprecated and sunset (Sept 2025); not a viable
    long-term integration in 2026.
  - **Hyperdrive**: Rejected — Hyperdrive targets PostgreSQL/MySQL, not MongoDB.
  - **A self-hosted HTTP proxy in front of Mongo**: Rejected — adds an extra hop, latency,
    and an operational component with no offsetting benefit (violates YAGNI).

---

## Decision 3 — Data access layer: native driver + Zod validation, not Mongoose

- **Decision**: Use the native `mongodb` driver directly for data access, with **Zod**
  schemas for runtime validation at the API boundary and TypeScript type inference. No
  Mongoose ODM.
- **Rationale**:
  - Mongoose is heavier, assumes a long-lived Node process, and has a history of friction
    on the Workers edge runtime; the native driver is lighter and reliably supported.
  - Zod validates and sanitizes all input at the boundary (FR-009), returns actionable
    errors (FR-010), and infers TypeScript types so request/response/model shapes stay in
    one source of truth (constitution: explicit typing, single responsibility).
- **Alternatives considered**:
  - **Mongoose**: Rejected for the Workers runtime for the reasons above; noted as the
    heavier alternative.
  - **No validation library (hand-written guards)**: Rejected — more error-prone and
    duplicative than schema-driven validation.
- **Deviation note**: `copilot-instructions.md` mentions "Mongoose models & schemas". We
  keep the *concept* — typed models and schema validation — via the native driver + Zod,
  which is the reliable Workers-native equivalent.

---

## Decision 4 — File & image storage: Cloudflare R2 via Workers binding

- **Decision**: Store files/images in a **Cloudflare R2** bucket accessed through a Worker
  **binding** (`env.BUCKET`), using `put`, `get`, `head`, `delete`, and `list`. Uploads go
  through an API route that validates content type and size before writing; retrieval
  streams the object body back through the Worker.
- **Rationale**:
  - The in-Worker R2 API is the idiomatic, lowest-latency path and needs no separate S3
    credentials in code — the binding is injected at runtime.
  - Strong read-after-write consistency simplifies the upload→retrieve flow (User Story 3).
  - Enforcing allowed types and a max size at the boundary satisfies FR-013 and the
    interrupted/oversized-upload edge cases.
- **Alternatives considered**:
  - **R2 via S3-compatible API with access keys**: Rejected for in-Worker use — needs
    managed secrets and adds signing overhead; bindings are simpler and safer. (S3 API
    remains available for external/out-of-Worker tooling if ever needed.)
  - **Storing binaries in MongoDB / GridFS**: Rejected — bloats the database, worse for
    large objects, and violates the separation-of-concerns requirement (FR-006, FR-015).

---

## Decision 5 — Frontend: React + Vite (TypeScript) on Cloudflare Pages

- **Decision**: Build the SPA with **React + Vite** in TypeScript and deploy the static
  build to **Cloudflare Pages**. The API base URL is injected at build time via a
  `VITE_API_BASE_URL` environment variable.
- **Rationale**:
  - Vite is the standard, fast React build tool and outputs static assets ideal for Pages'
    global CDN, directly serving SC-001 (interactive < 2s) and SC-005 (global reach).
  - Environment-driven API URL keeps the frontend free of hardcoded hosts (constitution:
    environment-driven config) and allows dev/prod parity.
- **Alternatives considered**:
  - **Create React App**: Rejected — effectively deprecated, slower, larger output.
  - **Next.js**: Rejected — SSR/server runtime is unnecessary for this SPA foundation and
    adds complexity (YAGNI); can be revisited if server rendering is ever required.

---

## Decision 6 — Frontend↔API integration & CORS

- **Decision**: Deploy the API as a standalone Worker (its own route/custom domain) and
  have the Pages SPA call it via `VITE_API_BASE_URL`. The Worker applies Hono's CORS
  middleware, allowing only the known Pages origin(s) per environment.
- **Rationale**:
  - Keeps the four layers (Pages, Workers, Atlas, R2) cleanly separated and independently
    deployable/scalable (FR-015, constitution Principle V), matching the requester diagram.
  - Origin-restricted CORS avoids over-permissive access while enabling the browser SPA.
- **Alternatives considered**:
  - **Single Pages project with Pages Functions for the API**: Viable and simpler to host,
    but couples API and frontend deploys and blurs the layer boundary the requester drew.
    Recorded as a fallback if unified hosting is later preferred.

---

## Decision 7 — Configuration & secrets management

- **Decision**: All secrets/config come from the environment: **Wrangler secrets**
  (`MONGODB_URI`, plus any keys) and `wrangler.toml` bindings for the API; **Pages
  environment variables** (`VITE_API_BASE_URL`) for the frontend. Local development uses
  `.dev.vars` (API) and `.env.local` (frontend), both git-ignored. No secrets in source.
- **Rationale**: Satisfies FR-008 and SC-007 (zero secrets in the repo, verifiable by
  scan) and the constitution's environment-driven configuration principle.
- **Alternatives considered**:
  - **Committed config files / `.env` in repo**: Rejected — leaks secrets, fails SC-007.

---

## Decision 8 — Health/status signal

- **Decision**: Expose `GET /api/health` that reports reachability of the API, MongoDB
  (lightweight `ping`), and R2 (cheap `head`/`list` probe), returning per-component status.
- **Rationale**: Directly implements FR-011 and gives a single, testable end-to-end signal
  proving all four layers are wired (User Story 1 Independent Test).

---

## Decision 9 — Verification approach (per Constitution Principle II)

- **Decision**: **No unit-test suites.** Rely on TypeScript strict mode, ESLint/Prettier,
  and manual verification of the end-to-end slice. Optionally add a *very small* number of
  integration checks with **Vitest + `@cloudflare/vitest-pool-workers`** only if a critical
  flow later warrants it (none mandatory for this foundation, which has no auth yet).
- **Rationale**: Matches the constitution (unit tests not required; concentrate limited
  effort on critical security flows) and the project instructions (do NOT create unit
  tests). Optimizes for delivery speed.
- **Alternatives considered**:
  - **Full unit-test coverage**: Rejected — explicitly out of scope per constitution and
    project instructions.

---

## Decision 10 — Tooling, linting, and quality gates

- **Decision**: TypeScript (strict) across frontend and backend; ESLint + Prettier shared
  config; Wrangler for Worker dev/deploy; a repository-root scan (e.g. secret-scanning in
  CI) to enforce SC-007; automated accessibility check (e.g. axe) on primary flows for
  SC-010 / WCAG 2.1 AA (FR-016).
- **Rationale**: Enforces the constitution's Code Quality, Accessibility, and Security
  gates without introducing unit tests.

---

## Resolved unknowns summary

| Question | Resolution |
|----------|------------|
| Can Express run on Workers? | No; use **Hono** (Express-like, Workers-native). |
| How to reach MongoDB Atlas from Workers? | Official **`mongodb` driver + `nodejs_compat`**, cached client. |
| ODM choice? | **Native driver + Zod**, not Mongoose (Workers reliability). |
| File storage? | **Cloudflare R2** via Worker binding. |
| Frontend host/build? | **React + Vite → Cloudflare Pages**. |
| Secrets? | **Wrangler secrets / Pages env vars**; none in source. |
| Testing? | **No unit tests**; optional tiny integration checks only. |

All `NEEDS CLARIFICATION` items from the Technical Context are resolved. Ready for Phase 1.
