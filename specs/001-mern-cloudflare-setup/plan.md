# Implementation Plan: MERN Web Application Foundation on Cloudflare

**Branch**: `topic/vii-1000-mern-cloudflare-setup` | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-mern-cloudflare-setup/spec.md`

## Summary

Deliver the deployable foundation for vii-pass: a React (Vite) SPA hosted on Cloudflare
Pages, a TypeScript API layer running on Cloudflare Workers, structured persistence in
MongoDB Atlas, and file/image storage in Cloudflare R2 — plus a minimal end-to-end vertical
slice (health, structured records, file upload/retrieve) that proves every layer is wired.

The technical approach (see [research.md](./research.md)) adapts the MERN stack to the
mandated Cloudflare Workers runtime: the API uses **Hono** (an Express-like, Workers-native
TypeScript framework) instead of classic Express, and data access uses the **official
`mongodb` driver + Zod** instead of Mongoose, because Workers run on V8 isolates rather than
Node.js. These two deviations from the general wording in `copilot-instructions.md` are
required by the hard deployment constraint and are documented in research (Decisions 1 & 3);
the Constitution mandates neither Express nor Mongoose, so governance is unaffected.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) across frontend and backend; Node.js 20 LTS
for tooling/local dev. API executes on the Cloudflare Workers V8-isolate runtime.

**Primary Dependencies**: Frontend — React 18+, Vite 5+, React Router. Backend — Hono,
official `mongodb` driver (v6.7+), Zod. Platform — Wrangler, Cloudflare R2 binding.

**Storage**: MongoDB Atlas (structured data); Cloudflare R2 (files/images).

**Testing**: No unit-test suites (per Constitution Principle II and project instructions).
TypeScript strict + ESLint/Prettier + manual verification of the slice; optional, minimal
Vitest + `@cloudflare/vitest-pool-workers` integration checks only if a critical flow later
warrants it (none mandatory for this foundation, which has no auth yet).

**Target Platform**: Cloudflare Pages (frontend), Cloudflare Workers (API); modern evergreen
browsers, responsive for mobile browsers.

**Project Type**: Web application (frontend + backend + shared types).

**Performance Goals**: API p95 < 200ms (SC-002); primary page interactive < 2s (SC-001);
sustain ≥ 1,000 concurrent users within budget (SC-008); comparable responsiveness from ≥ 3
global regions (SC-005).

**Constraints**: Stateless request handling on Workers (horizontal scale, FR-014);
environment-driven secrets with zero secrets in source (FR-008, SC-007); WCAG 2.1 AA on
user-facing surfaces (FR-016, SC-010); enforced upload type/size limits (FR-013); actionable,
non-leaky errors (FR-010); layer separation so each deploys/scales independently (FR-015).

**Scale/Scope**: Foundation + vertical slice — a small set of endpoints (health, records
create/list/get, file upload/get) and a handful of SPA screens; globally edge-distributed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.1.0.

| Principle | Gate | Status | How the plan complies |
|-----------|------|--------|-----------------------|
| I. Code Quality | Lint/format clean; single responsibility; docs on exports | PASS | ESLint + Prettier shared config; TypeScript strict; modular `routes`/`services`/`middleware`/`lib`; TSDoc on exported functions. |
| II. Testing Standards | No unit-test requirement; no coverage gate; effort on critical security flows only | PASS | No unit suites. TS strict + manual slice verification; optional tiny Workers integration checks only if warranted (no auth in this feature). |
| III. UX Consistency | Shared design system; WCAG 2.1 AA; actionable, non-leaky errors | PASS | Single token-based design system + accessible components; centralized error middleware maps to friendly messages (FR-010); a11y check for SC-010. |
| IV. Performance | Per-feature budgets defined and validated | PASS | Budgets set: API p95 < 200ms, interactive < 2s, 1k concurrent (SC-001/002/008); edge distribution + cached Mongo client protect latency. |
| V. Scalability & Maintainability | Modular, stateless, env-driven config, YAGNI | PASS | Stateless Workers (FR-014); env-driven secrets, none in source (FR-008/SC-007); layers separated (FR-015); minimal scope, no premature abstraction. |

**Additional gates** (Quality Gates & Standards): static analysis zero-errors, dependency
vulnerability scanning, secret-scanning (enforces SC-007), and automated a11y checks are all
planned in CI. **Result: PASS — no violations; Complexity Tracking left empty.**

**Post-Design re-check (after Phase 1)**: The data model, API contract, and quickstart
introduce no new projects, no additional persistence engines, and no cross-cutting
abstractions beyond the two justified framework choices (Hono, native driver + Zod) already
recorded in research. **Re-check result: PASS — still no violations.**

## Project Structure

### Documentation (this feature)

```text
specs/001-mern-cloudflare-setup/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml
├── checklists/
│   └── requirements.md  # /speckit.specify quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/                 # Hono API → Cloudflare Workers (TypeScript)
├── src/
│   ├── index.ts         # Worker entry: builds Hono app, exports { fetch }
│   ├── routes/          # health.ts, records.ts, files.ts
│   ├── services/        # records.service.ts, files.service.ts, health.service.ts
│   ├── middleware/      # error.ts, cors.ts, validate.ts
│   ├── lib/             # mongo.ts (module-scoped cached client), r2.ts
│   └── schemas/         # Zod schemas (source of truth for types)
├── wrangler.toml        # bindings + vars (NO secrets); nodejs_compat flag
├── package.json
└── tsconfig.json

frontend/                # React + Vite → Cloudflare Pages (TypeScript)
├── src/
│   ├── components/      # shared, accessible design-system components
│   ├── pages/           # screens
│   ├── services/        # API client (uses VITE_API_BASE_URL)
│   ├── types/           # re-exports from shared/
│   └── styles/          # design tokens
├── index.html
├── vite.config.ts
├── package.json
└── tsconfig.json

shared/                  # Types shared across frontend & backend
└── types/
```

**Structure Decision**: Web-application structure (frontend + backend + shared). `backend/`
is a Cloudflare Workers project (Hono) rather than a Node/Express server, and `frontend/` is
a Vite SPA deployed to Cloudflare Pages. A `shared/` package holds the TypeScript types used
by both sides (single source of truth, per Code Quality). This aligns with the layout in
`copilot-instructions.md` while adapting the runtime to the mandated Cloudflare topology.

## Complexity Tracking

> No Constitution violations. The two framework choices that diverge from the general
> `copilot-instructions.md` wording (Hono instead of Express; native `mongodb` driver + Zod
> instead of Mongoose) are mandated by the Cloudflare Workers runtime, are not prohibited by
> the Constitution, and are justified in [research.md](./research.md) (Decisions 1 & 3).
> No table entries required.
