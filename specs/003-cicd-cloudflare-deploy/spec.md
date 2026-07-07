# Feature Specification: Automated CI/CD Deployment to Cloudflare

**Feature Branch**: `003-cicd-cloudflare-deploy` (git: `topic/vii-1002-cicd-cloudflare-deploy`, story `vii:1002`)

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "I want to create github actions that will build the application and deploy the application in the cloudflare as described in this chat. I want to automate this build and deploy workflow. For the main branch, if any code pushed, it should be deployed in production automatically. If it is topic branch, it should be build and deploy in preview env by manual actions."

## Overview

Today, deploying vii-pass is a manual, local-machine chore: a developer must build the
frontend, authenticate to Cloudflare, and run the deploy command by hand. This is
error-prone, hard to reproduce, and ties releases to one person's machine and credentials.

This feature introduces an automated continuous-integration and continuous-deployment
(CI/CD) pipeline hosted in the project's source-control platform. Every change merged to the
**main** branch is built, validated, and published to the **production** environment
automatically — no human steps. For work-in-progress on **topic** branches, a developer can
**manually** trigger a build that publishes to an isolated **preview** environment, so
changes can be reviewed on a live URL before they reach production. Because vii-pass is a
password manager, the pipeline treats production and preview as strictly separated: preview
deployments never use production data or production secrets, and all credentials come from
secure secret storage rather than the workflow definition.

The result is repeatable, hands-off releases, safe preview environments for review, and a
build gate that prevents broken code from ever reaching a live environment.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic production deployment on main (Priority: P1)

When a maintainer merges or pushes code to the main branch, the pipeline automatically
builds the whole application, runs the project's quality checks, and — only if everything
passes — publishes the new version to the production environment. The maintainer does nothing
beyond pushing to main and can see whether the release succeeded.

**Why this priority**: This is the core value of the feature. Hands-off, reproducible
production releases remove the manual bottleneck and the single-machine dependency. On its
own it is a complete, valuable MVP: the team can ship to production simply by merging to main.

**Independent Test**: Push a small, valid change to the main branch and confirm that, with no
further manual action, the updated application becomes live in production and the run reports
success. Push a change that fails the quality gate and confirm production is left unchanged.

**Acceptance Scenarios**:

1. **Given** a passing change on the main branch, **When** it is pushed, **Then** the
   pipeline builds the frontend and backend, runs the quality checks, publishes to
   production, and reports success — with no manual steps.
2. **Given** a change on main that fails a quality check (type error or lint failure) or fails
   to build, **When** it is pushed, **Then** the pipeline stops before publishing, the
   previously live production version remains unchanged, and the failure is reported.
3. **Given** two changes pushed to main in quick succession, **When** the pipeline runs,
   **Then** deployments to production are serialized (or the latest supersedes the earlier)
   so production ends in the state of the most recent successful build.
4. **Given** a successful production deployment, **When** the run completes, **Then** the
   production URL reflects the newly deployed version.

---

### User Story 2 - On-demand preview deployment for a topic branch (Priority: P2)

A developer working on a topic branch wants to see their changes running on a live URL before
merging. From the CI/CD interface they manually trigger a preview deployment for their branch.
The pipeline builds the application and publishes it to an isolated preview environment, then
reports the preview URL back to the developer. Preview deployments do not happen automatically
on every push — only when explicitly requested.

**Why this priority**: Live preview environments make review and stakeholder sign-off far
easier than reading a diff, and manual triggering keeps preview usage intentional and avoids
noisy or costly deploys on every commit. It builds naturally on the P1 build pipeline.

**Independent Test**: On a topic branch, manually trigger the preview deployment and confirm a
live preview URL is produced that serves that branch's build; confirm that simply pushing to
the topic branch without triggering the action does NOT deploy anything.

**Acceptance Scenarios**:

