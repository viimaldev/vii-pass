# Quickstart: Automated CI/CD Deployment to Cloudflare

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-07-07

Audience: a maintainer setting up the pipeline once, then anyone releasing or previewing.
Replace `<subdomain>` with your workers.dev subdomain (e.g. `viimal`).

---

## A. One-time setup (maintainer)

Do these **before** the first automated deploy. They provision the things the workflows
*consume* (per the spec's "provisioning is a prerequisite" assumption).

### 1. Provision the preview database (isolated)

- Create a **non-production** MongoDB Atlas database — ideally a **separate free-tier cluster**
  (strongest isolation), or at minimum a separate database named `vii_pass_preview`.
- Allow Cloudflare egress: Atlas → Network Access → add `0.0.0.0/0` (Workers edge IPs are
  dynamic).
- Keep its connection string handy for step 4 — it MUST differ from production (FR-008).

### 2. Add the preview Worker config to `backend/wrangler.toml`

Add the `[env.preview]` block exactly as specified in
[contracts/secrets-and-environments.md](contracts/secrets-and-environments.md) §3. Verify:

```powershell
Push-Location backend
npx wrangler deploy --env preview --dry-run   # expect name "vii-pass-api-preview"
Pop-Location
```

### 3. Create a Cloudflare API token & find your account id

- Cloudflare dashboard → My Profile → API Tokens → Create Token.
- Permission: **Account › Workers Scripts › Edit**; add your account under Account Resources.
- Copy the token (shown once). Note your **Account ID** (Workers & Pages → Overview).

### 4. Pre-provision the application (DB) secrets on each Worker

The database URI is a **Cloudflare Worker secret** — it never goes into GitHub (research
Decision 3). Run from `backend/`:

```powershell
Push-Location backend
$env:CLOUDFLARE_API_TOKEN = "<your-cloudflare-api-token>"

# Production Worker → production DB
npx wrangler secret put MONGODB_URI            # paste PRODUCTION connection string

# Preview Worker → isolated preview DB
npx wrangler secret put MONGODB_URI --env preview   # paste PREVIEW connection string

Remove-Item Env:CLOUDFLARE_API_TOKEN
Pop-Location
```

> The two `MONGODB_URI` values MUST point at different databases (FR-008).

### 5. Create GitHub Environments & secrets

In the GitHub repo → Settings → Environments, create two environments:

**`production`**
- Deployment branch rule → **Selected branches** → `main` only.
- Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- (Optional) Required reviewers.

**`preview`**
- Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- (Optional) Required reviewers.

> `CLOUDFLARE_ACCOUNT_ID` may instead be a repository **variable** if you prefer. Never put the
> database URI here — it lives only on the Workers (step 4).

### 6. Merge the workflows to `main`

The two workflow files and the composite action (produced by `/speckit.implement`) must exist
on the **default branch** for the manual preview trigger to appear in the Actions UI
(research Decision 9).

---

## B. Release to production (everyday flow)

1. Merge or push your change to `main`.
2. GitHub Actions runs **Deploy Production** automatically: build → typecheck → lint → audit →
   deploy `vii-pass-api`.
3. Watch the run under the **Actions** tab. On success the new version is live at
   `https://vii-pass-api.<subdomain>.workers.dev` (SC-001, target < 10 min / SC-007).
4. If any check fails, the deploy is skipped and production stays on the previous version
   (FR-010) — fix and push again.

**Rollback** (assumption in spec): re-run **Deploy Production** via *Run workflow* on a previous
known-good commit, or revert on `main` and let the push redeploy.

---

## C. Deploy a topic branch to preview (on demand)

1. Push your topic branch (e.g. `topic/vii-1002-...`). Pushing alone deploys **nothing**
   (FR-003).
2. GitHub → **Actions** → **Deploy Preview** → **Run workflow** → pick your topic branch →
   **Run**.
3. The run builds and verifies your branch, then deploys the separate
   **`vii-pass-api-preview`** Worker.
4. Open the run → the **preview URL** is in the run summary and the `preview` environment
   (SC-005): `https://vii-pass-api-preview.<subdomain>.workers.dev`.
5. Selecting `main` here is rejected on purpose (use the production flow).

Preview uses only preview secrets and the isolated preview DB — it never reads or writes the
production vault (FR-008, SC-004).

---

## D. Verify the setup (acceptance smoke test)

| Check | Expected | Maps to |
|-------|----------|---------|
| Push a trivial valid change to `main` | Auto build + deploy; prod URL shows it, zero manual steps | SC-001, US1 |
| Introduce a type error on a branch, run a deploy | Run fails at gate; nothing deploys | SC-003, US3 |
| Push a topic branch without dispatching | No deployment occurs | US2-#2, FR-003 |
| Run **Deploy Preview** on a topic branch | Preview URL returned; serves that branch | SC-002, US2-#1 |
| Inspect logs of any run | No secret/token/connection string printed | SC-006, FR-007 |
| Confirm preview DB name | `vii_pass_preview` (not `vii_pass`) | SC-004, FR-008 |

---

## Notes / gotchas (from this project's history)

- **PBKDF2 = 100000** on Workers (hard cap). Accounts registered against a local 600000-iter
  build cannot log in on a deployed Worker — re-register them.
- **Rotate** any database password that was ever pasted into shared chat/logs, then update the
  corresponding Worker secret with `wrangler secret put`.
- `wrangler tail` may be blocked by a corporate TLS-intercepting proxy; rely on the GitHub
  Actions run logs for CI visibility.
