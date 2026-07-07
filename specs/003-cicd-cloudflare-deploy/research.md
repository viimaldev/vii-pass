# Phase 0 Research: Automated CI/CD Deployment to Cloudflare

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-07-07

This document resolves every open decision needed to design the CI/CD pipeline. The feature
spec contained **no `[NEEDS CLARIFICATION]` markers**; the items below are the deliberate
technical choices (with rejected alternatives) that shape Phase 1.

---

## Decision 1 — CI/CD platform & workflow layout

**Decision**: Use **GitHub Actions** with two version-controlled workflow files plus one
shared **composite action**:

- `.github/workflows/deploy-production.yml` — trigger: `push` to `main` (+ `workflow_dispatch`
  for manual re-deploy/rollback of a chosen commit).
- `.github/workflows/deploy-preview.yml` — trigger: `workflow_dispatch` only (manual).
- `.github/actions/build-and-verify/action.yml` — composite step reused by both workflows:
  setup Node + npm cache, `npm ci`, typecheck, lint, dependency audit, build the SPA.

**Rationale**: The repo is on GitHub (spec assumption) and the user explicitly asked for
GitHub Actions. Two independent workflow files satisfy FR-014 (production and preview paths
evolve independently). A composite action keeps the shared quality gate DRY (FR-004/FR-005)
without coupling the two paths — cleaner than a `workflow_call` reusable workflow, which would
add cross-workflow indirection and a shared failure surface.

**Alternatives considered**:
- *Single workflow with `if:` branch conditions* — rejected: entangles the prod and preview
  paths, violating the FR-014 "evolve independently" intent and making concurrency/secrets
  harder to scope.
- *Reusable workflow via `workflow_call`* — rejected: more indirection than a composite action
  for what is a linear sequence of shell steps; composite action co-locates the gate cleanly.
- *Third-party CI (CircleCI, etc.)* — rejected: contradicts the spec assumption and adds an
  external dependency for no benefit.

---

## Decision 2 — Preview isolation: separate Worker via wrangler named environment

**Decision**: Deploy preview to a **separate Cloudflare Worker** named `vii-pass-api-preview`,
defined as a wrangler **named environment** (`[env.preview]`) in the existing
`backend/wrangler.toml`. Production keeps the top-level config (Worker `vii-pass-api`). Deploy
commands: production `npx wrangler deploy`; preview `npx wrangler deploy --env preview` (both
run from `backend/`).

**Rationale**: This is the decisive design choice, driven by **FR-008** (a preview deployment
must never read or write production data — mandatory because vii-pass stores password-vault
data) and **FR-014** (independent paths). A separate Worker gets its **own secret store**, so
`MONGODB_URI` on the preview Worker points at an isolated non-production database while the
production Worker's secret is untouched. It also yields a distinct preview URL
(`https://vii-pass-api-preview.<subdomain>.workers.dev`) for review (FR-009), and lets the two
environments diverge safely (FR-014).

**Alternatives considered**:
- *Cloudflare Versions / preview URLs (`wrangler versions upload`)* — **rejected as unsafe**:
  uploaded versions share the production Worker's bindings and **secrets**, so a preview
  version would connect to the **production** `MONGODB_URI`. That directly violates FR-008 for
  a password manager. Disqualifying.
- *Same Worker, swap DB via a runtime var* — rejected: the production secret would still be
  present on the same Worker; no hard isolation, easy to leak, violates FR-008.
- *A whole separate wrangler.toml for preview* — rejected: duplicates config and drifts; a
  named environment in one file is the idiomatic wrangler mechanism and keeps prod/preview
  visibly paired.

**Wrangler named-environment caveats (captured for Phase 1)**:
- `main`, `compatibility_date`, and `compatibility_flags` **are inherited** by named
  environments.
- `[vars]`, bindings, and `[assets]` are **not reliably inherited** — the `[env.preview]`
  block MUST **redefine** `[env.preview.vars]` and `[env.preview.assets]` explicitly to avoid a
  preview Worker with missing config. (Contract in
  [contracts/secrets-and-environments.md](contracts/secrets-and-environments.md).)
