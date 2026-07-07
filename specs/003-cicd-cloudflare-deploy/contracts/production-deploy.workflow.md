# Contract: Production Deploy Workflow

**File to implement**: `.github/workflows/deploy-production.yml`
**Realizes**: US1, FR-001, FR-004, FR-005, FR-006, FR-010, FR-011, FR-012, FR-013

This is a *contract* (the required behavior and shape), not the final YAML. `/speckit.tasks`
and `/speckit.implement` produce the actual file. Any implementation MUST satisfy every clause.

## Trigger

- `on.push.branches: [main]` — automatic production deploy on every push/merge to `main`
  (FR-001).
- `on.workflow_dispatch` — allows a maintainer to manually re-run production against a chosen
  commit (supports the rollback-by-redeploy assumption). No inputs required.
- MUST NOT trigger on any other branch or on pull_request (FR-011: prod is `main`-only).

## Permissions

- `contents: read`
- `deployments: write` (to record the GitHub deployment/environment)
- No other scopes (least privilege).

## Concurrency

```yaml
concurrency:
  group: deploy-production
  cancel-in-progress: false   # serialize; never cut an in-flight publish (FR-012, FR-010)
```

## Job: `deploy`

- `runs-on: ubuntu-latest`
- `environment:`
  - `name: production`
  - `url: https://vii-pass-api.<subdomain>.workers.dev`  ← set to the real workers.dev URL
- Steps, in order:
  1. `actions/checkout@v4`
  2. `uses: ./.github/actions/build-and-verify` — the shared gate (see
     [build-and-verify contract in secrets-and-environments.md](secrets-and-environments.md)).
     MUST run before any deploy step (FR-005). Job aborts here on any gate failure (FR-010).
  3. **Deploy** — run from `backend/`:
     ```bash
     npx wrangler deploy
     ```
     with env:
     - `CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}`
     - `CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`

## Behavioral guarantees (acceptance mapping)

| Clause | Requirement |
|--------|-------------|
| Gate runs before deploy; failure aborts before publish | FR-005, FR-010, US1-#2 |
| Only `main` reaches this job | FR-011, US1 |
| Publishes SPA + API as one Worker deploy | FR-006, US1-#1 |
| Serialized deploys → prod ends at latest successful build | FR-012, US1-#3 |
| On success, production URL serves the new version | US1-#4, FR-009 |
| No secret value is echoed; token used only as env var | FR-007, SC-006 |
| Definition is version-controlled | FR-013 |

## Failure semantics

- Any of typecheck / lint / audit / build failing → job fails at the gate step; `wrangler
  deploy` never runs; the live `vii-pass-api` version is unchanged (FR-010).
- `wrangler deploy` failing → run reported failed; Cloudflare retains the previous version
  (atomic replacement). No partial live state (edge case: partial failure mid-publish).
