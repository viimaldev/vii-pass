# Contract: Preview Deploy Workflow

**File to implement**: `.github/workflows/deploy-preview.yml`
**Realizes**: US2, FR-002, FR-003, FR-004, FR-005, FR-006, FR-008, FR-009, FR-010, FR-011, FR-012, FR-014

This is a *contract* (required behavior and shape), not the final YAML. Any implementation MUST
satisfy every clause.

## Trigger

- `on.workflow_dispatch` **only** — preview deploys happen exclusively on an explicit manual
  trigger (FR-002, FR-003). There MUST be no `push`/`pull_request` trigger (FR-003, US2-#2:
  pushing a topic branch deploys nothing).
- Runs on the ref (branch) selected in the Actions UI; that branch's code is what gets built
  and previewed.

> Operational note: `workflow_dispatch` only appears in the UI once this file exists on the
> **default branch** (`main`). See [quickstart.md](../quickstart.md).

## Permissions

- `contents: read`
- `deployments: write`
- No other scopes.

## Concurrency

```yaml
concurrency:
  group: deploy-preview-${{ github.ref }}
  cancel-in-progress: true    # newest preview for a branch supersedes older ones (FR-012)
```

## Job: `deploy-preview`

- `runs-on: ubuntu-latest`
- `environment:`
  - `name: preview`
  - `url: https://vii-pass-api-preview.<subdomain>.workers.dev`
- Steps, in order:
  1. **Guard against `main`** — fail fast with a clear message if `github.ref_name == 'main'`
     (edge case "preview on main"; FR-011). Example:
     ```yaml
     - name: Reject preview on main
       if: ${{ github.ref_name == 'main' }}
       run: |
         echo "::error::Preview deploys are for topic branches. Use the production workflow for main."
         exit 1
     ```
  2. `actions/checkout@v4` (checks out the selected topic branch).
  3. `uses: ./.github/actions/build-and-verify` — shared gate; MUST run before publish
     (FR-005); aborts on failure (FR-010, US2-#3).
  4. **Deploy preview** — run from `backend/`:
     ```bash
     npx wrangler deploy --env preview
     ```
     with env:
     - `CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}` (preview-scoped)
     - `CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`
  5. **Report preview URL** — append the preview URL to `$GITHUB_STEP_SUMMARY` (FR-009,
     US2-#1, SC-005).

## Behavioral guarantees (acceptance mapping)

| Clause | Requirement |
|--------|-------------|
| Manual trigger only; no auto-deploy on topic push | FR-002, FR-003, US2-#2 |
| Gate runs before deploy; failure publishes nothing | FR-005, FR-010, US2-#3 |
| Deploys to the **separate** `vii-pass-api-preview` Worker | FR-014, US2 |
| Uses preview-only secrets/DB; never production data | FR-008, US2-#4 |
| Reports the resulting preview URL | FR-009, US2-#1, SC-005 |
| Preview on `main` is rejected, production untouched | FR-011, edge case |
| Per-branch supersede prevents mixed preview state | FR-012 |

## Failure semantics

- Gate failure → `wrangler deploy --env preview` never runs; the preview Worker's prior
  version (if any) is unchanged (FR-010).
- Deploy failure → run reported failed; nothing new is published (US2-#3).
- The preview job cannot read production-scoped secrets (GitHub Environment scoping), so it can
  never reach the production database (FR-008, INV-1).
