# Contract: Secrets, Environments, Build Action & Wrangler Preview Env

**Realizes**: FR-004, FR-005, FR-007, FR-008, FR-011, FR-013, FR-014
**Files to implement**: `.github/actions/build-and-verify/action.yml`,
`backend/wrangler.toml` (`[env.preview]` block)

This contract defines the shared build gate, the secret/environment matrix, and the wrangler
preview environment. Implementations MUST satisfy every clause.

---

## 1. Composite action: `build-and-verify`

**File**: `.github/actions/build-and-verify/action.yml` — `using: composite`.

**Inputs**:

| Input | Default | Purpose |
|-------|---------|---------|
| `node-version` | `20` | Node major used for the whole run |

**Steps (in order — ALL run before any caller deploy step, FR-005)**:

1. `actions/setup-node@v4` with `node-version: ${{ inputs.node-version }}` and `cache: npm`.
2. `npm ci` (repo root — installs all workspaces from `package-lock.json`).
3. `npm run typecheck` (root → `tsc --noEmit` across workspaces) — FR-005.
4. `npm run lint` (root → `eslint .`) — FR-005.
5. `npm audit --omit=dev --audit-level=high` — Constitution Security gate scanning **shipped**
   (production) dependencies only (research Decision 6). Blocking; dev-tooling advisories that
   are never deployed do not block, but a real high/critical in a shipped dependency does.
6. `npm run build --workspace @vii-pass/frontend` (produces `frontend/dist`) — FR-004, FR-006.

**Guarantees**:
- Any failing step fails the action, so the caller's subsequent deploy step never runs (FR-005,
  FR-010).
- No secrets are referenced or printed (FR-007) — this action only builds/verifies.
- Reused by BOTH workflows so the gate is identical for prod and preview (DRY; FR-004/FR-005),
  while the two workflows remain independent (FR-014).

---

## 2. Secret & environment matrix

### GitHub Environments (authorization surface — FR-011)

| Environment | Protection | Scoped secrets |
|-------------|-----------|----------------|
| `production` | Deployment branch rule: **`main` only**; optional required reviewers | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| `preview` | Optional required reviewers | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |

- Bind each workflow job with `environment: { name: ... }` so it can only read that
  environment's secrets (reinforces FR-008: preview job cannot read production secrets).
- `CLOUDFLARE_ACCOUNT_ID` MAY instead be a repository variable if the account is shared; keep
  it out of `wrangler.toml` so the repo carries no account-specific data (FR-013).

### Cloudflare Worker secrets (application secrets — set out-of-band, never in CI)

| Worker | Secret | Set via |
|--------|--------|---------|
| `vii-pass-api` (prod) | `MONGODB_URI` → production DB | `npx wrangler secret put MONGODB_URI` |
| `vii-pass-api-preview` | `MONGODB_URI` → **isolated** preview DB | `npx wrangler secret put MONGODB_URI --env preview` |

**Invariants**: FR-007 (no secret in YAML/repo/logs/artifacts, SC-006); FR-008 (prod and
preview DB secrets are distinct instances on distinct Workers → preview can never touch
production data).

### Cloudflare API token — required permissions (least privilege)

- **Account › Workers Scripts › Edit** (deploy the Worker + static assets).
- Include the account in the token's Account Resources.
- One token may serve both environments, or use two separate tokens (one per GitHub
  Environment) for stronger isolation.

---

## 3. Wrangler `[env.preview]` contract

Add to `backend/wrangler.toml`. Because named environments do **not** reliably inherit `vars`
or `assets`, these MUST be redefined (research Decision 2). `main`, `compatibility_date`, and
`compatibility_flags` are inherited from the top level.

```toml
# ── Preview environment (isolated Worker for topic-branch previews) ────────────
# Deployed with:  npx wrangler deploy --env preview   (from backend/)
# Separate Worker => separate secret store => preview NEVER touches production data (FR-008).
[env.preview]
name = "vii-pass-api-preview"

# assets are NOT inherited by named envs — redefine so preview also serves the SPA.
[env.preview.assets]
directory = "../frontend/dist"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*"]

# vars are NOT inherited by named envs — redefine. Note the isolated DB name.
# MONGODB_URI is a SECRET set via `wrangler secret put MONGODB_URI --env preview`
# (points at a non-production database) — it is NOT listed here.
[env.preview.vars]
MONGODB_DB_NAME = "vii_pass_preview"
ALLOWED_ORIGINS = "http://localhost:5173"
SESSION_IDLE_TTL_SECONDS = "1800"
SESSION_ABSOLUTE_TTL_SECONDS = "86400"
PBKDF2_ITERATIONS = "100000"   # Workers Web Crypto hard cap; must match production
```

**Guarantees**:
- Preview Worker is a distinct deployable (`vii-pass-api-preview`) with its own URL (FR-014).
- `MONGODB_DB_NAME = "vii_pass_preview"` + a preview-only `MONGODB_URI` secret guarantee data
  isolation (FR-008). For stronger isolation, point the preview `MONGODB_URI` at a separate
  free-tier Atlas cluster (recommended) rather than only a separate database on the same
  cluster.
- `PBKDF2_ITERATIONS` stays at `100000` to match the platform cap and keep hashes portable.

---

## 4. Verification checklist (post-implementation)

- [ ] `npx wrangler deploy --env preview --dry-run` (from `backend/`) succeeds and names
      `vii-pass-api-preview`.
- [ ] Preview and production Workers each list their own `MONGODB_URI` secret
      (`wrangler secret list` and `... --env preview`).
- [ ] A grep of `.github/` and `backend/wrangler.toml` shows **no** connection strings or
      tokens (FR-007).
- [ ] The `production` GitHub Environment restricts deployments to `main`.