- The Worker name for a named env defaults to `<name>-<env>` = `vii-pass-api-preview`; it may
  be set explicitly with `[env.preview] name = "vii-pass-api-preview"` for clarity.
- Preview `[env.preview.vars]` sets `MONGODB_DB_NAME = "vii_pass_preview"` (isolated dataset)
  and keeps the same session TTLs and `PBKDF2_ITERATIONS = "100000"` (the Workers cap) as prod.

---

## Decision 3 — Deploy authentication & secret placement

**Decision**: Split secrets by *purpose and residence*:

| Secret | Where it lives | Used by |
|--------|----------------|---------|
| `CLOUDFLARE_API_TOKEN` | GitHub **environment** secret (per `production` / `preview` env) | CI, to authenticate `wrangler deploy` |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub environment secret (or repo var) | CI, to select the account deterministically |
| `MONGODB_URI` (production) | **Cloudflare Worker secret** on `vii-pass-api` (`wrangler secret put`) | The running Worker at request time |
| `MONGODB_URI` (preview) | **Cloudflare Worker secret** on `vii-pass-api-preview` (`wrangler secret put --env preview`) | The running preview Worker |

CI runs `wrangler deploy` authenticated only by the Cloudflare API token; it **never sees the
database URI**. The DB URIs are pre-provisioned once by a maintainer directly into each
Worker's secret store.

**Rationale**: Satisfies FR-007 (secrets never in workflow YAML/repo/logs) and FR-008
(separate per-environment DB secrets) with the **smallest attack surface** — the database
credential never enters GitHub Actions at all, so it cannot leak via a workflow, a log, or a
compromised action. This also matches the project's existing setup, where `MONGODB_URI` is
already a Cloudflare Worker secret.

**Refinement of a spec assumption (documented deviation)**: The spec's Assumptions say the DB
connection string is "stored as repository/environment secrets in the CI/CD platform." This
plan instead keeps it as a **Cloudflare Worker secret** (pre-provisioned), which is strictly
*more* secure and still satisfies FR-007/FR-008. No functional requirement changes. If a future
need requires CI to rotate the DB secret, the alternative below can be adopted.

**Alternatives considered**:
- *DB URI as a GitHub secret, pushed each deploy via `wrangler secret put` in CI* — rejected
  for the default: puts the production vault credential inside the CI runtime and risks log
  exposure; only needed if CI must own secret rotation (out of scope).
- *`account_id` hardcoded in `wrangler.toml`* — rejected: account id is low-sensitivity but is
  cleaner as a GitHub env value so the repo carries no account-specific data; keeps FR-013
  config generic.

---

## Decision 4 — GitHub Environments for authorization & environment mapping

**Decision**: Define two **GitHub Environments** — `production` and `preview` — and bind each
workflow job to the matching one via `environment:`. Scope the Cloudflare secrets to each
environment. Apply protection rules:

- `production`: **deployment branch rule = `main` only** (belt-and-suspenders with the
  `push: branches: [main]` trigger); optional required reviewers.
- `preview`: optional required reviewers; used by the manual preview workflow.

**Rationale**: GitHub Environments map 1:1 to the spec's **Environment** entity and provide the
authorization surface FR-011 needs (branch restrictions + optional approvals), plus the
deployment URL surfacing FR-009 benefits from. Environment-scoped secrets guarantee the preview
job cannot read production-scoped secrets and vice-versa (reinforces FR-008).

**Alternatives considered**:
- *Repo-level secrets only, no Environments* — rejected: loses branch/reviewer protections and
  the clean prod/preview secret partition; weaker FR-011 story.

---

## Decision 5 — Concurrency control (FR-012)

**Decision**: Use GitHub Actions `concurrency` groups per environment:

- Production: `group: deploy-production`, `cancel-in-progress: false` — **serialize**; never
  interrupt an in-flight production publish (avoids partial/mixed state), queue the next.
