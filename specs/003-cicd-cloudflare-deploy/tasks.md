---
description: "Task list for Automated CI/CD Deployment to Cloudflare"
---

# Tasks: Automated CI/CD Deployment to Cloudflare

**Input**: Design documents from `specs/003-cicd-cloudflare-deploy/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Per Constitution Principle II, unit tests are NOT generated. Each user story ends
with a lightweight manual validation task (exercising the live pipeline), which is the only
meaningful way to verify a CI/CD workflow — no unit-test suites are created.

**Organization**: Tasks are grouped by user story so each story can be implemented and
validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files/systems, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 (Setup, Foundational, Polish carry no story label)
- Every task includes an exact file path or the exact command/console location to act on.

## Path Conventions

Repo-root monorepo (npm workspaces). CI/CD lives at the repo root under `.github/`; the
preview environment is a block in `backend/wrangler.toml`. No application source changes.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the baseline the automated gate depends on and the shared Cloudflare
credential. These block nothing story-specific but must exist before deploys can run.

- [x] T001 [P] Verify the local quality-gate baseline is green as the CI reference: from the
  repo root run `npm ci`, then `npm run typecheck`, `npm run lint`,
  `npm audit --omit=dev --audit-level=high`, and `npm run build --workspace @vii-pass/frontend`; confirm
  all pass on Node 20 LTS (the version the workflows will pin). No file changes — this proves
  the gate the pipeline automates already passes. (per [research.md](research.md) Decisions 6, 8)
- [ ] T002 [P] Create a Cloudflare API token with permission **Account › Workers Scripts ›
  Edit** and record the **Account ID**; keep both out of source control (they are added to
  GitHub Environments in T004/T011). (per [quickstart.md](quickstart.md) §A.3,
  [contracts/secrets-and-environments.md](contracts/secrets-and-environments.md) §2)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared build-and-verify gate that BOTH deploy workflows invoke. Neither
`deploy-production.yml` (US1) nor `deploy-preview.yml` (US2) can be authored or function
without it.

**⚠️ CRITICAL**: No user story work can be completed until this phase is done.

- [x] T003 Create the shared composite action `.github/actions/build-and-verify/action.yml`
  (`using: composite`) with input `node-version` (default `"20"`) and steps, in order, each
  with a clear `name:` so a failure shows which check failed: `actions/setup-node@v4`
  (`cache: npm`) → `npm ci` → `npm run typecheck` → `npm run lint` →
  `npm audit --omit=dev --audit-level=high` (blocking) → `npm run build --workspace @vii-pass/frontend`.
  No secrets referenced. (per [contracts/secrets-and-environments.md](contracts/secrets-and-environments.md) §1)

**Checkpoint**: The shared gate exists — production and preview workflows can now be built.

---

## Phase 3: User Story 1 - Automatic production deployment on main (Priority: P1) 🎯 MVP

**Goal**: A push/merge to `main` automatically builds, verifies, and publishes the
single-origin Worker `vii-pass-api` to production with zero manual steps.

**Independent Test**: Push a trivial valid change to `main` → the app updates in production
with no manual action; push a change that fails the gate → production is left unchanged.

- [ ] T004 [P] [US1] Create the GitHub Environment **`production`**: set the deployment branch
  rule to **`main` only**, and add the environment secrets `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` (values from T002). (per [contracts/secrets-and-environments.md](contracts/secrets-and-environments.md) §2, [quickstart.md](quickstart.md) §A.5)
- [ ] T005 [P] [US1] Set the production Worker application secret: from `backend/` run
  `npx wrangler secret put MONGODB_URI` and paste the **production** connection string (never
  committed; stays only on the `vii-pass-api` Worker). (per [quickstart.md](quickstart.md) §A.4,
  [research.md](research.md) Decision 3)
- [x] T006 [P] [US1] Create `.github/workflows/deploy-production.yml`: triggers `push` to
  `main` and `workflow_dispatch`; `permissions: contents: read, deployments: write`;
  `concurrency: { group: deploy-production, cancel-in-progress: false }`; a `deploy` job on
  `ubuntu-latest` bound to `environment: { name: production, url: <prod workers.dev URL> }`;
  steps: `actions/checkout@v4` → `uses: ./.github/actions/build-and-verify` → deploy step
  running `npx wrangler deploy` with `working-directory: backend` and env `CLOUDFLARE_API_TOKEN`
  / `CLOUDFLARE_ACCOUNT_ID` from secrets. (per [contracts/production-deploy.workflow.md](contracts/production-deploy.workflow.md))
- [ ] T007 [US1] Validate US1 (depends on T004–T006): merge the workflow to `main`, push a
  trivial valid change, and confirm the run auto-builds and deploys and the production URL
  serves it with no manual steps; then push a deliberate type error and confirm the gate blocks
  the deploy and production stays on the prior version. (per [spec.md](spec.md) US1 acceptance,
  [quickstart.md](quickstart.md) §D)

**Checkpoint**: Production auto-deploy works end to end — this is the deployable MVP.

---

## Phase 4: User Story 2 - On-demand preview deployment for a topic branch (Priority: P2)

**Goal**: A developer manually triggers a preview deploy of a topic branch to the isolated
`vii-pass-api-preview` Worker and gets a live preview URL; pushing a topic branch alone deploys
nothing; preview never touches production data.

**Independent Test**: Manually trigger the preview deploy on a topic branch → a live preview
URL serves that branch's build against the isolated preview DB; pushing the branch without
triggering deploys nothing.

- [ ] T008 [P] [US2] Provision an isolated **non-production** preview database (a separate
  free-tier Atlas cluster, or at minimum a `vii_pass_preview` database) and allow Cloudflare
  egress (Network Access `0.0.0.0/0`). Its connection string MUST differ from production.
  (per [quickstart.md](quickstart.md) §A.1, FR-008)
- [x] T009 [P] [US2] Add the `[env.preview]` block to `backend/wrangler.toml`:
  `name = "vii-pass-api-preview"`; redefine `[env.preview.assets]` (directory
  `../frontend/dist`, `not_found_handling` single-page-application, `run_worker_first`
  `["/api/*"]`) and `[env.preview.vars]` (`MONGODB_DB_NAME = "vii_pass_preview"`,
  `ALLOWED_ORIGINS`, `SESSION_IDLE_TTL_SECONDS`, `SESSION_ABSOLUTE_TTL_SECONDS`,
  `PBKDF2_ITERATIONS = "100000"`); verify with `npx wrangler deploy --env preview --dry-run`
  from `backend/`. (per [contracts/secrets-and-environments.md](contracts/secrets-and-environments.md) §3, [research.md](research.md) Decision 2)
- [ ] T010 [US2] Set the preview Worker application secret (depends on T008, T009): from
  `backend/` run `npx wrangler secret put MONGODB_URI --env preview` and paste the **preview**
  (non-production) connection string. (per [quickstart.md](quickstart.md) §A.4, FR-008)
- [ ] T011 [P] [US2] Create the GitHub Environment **`preview`** with environment secrets
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (optional required reviewers). (per
  [contracts/secrets-and-environments.md](contracts/secrets-and-environments.md) §2, [quickstart.md](quickstart.md) §A.5)
- [x] T012 [US2] Create `.github/workflows/deploy-preview.yml` (depends on T009): trigger
  `workflow_dispatch` **only**; first step fails fast if `github.ref_name == 'main'`;
  `permissions: contents: read, deployments: write`;
  `concurrency: { group: deploy-preview-${{ github.ref }}, cancel-in-progress: true }`; a
  `deploy-preview` job on `ubuntu-latest` bound to `environment: { name: preview, url: <preview
  workers.dev URL> }`; steps: main-guard → `actions/checkout@v4` →
  `uses: ./.github/actions/build-and-verify` → `npx wrangler deploy --env preview`
  (`working-directory: backend`, token/account env) → append the preview URL to
  `$GITHUB_STEP_SUMMARY`. (per [contracts/preview-deploy.workflow.md](contracts/preview-deploy.workflow.md))
- [ ] T013 [US2] Validate US2 (depends on T008–T012, and the workflow file present on `main`):
  push a topic branch and confirm nothing deploys; run **Deploy Preview** via `workflow_dispatch`
  on that branch and confirm a preview URL serves the branch's build and reads/writes only the
  `vii_pass_preview` data (never production); confirm dispatching on `main` is rejected. (per
  [spec.md](spec.md) US2 acceptance, [quickstart.md](quickstart.md) §D)

**Checkpoint**: Both production auto-deploy (US1) and manual preview (US2) work independently.

---

## Phase 5: User Story 3 - Build and quality gate with clear feedback (Priority: P3)

**Goal**: Every run reports a clear outcome; the shared gate (from T003) blocks any deploy on a
failed build/typecheck/lint/audit, and successful runs report the target and (for preview) the
URL. This story adds the production-side reporting and verifies the gate as a cross-cutting
guarantee across both workflows.

**Independent Test**: Introduce a deliberate type/lint error on a branch, run a workflow, and
confirm the deploy is blocked and the failing check is named; fix it and confirm success with a
clear reported outcome.

- [x] T014 [US3] Add production run reporting in `.github/workflows/deploy-production.yml`
  (depends on T006): append the deployment outcome (status + production URL) to
  `$GITHUB_STEP_SUMMARY` so every production run reports a clear, legible result alongside the
  native run status. (per [spec.md](spec.md) US3-#3, FR-009)
- [ ] T015 [US3] Validate the gate as a shared guarantee across both environments (depends on
  T007, T013): introduce a deliberate lint or type error on a branch, run each workflow, and
  confirm the deploy aborts before publish with the failing check clearly named and the live
  environment unchanged; then fix and confirm each run reports success. (per [spec.md](spec.md)
  US3 independent test, [quickstart.md](quickstart.md) §D)

**Checkpoint**: The quality gate and clear-feedback guarantees hold for production and preview.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and secret-hygiene assurance across the whole pipeline.

- [ ] T016 Run the full [quickstart.md](quickstart.md) §D acceptance checklist end to end
  (all six checks) and confirm the < 10-minute production release budget holds under normal
  conditions. (per [spec.md](spec.md) Success Criteria SC-001…SC-005, SC-007)
- [x] T017 [P] Confirm secret hygiene: search `.github/` and `backend/wrangler.toml` for any
  connection strings or tokens and confirm none are present, and confirm no run logs echo secret
  values. (per FR-007, SC-006)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T001 and T002 are independent.
- **Foundational (Phase 2)**: T003 depends on T001 passing (the gate must be green locally).
  **Blocks US1 and US2** (both workflows `uses:` this action).
- **User Stories (Phase 3–5)**: All depend on Foundational (T003).
  - US1 (P1) and US2 (P2) are independent of each other and can proceed in parallel.
  - US3 (P3) depends on the workflows from US1 (T006) and US2 (T012) existing, since it adds
    reporting to production and validates the gate across both.
- **Polish (Phase 6)**: Depends on US1 + US2 (+ US3 for full-signal validation).

### User Story Dependencies

- **US1 (P1)**: Needs only Foundational. Self-contained MVP.
- **US2 (P2)**: Needs only Foundational. Independent of US1 (separate Worker, separate secrets).
- **US3 (P3)**: Cross-cutting — builds on the workflow files from US1 and US2; adds no new
  environment.

### Within Each User Story

- Provisioning tasks (GitHub Environments, Cloudflare secrets, preview DB) and file-authoring
  tasks are independent and marked [P]; the story's **validation** task runs last.
- US2: T010 depends on T008 + T009; T012 depends on T009; T013 depends on T008–T012.

### Parallel Opportunities

- Setup: T001 and T002 in parallel.
- US1: T004, T005, T006 in parallel (GitHub env, Cloudflare secret, workflow file) → then T007.
- US2: T008, T009, T011 in parallel → T010 (after T008+T009) and T012 (after T009) → T013.
- With two developers: one takes US1, the other takes US2, immediately after T003.

---

## Parallel Example: User Story 1

```text
# After T003 (foundational gate) is done, launch US1's independent tasks together:
Task T004: Create GitHub Environment "production" (branch rule main; add CF token + account id)
Task T005: wrangler secret put MONGODB_URI on the production Worker (from backend/)
Task T006: Author .github/workflows/deploy-production.yml
# Then, once all three are complete:
Task T007: Validate — push to main auto-deploys; a failing gate blocks the deploy
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup (T001–T002).
2. Phase 2 Foundational (T003) — the shared gate.
3. Phase 3 US1 (T004–T007).
4. **STOP and VALIDATE**: pushing to `main` auto-deploys to production and a failing gate
   blocks it. This is a shippable increment on its own.

### Incremental Delivery

1. Setup + Foundational → shared gate ready.
2. US1 → automatic production releases (MVP).
3. US2 → manual, isolated preview environments for topic branches.
4. US3 → richer reporting + verified cross-cutting gate guarantee.
5. Polish → full acceptance sweep + secret-hygiene check.

### Parallel Team Strategy

After T003: Developer A implements US1 (T004–T007) while Developer B implements US2
(T008–T013). US3 (T014–T015) follows once both workflow files exist.

---

## Notes

- [P] = different files/systems, no dependency on an incomplete task.
- Provisioning tasks (Cloudflare secrets, GitHub Environments, preview DB) are maintainer
  actions done via CLI/console per [quickstart.md](quickstart.md); they are required for the
  workflows to function and are never committed to source.
- `workflow_dispatch` (preview) only appears in the Actions UI after the workflow files land on
  the default branch `main` (research Decision 9) — merge US1/US2 workflow files to `main` to
  exercise T013.
- No application source changes: this feature adds only `.github/` files and one
  `backend/wrangler.toml` block.