1. **Given** a topic branch, **When** a developer manually triggers the preview deployment,
   **Then** the pipeline builds the application and publishes it to the preview environment
   and reports the resulting preview URL.
2. **Given** a topic branch, **When** code is pushed to it without triggering the manual
   action, **Then** no deployment occurs.
3. **Given** a manually triggered preview deployment whose build or quality checks fail,
   **When** the pipeline runs, **Then** nothing is published to the preview environment and
   the failure is reported.
4. **Given** a preview deployment, **When** it runs, **Then** it uses preview-only
   configuration and secrets and does not read or write production data.

---

### User Story 3 - Build and quality gate with clear feedback (Priority: P3)

Before anything is deployed to any environment, the pipeline builds both the frontend and the
backend and runs the project's quality checks (type checking and linting). Whether the run
succeeds or fails, the outcome — including the reason for any failure and, for previews, the
resulting URL — is clearly reported so developers can act on it.

**Why this priority**: The gate is what makes automated deployment safe, and clear feedback is
what makes it usable day-to-day. It reinforces both P1 and P2 but is expressed once as a
shared, independently verifiable guarantee.

**Independent Test**: Introduce a deliberate type error (or lint violation) on a branch, run
the pipeline, and confirm the deployment is blocked and the failure and its cause are
reported; then fix it and confirm the run passes and reports success.

**Acceptance Scenarios**:

1. **Given** any deployment trigger (production or preview), **When** the pipeline runs,
   **Then** it first builds the frontend and backend and runs the configured quality checks.
2. **Given** a failing build or quality check, **When** the pipeline runs, **Then** it aborts
   before any publish step and surfaces which check failed.
3. **Given** a successful run, **When** it completes, **Then** the result is reported as
   successful, including the target environment and (for preview) the preview URL.

---

### Edge Cases

- **Missing or invalid credentials**: If required deployment credentials or application
  secrets are absent or invalid, the run MUST fail fast with a clear message and MUST NOT
  leave a live environment partially updated.
- **Secret exposure attempt**: Credentials and secrets MUST never be printed in logs or
  embedded in the workflow definition or the built artifacts.
- **Manual preview triggered on the main branch**: The system MUST behave predictably — either
  disallow preview on main or clearly treat it as a preview build — without accidentally
  overwriting production.
- **Concurrent runs on the same environment**: Overlapping deployments to the same environment
  MUST be serialized or de-duplicated so the environment is never left in a mixed state.
- **Partial failure mid-publish**: If publishing fails after it starts, the outcome MUST be
  reported as failed and the environment MUST NOT be left serving a broken build where the
  platform allows atomic replacement.
- **Non-code changes** (e.g., documentation-only pushes to main): The pipeline SHOULD still
  behave safely; deploying an unchanged application MUST NOT cause an outage.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST automatically build and deploy the application to the production
  environment whenever changes are pushed (including merges) to the main branch, with no manual
  steps required.
- **FR-002**: The system MUST allow an authorized developer to manually trigger a build and
  deployment of a topic branch to a preview environment.
- **FR-003**: The system MUST NOT deploy topic branches automatically; preview deployment
  occurs only in response to an explicit manual trigger.
- **FR-004**: The pipeline MUST build both the frontend application and the backend API as part
  of every deployment.
- **FR-005**: The pipeline MUST run the project's quality checks (type checking and linting)
  before any publish step and MUST abort the deployment if any check fails. (No unit tests are
  run, per the project constitution.)
- **FR-006**: The system MUST deploy the frontend and backend together as a single unit,
  consistent with the application's single-origin deployment architecture.
- **FR-007**: Deployment credentials and application secrets MUST be sourced from secure secret
  storage and MUST NOT be hardcoded in the workflow definition, committed to the repository, or
  exposed in logs.
- **FR-008**: Production and preview deployments MUST use separate configuration and secrets so
  that a preview deployment can never read or write production data (required because vii-pass
  stores sensitive password-vault data).