- Preview: `group: deploy-preview-${{ github.ref }}`, `cancel-in-progress: true` — per-branch;
  a newer manual preview for the same branch **supersedes** an older queued/running one.

**Rationale**: FR-012 requires overlapping deploys to one environment be serialized or
de-duplicated. Production favors *serialize without cancel* so an atomic publish is never cut
mid-flight (supports FR-010, edge case "partial failure mid-publish"). Preview favors
*cancel-in-progress* because only the latest preview of a branch is interesting and it saves CI
minutes (SC-007 spirit). Acceptance scenario US1-#3 ("latest supersedes / serialized") is met.

**Alternatives considered**:
- *`cancel-in-progress: true` for production* — rejected: could kill a publish partway,
  risking a mixed live state.
- *No concurrency control* — rejected: violates FR-012.

---

## Decision 6 — Quality gate contents & the dependency-scan addition

**Decision**: The shared gate (in the composite action), run **before** any deploy step, is:

1. `npm ci` (clean, lockfile-faithful install at repo root — installs all workspaces).
2. `npm run typecheck` (root script → `tsc --noEmit` across workspaces).
3. `npm run lint` (root script → `eslint .`).
4. `npm audit --omit=dev --audit-level=high` (vulnerability scan of the **shipped**
   dependencies only — **blocking**).
5. `npm run build --workspace @vii-pass/frontend` (produces `frontend/dist`).

If any step fails, the job stops and the deploy step never runs (FR-005, FR-010). No unit
tests are run (Constitution II).

**Rationale**: Steps 2–3 and 5 are exactly the spec's FR-004/FR-005 gate. Step 4 is added to
satisfy the **Constitution's Security quality gate** ("dependency vulnerability scanning runs
on each build; no known high/critical CVEs are shipped") — appropriate for a password manager.
The `--omit=dev` flag is the key: it audits exactly what is **deployed** (production runtime
deps — `hono`, `mongodb`, `zod`, `react`, `react-dom`, `react-router-dom`), which is precisely
what the constitution means by "shipped." Build-time dev tooling (e.g., Vite/esbuild) is not in
the deployed Worker, so a dev-server-only advisory does not — and should not — block a release.

**Verified during implementation (T001)**: a blanket `npm audit --audit-level=high` fails on
GHSA-67mh-4wv8-2f99, an esbuild/vite **dev-server** advisory (both are devDependencies; the fix
requires a Vite major bump). Running `npm audit --omit=dev --audit-level=high` reports **0
vulnerabilities** — confirming nothing high/critical is actually shipped. So `--omit=dev` both
passes today and still blocks a genuine high/critical in a production dependency.

**Triage path (if a future *shipped* dependency raises an unfixable high/critical advisory)**:
a maintainer records a time-boxed, justified exception per the Constitution governance
"deviations log" — e.g., a reviewed, commented allowlist — rather than silently lowering the
audit level. `--omit=dev` removes the common case (dev-tooling noise) so this path is reserved
for real shipped-code risk.

**Alternatives considered**:
- *Blanket `npm audit --audit-level=high` (all deps)* — rejected: fails on dev-tooling
  advisories that are never deployed, permanently blocking releases and misrepresenting
  "shipped" risk; would force an immediate allowlist file for a non-shipped issue.
- *Typecheck + lint only (literal FR-005)* — rejected: would ignore the Constitution's Security
  gate, which is authoritative and explicitly lists dependency scanning.
- *Non-blocking audit (report-only)* — rejected as the default: "no high/critical CVEs are
  shipped" implies blocking; scanning shipped deps and blocking is the faithful reading.

---

## Decision 7 — Wrangler invocation in CI (repo-pinned vs action)

