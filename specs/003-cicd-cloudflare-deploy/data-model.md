# Phase 1 Data Model: Automated CI/CD Deployment to Cloudflare

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-07-07

This feature has **no application/database schema**. The "entities" from the spec are
process- and configuration-level concepts realized by the CI/CD platform and Cloudflare. This
document models them as configuration/state entities so the workflow design is unambiguous.

---

## Entity: Environment

A named deployment target. There are exactly two, and they are strictly isolated.

| Field | production | preview |
|-------|-----------|---------|
| Name | `production` | `preview` |
| Fed by | Automatic — push to `main` | Manual — `workflow_dispatch` on a non-`main` ref |
| Cloudflare Worker | `vii-pass-api` | `vii-pass-api-preview` |
| Wrangler config | top-level `backend/wrangler.toml` | `[env.preview]` in same file |
| Public URL | `https://vii-pass-api.<subdomain>.workers.dev` | `https://vii-pass-api-preview.<subdomain>.workers.dev` |
| Database (`MONGODB_DB_NAME`) | `vii_pass` | `vii_pass_preview` (isolated) |
| `MONGODB_URI` secret | Worker secret on `vii-pass-api` | Worker secret on `vii-pass-api-preview` |
| GitHub Environment | `production` (branch rule: `main`) | `preview` (optional reviewers) |
| Deploy auth secret | `CLOUDFLARE_API_TOKEN` (production-scoped) | `CLOUDFLARE_API_TOKEN` (preview-scoped) |

**Invariants**:
- INV-1: A `preview` deployment MUST NOT be able to read or write the `production` database
  (FR-008). Enforced by separate Workers, each with its own `MONGODB_URI` secret pointing at a
  distinct database.
- INV-2: `production` is writable only from `main` (FR-011). Enforced by the `push` trigger
  plus the GitHub Environment branch rule.
- INV-3: Each Environment's configuration and secrets can change without affecting the other
  (FR-014). Enforced by separate wrangler env + separate GitHub Environment scope.

---

## Entity: Secret

A protected credential/config value injected at run time, never stored in source (FR-007).

| Secret | Type | Residence | Scope | Consumed by |
|--------|------|-----------|-------|-------------|
| `CLOUDFLARE_API_TOKEN` | Deploy credential | GitHub Environment secret | per env (`production`, `preview`) | `wrangler deploy` in CI |
| `CLOUDFLARE_ACCOUNT_ID` | Config id | GitHub Environment secret or repo variable | per env / repo | `wrangler deploy` in CI |
| `MONGODB_URI` (prod) | App secret | Cloudflare Worker secret on `vii-pass-api` | production Worker | Worker at request time |
| `MONGODB_URI` (preview) | App secret | Cloudflare Worker secret on `vii-pass-api-preview` | preview Worker | preview Worker at request time |

**Invariants**:
- INV-4: No secret value appears in workflow YAML, repository files, run logs, or built
  artifacts (FR-007, SC-006). The DB URI never enters CI at all (research Decision 3).
- INV-5: Production and preview secrets are distinct instances (FR-008); rotating one does not
  touch the other.

**Non-secret configuration** (safe to commit, lives in `wrangler.toml`): `MONGODB_DB_NAME`,
`ALLOWED_ORIGINS`, `SESSION_IDLE_TTL_SECONDS`, `SESSION_ABSOLUTE_TTL_SECONDS`,
`PBKDF2_ITERATIONS` (= `100000`, the Workers cap).

---

## Entity: Deployment (process record)

A single build-and-publish attempt of one commit to one Environment. Not persisted
application data — surfaced by GitHub Actions (a workflow run) and Cloudflare (a Worker
deployment).

| Attribute | Source |
|-----------|--------|
| Source branch / commit SHA | `github.ref_name` / `github.sha` |
| Target environment | `production` or `preview` |
| Trigger | `push` (prod) or `workflow_dispatch` (preview) |
| Outcome | success / failure (GitHub run conclusion) |
| Timestamp | run start/end |
| Resulting URL | Environment `url`; preview URL also written to the run step summary |

### State transitions

```text
queued
  └─(runner picks up; concurrency group admits)→ verifying
        ├─(typecheck / lint / audit / build fails)→ FAILED  [no publish; live env unchanged]
        └─(gate passes)→ publishing
              ├─(wrangler deploy fails)→ FAILED  [platform keeps prior version]
              └─(deploy succeeds)→ SUCCEEDED  [new version live; URL reported]
```

**Invariants**:
- INV-6: A run reaches `publishing` only after the full gate passes (FR-005, FR-010).
- INV-7: A `FAILED` run leaves the target Environment's live version unchanged (FR-010).
- INV-8: Concurrent runs targeting the same Environment are serialized/de-duplicated so the
  live version is never a mix of two deployments (FR-012): production serializes
  (`cancel-in-progress: false`); preview supersedes per branch (`cancel-in-progress: true`).

---

## Relationships

```text
Deployment ──targets──> Environment ──has 1──> Cloudflare Worker
     │                        │
     │                        └──uses──> Secret{ MONGODB_URI (per-env) }
     └──authenticated by──> Secret{ CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID (per-env) }
```

- One Environment has exactly one Cloudflare Worker and one `MONGODB_URI` secret instance.
- Many Deployments occur over time against one Environment; only the latest successful one is
  live.
- Deployments never cross environments: a `preview` Deployment can only touch the `preview`
  Worker and `preview` secrets (INV-1).