- **FR-009**: On completion, the system MUST report the deployment outcome (success or failure)
  and, for preview deployments, the resulting preview URL, to the developer.
- **FR-010**: If a build or quality check fails, the currently live version of the target
  environment MUST remain unchanged (no partial or broken deployment).
- **FR-011**: Deployment MUST be authorized: automatic production deployment is limited to the
  main branch, and manual preview deployment MUST be restricted to authorized users of the
  repository.
- **FR-012**: Concurrent deployments to the same environment MUST be serialized or de-duplicated
  so the environment is never left in an inconsistent state.
- **FR-013**: The pipeline definition MUST live in the repository (version-controlled) so that
  changes to the build-and-deploy process are reviewed and tracked like any other code.
- **FR-014**: The production deployment path and the preview deployment path MUST be defined so
  they can evolve independently (e.g., different environments, URLs, and secrets) without one
  breaking the other.

### Key Entities *(include if feature involves data)*

- **Deployment**: A single build-and-publish attempt of a specific commit to a specific
  environment. Key attributes: source branch/commit, target environment, outcome
  (success/failure), timestamp, and resulting URL. Not persisted application data — a process
  record surfaced by the CI/CD platform.
- **Environment**: A named deployment target. There are two: **production** (fed automatically
  from main) and **preview** (fed manually from topic branches). Each has its own configuration,
  secrets, data isolation, and URL.
- **Secret**: A protected credential or configuration value (e.g., the deployment API token and
  the database connection string) stored in secure secret storage and injected at run time,
  never in source.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A push to the main branch results in the updated application being live in
  production with zero manual steps performed by the developer.
- **SC-002**: A developer can deploy a topic branch to a live preview environment using a
  single manual action, without running any commands on their local machine.
- **SC-003**: 100% of runs whose build or quality checks fail result in no change to the target
  environment's live version.
- **SC-004**: Preview deployments never read or write production data in any run.
- **SC-005**: Every pipeline run reports a clear success/failure outcome, and every successful
  preview run reports a reachable preview URL.
- **SC-006**: Zero deployment credentials or secrets appear in logs, the repository, or built
  artifacts across all runs.
- **SC-007**: The end-to-end production release (from push to main until the new version is
  live) completes within 10 minutes under normal conditions.
- **SC-008**: After adoption, no production or preview deployment requires a developer to run
  build or deploy commands locally.

## Assumptions

- The repository is hosted on GitHub, and GitHub Actions is the CI/CD platform used to run the
  build-and-deploy workflows (per the user's request).
- The deployment target is Cloudflare, using the single-origin architecture established earlier
  in this project: the frontend SPA is served by the same Worker that hosts the API, deployed as
  one unit.
- The **main** branch is the production branch; **topic** branches are non-production feature
  branches that use the preview path.
- Deployment credentials (the Cloudflare API token) and application secrets (the database
  connection string) are stored as repository/environment secrets in the CI/CD platform and are
  configured by a maintainer before first use.
- The preview environment uses its own preview-only secrets and an isolated (non-production)
  dataset, so preview never touches the production password vault.
- The quality gate consists of the project's existing type checking and linting; no unit-test
  suite is created or run, consistent with the project constitution and instructions.
- Provisioning of the underlying Cloudflare account, Worker, preview environment, and the
  external database instances is a prerequisite handled outside this workflow (the workflow
  consumes them).
- Rollback for production is achieved by deploying a previous known-good commit through the same
  automated path (no separate rollback mechanism is in scope for the initial version).

## Out of Scope

- Automatic teardown/cleanup of preview environments when a topic branch is merged or deleted.
- A dedicated one-click rollback mechanism beyond redeploying a previous commit.
- Multi-region or blue/green production strategies beyond what the platform provides by default.
- Automated database migrations or seeding as part of the deployment pipeline.
- Notifications to external channels (e.g., chat/email) beyond the CI/CD platform's own run
  status and, where applicable, pull-request feedback.