**Decision**: Invoke **`npx wrangler deploy`** using the repo-pinned Wrangler (4.107, the
backend devDependency), run with `working-directory: backend`, authenticated by
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` environment variables.

**Rationale**: Using the pinned Wrangler guarantees CI deploys with the **same version** as
local development (no drift; the version that was validated during this project's debugging).
It also avoids a third-party action in the deploy step's trust boundary. Auth via env vars is
Wrangler's standard non-interactive mode.

**Alternatives considered**:
- *`cloudflare/wrangler-action@v3`* — viable and ergonomic, but pulls a floating Wrangler
  unless pinned and adds an action to the security-sensitive deploy step. Kept as a documented
  fallback, not the default.
- *Global `npm i -g wrangler`* — rejected: unpinned, slower, redundant with the devDependency.

---

## Decision 8 — Node version, dependency caching & runner

**Decision**: `ubuntu-latest` runner, **Node.js 20 LTS** via `actions/setup-node@v4` with
`cache: npm` keyed on `package-lock.json`. A single root `npm ci` installs all workspaces.

**Rationale**: Node 20 matches `@types/node` ^20 and satisfies Vite 5 / Wrangler 4 minimums.
npm caching plus a single install keep the run within the < 10-minute budget (SC-007). Pinning
the major Node version keeps CI reproducible (Constitution V, config-driven).

**Alternatives considered**:
- *Node 18* — acceptable but older; 20 is current LTS and already implied by devDeps.
- *Per-workspace installs* — rejected: slower and unnecessary for npm workspaces with a root
  lockfile.

---

## Decision 9 — Preview guardrail against `main` (edge case)

**Decision**: The preview workflow's first step **fails fast** if
`github.ref_name == 'main'`, with a clear message directing the user to the production
workflow. `workflow_dispatch` runs on the ref selected in the UI, so this cleanly prevents a
"preview on main" from ever building/publishing.

**Rationale**: Directly implements the spec edge case "Manual preview triggered on the main
branch" — disallow it predictably so production is never touched by a preview run (reinforces
FR-008/FR-011).

**Operational note (captured for quickstart)**: `workflow_dispatch` only appears in the GitHub
Actions UI once the workflow file exists on the **default branch** (`main`). Therefore both
workflow files must be merged to `main` before the manual preview trigger becomes available;
when dispatched, the run checks out and builds the **selected** topic branch.

---

## Decision 10 — Reporting outcomes & preview URL (FR-009)

**Decision**: Rely on the native GitHub Actions run status (pass/fail) for every run, bind jobs
to a GitHub Environment with its `url` for the deployments surface, and additionally write the
resolved **preview URL** to `$GITHUB_STEP_SUMMARY` in the preview workflow so it is one click
away from the run.

**Rationale**: Meets FR-009 (report outcome; report preview URL) and SC-005 using built-in,
no-secret mechanisms — no external notification service (which is out of scope). Failure causes
are visible in the failed step's logs (FR-005/US3).

**Alternatives considered**:
- *External chat/email notifications* — out of scope per spec; not implemented.
- *PR comments with the URL* — nice-to-have; deferred (preview is triggered on branches that
  may not have an open PR).

---

## Resolved unknowns summary

| Topic | Resolution |
|-------|-----------|
| CI platform | GitHub Actions, 2 workflows + 1 composite action (D1) |
| Preview isolation | Separate Worker `vii-pass-api-preview` via `[env.preview]` (D2) |
| DB secret residence | Cloudflare Worker secret per env, not in CI (D3) |
| Authorization | GitHub Environments `production`/`preview` + branch rule (D4) |
| Concurrency | Serialize prod (no cancel); supersede preview per branch (D5) |
| Gate contents | ci, typecheck, lint, `npm audit --omit=dev --audit-level=high`, build (D6) |
| Wrangler in CI | Repo-pinned `npx wrangler deploy [--env preview]` (D7) |
| Node & cache | Node 20 LTS, npm cache, single root `npm ci` (D8) |
| Preview-on-main | Fail-fast guard; `workflow_dispatch` needs files on `main` (D9) |
| Reporting | Native status + environment URL + step summary preview URL (D10) |

**No `[NEEDS CLARIFICATION]` remain.** Ready for Phase 1 design.
