# Implementation Plan: Automated CI/CD Deployment to Cloudflare

**Branch**: `topic/vii-1002-cicd-cloudflare-deploy` | **Date**: 2026-07-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-cicd-cloudflare-deploy/spec.md`

## Summary

Automate build-and-deploy for vii-pass using version-controlled GitHub Actions workflows
that publish to Cloudflare Workers. A push to `main` automatically builds, verifies, and
deploys the single-origin Worker (React SPA + Hono API) to **production**. Topic branches
are deployed to an isolated **preview** environment only on an explicit manual trigger.
Because vii-pass is a password manager, production and preview are strictly separated: the
preview path deploys to a **separate Worker** (`vii-pass-api-preview`) whose database
connection string is a distinct, pre-provisioned Cloudflare Worker secret pointing at a
non-production database — so a preview run can never read or write the production vault. The
shared quality gate (typecheck + lint + dependency scan + build) runs before any publish and
aborts the deploy on failure, leaving the live environment unchanged.

## Technical Context

**Language/Version**: TypeScript 5.5 across all workspaces; CI runner uses Node.js 22 LTS
(required by Wrangler 4.107, which refuses to run on < v22.0.0; compatible with `@types/node`
^20 and Vite 5).

**Primary Dependencies**: GitHub Actions (CI/CD platform); Wrangler 4.107 (repo-pinned
backend devDependency, invoked via `npx` in CI for version parity with local); Vite 5 (SPA
build); Hono 4 on Cloudflare Workers (`nodejs_compat`); official `mongodb` driver 6 + Zod.
No new runtime dependencies are added by this feature.

**Storage**: N/A for the pipeline itself (CI/CD is stateless process orchestration).
Application data remains MongoDB Atlas — **production** uses the existing `vii_pass`
database; **preview** MUST use an isolated non-production database (separate database, and
preferably a separate free-tier cluster) reached via a preview-only `MONGODB_URI` secret.

**Testing**: No unit tests (per Constitution II and project instructions). The pipeline's
verification is: `tsc --noEmit` typecheck (all workspaces), ESLint, dependency vulnerability
scan (`npm audit --omit=dev --audit-level=high`, per Constitution Security gate — scans shipped
deps only), and a successful SPA production build. No coverage gate.

**Target Platform**: Cloudflare Workers (edge). One Worker per environment:
`vii-pass-api` (production) and `vii-pass-api-preview` (preview), each serving the SPA via
its `[assets]` block and the API via `run_worker_first = ["/api/*"]`.

**Project Type**: Web application (npm workspaces monorepo: `shared`, `frontend`, `backend`)
delivered as a single-origin Worker. This feature adds a CI/CD layer (repo-root `.github/`)
and one wrangler named environment; it does not change application code.

**Performance Goals**: End-to-end production release (push to `main` → live) completes in
under 10 minutes under normal conditions (SC-007). npm dependency caching keeps runs fast.

**Constraints**:
- Secrets MUST never appear in workflow YAML, the repository, logs, or build artifacts
  (FR-007, SC-006). Deploy auth is via the `CLOUDFLARE_API_TOKEN` GitHub environment secret;
  the database URI is a pre-provisioned **Cloudflare Worker** secret, never entering CI.
- Production auto-deploy is restricted to `main`; preview is manual (`workflow_dispatch`)
  and restricted to non-`main` refs (FR-003, FR-011). Preview MUST NOT touch production data
  (FR-008).
- Concurrent deploys to one environment MUST be serialized/de-duplicated (FR-012).
- PBKDF2 stays at 100000 iterations (Workers Web Crypto hard cap) — unchanged by this feature.

**Scale/Scope**: Two workflow files + one shared composite action + one wrangler
`[env.preview]` block. Two long-lived environments (production, preview). Single-maintainer
to small-team release cadence.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| **I. Code Quality** | Pipeline definitions are version-controlled (FR-013) and reviewed like code. The gate blocks deploys of lint- or type-unclean code. The shared build+verify logic is a single-responsibility composite action; the two workflows stay small and declarative. | PASS |
| **II. Testing Standards** | No unit tests added or required. The gate runs the project's existing checks (typecheck + lint) plus the Constitution-mandated dependency scan; no coverage gate. Matches amended Principle II. | PASS |
| **III. UX Consistency** | No end-user surface changes. The relevant experience is developer feedback: every run reports clear success/failure and a preview URL (FR-009) — actionable, non-leaky messages. | PASS (N/A to end-user UI) |
| **IV. Performance** | Explicit, measurable budget: prod release < 10 min (SC-007), enforced via dependency caching and single-job deploys. | PASS |
| **V. Scalability & Maintainability** | Config is environment-driven with zero hardcoded secrets (FR-007); production and preview paths evolve independently (FR-014) yet share the gate via a composite action (DRY, loose coupling). YAGNI honored — teardown/rollback-mechanism/blue-green are explicitly out of scope. | PASS |

**Security quality gate (Constitution "Quality Gates & Standards")**: The constitution
requires dependency vulnerability scanning on each build with no high/critical CVEs shipped.
The spec's FR-005 names typecheck + lint as the *code* checks; this plan additionally
includes a blocking `npm audit --omit=dev --audit-level=high` step (scanning shipped deps only)
to satisfy the constitution's
Security gate (justified: vii-pass is a password manager). A documented triage/allowlist path
is defined in research.md so an unpatchable transitive advisory does not permanently block
releases.

**Result**: All gates PASS. No violations — Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)

```text
specs/003-cicd-cloudflare-deploy/
├── plan.md              # This file (/speckit.plan output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output — decisions & rationale
├── data-model.md        # Phase 1 output — Deployment/Environment/Secret model
├── quickstart.md        # Phase 1 output — one-time setup + how to release/preview
├── contracts/           # Phase 1 output — workflow & secret/environment contracts
│   ├── production-deploy.workflow.md
│   ├── preview-deploy.workflow.md
│   └── secrets-and-environments.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (all passing)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

This feature adds a CI/CD layer and one wrangler environment. No application source changes.

```text
.github/
├── actions/
│   └── build-and-verify/
│       └── action.yml          # NEW: composite — setup-node(+npm cache), npm ci,
│                               #      typecheck, lint, audit, build SPA
└── workflows/
    ├── deploy-production.yml    # NEW: on push to main (+ manual) → verify → deploy prod
    └── deploy-preview.yml       # NEW: on workflow_dispatch (non-main) → verify → deploy preview

backend/
├── wrangler.toml               # MODIFIED: add [env.preview] (separate Worker + vars + assets)
└── src/                        # UNCHANGED (application code untouched)

frontend/                        # UNCHANGED (build output frontend/dist consumed by Worker assets)
shared/                          # UNCHANGED
```

**Structure Decision**: Web-application monorepo (established). The pipeline lives at the repo
root under `.github/` (workflows + one composite action) so it can build all three workspaces
with a single root `npm ci`. Deployment uses the existing single-origin Worker model: the
composite action produces `frontend/dist`, and `wrangler deploy` (run from `backend/`, where
`wrangler.toml` references `../frontend/dist`) publishes SPA + API as one unit. Production and
preview are two wrangler environments in the one `backend/wrangler.toml`, producing two
independently-secret'd Workers.

## Complexity Tracking

> No Constitution violations. Section intentionally empty.
