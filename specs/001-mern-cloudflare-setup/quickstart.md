# Quickstart: MERN Web Application Foundation on Cloudflare

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-07-06

This guide takes a fresh checkout to a running local stack, then to a live Cloudflare
deployment. It follows the architecture in [research.md](./research.md):
React (Vite) → Cloudflare Pages → Hono API (Cloudflare Workers) → MongoDB Atlas → R2.

> No secrets are ever committed. All credentials come from environment configuration
> (Wrangler secrets, `.dev.vars`, Pages env vars).

---

## Prerequisites

- **Node.js 20 LTS** and npm.
- **Wrangler** (Cloudflare CLI): `npm i -g wrangler` (or use the local dev dependency).
- A **Cloudflare account** with access to **Workers**, **Pages**, and **R2**.
- A **MongoDB Atlas** cluster and a database user connection string.

---

## Repository layout

```text
backend/            # Hono API → Cloudflare Workers (TypeScript)
  src/
    index.ts        # Worker entry: builds the Hono app, exports { fetch }
    routes/         # health.ts, records.ts, files.ts
    services/       # records.service.ts, files.service.ts, health.service.ts
    middleware/     # error.ts, cors.ts, validate.ts
    lib/            # mongo.ts (cached client), r2.ts (binding helpers)
    schemas/        # Zod schemas (source of truth for types)
  wrangler.toml
  package.json
  tsconfig.json
frontend/           # React + Vite → Cloudflare Pages (TypeScript)
  src/
    components/     # shared design-system components (accessible)
    pages/          # screens
    services/       # api client (uses VITE_API_BASE_URL)
    types/          # re-exports from shared/
    styles/         # design tokens
  index.html
  vite.config.ts
  package.json
  tsconfig.json
shared/
  types/            # types shared across frontend & backend
```

---

## 1. Configure environment (no secrets in git)

### Backend (Workers) — `backend/.dev.vars` (git-ignored)

```ini
MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>/?retryWrites=true&w=majority"
MONGODB_DB_NAME="vii_pass"
ALLOWED_ORIGINS="http://localhost:5173"
MAX_UPLOAD_BYTES="10485760"
ALLOWED_CONTENT_TYPES="image/png,image/jpeg,application/pdf"
```

`backend/wrangler.toml` (committed; **no secrets here**):

```toml
name = "vii-pass-api"
main = "src/index.ts"
compatibility_date = "2026-07-01"
compatibility_flags = ["nodejs_compat"]

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "vii-pass-files"

[vars]
MONGODB_DB_NAME = "vii_pass"
ALLOWED_ORIGINS = "http://localhost:5173"
MAX_UPLOAD_BYTES = "10485760"
ALLOWED_CONTENT_TYPES = "image/png,image/jpeg,application/pdf"
```

### Frontend (Pages) — `frontend/.env.local` (git-ignored)

```ini
VITE_API_BASE_URL="http://localhost:8787"
```

### MongoDB Atlas network access

Allow Cloudflare egress to reach Atlas: in Atlas → Network Access, add the appropriate
allowlist for the edge environment (or configure per your organization's policy). Create a
database user and use its credentials in `MONGODB_URI`.

---

## 2. Install dependencies

```powershell
cd backend;  npm install
cd ../frontend;  npm install
```

---

## 3. Run locally

Open two terminals from the repo root:

```powershell
# Terminal 1 — API on http://localhost:8787
cd backend;  npm run dev        # wrangler dev
```

```powershell
# Terminal 2 — SPA on http://localhost:5173
cd frontend;  npm run dev       # vite
```

---

## 4. Verify the end-to-end slice

```powershell
# Health: all components should report "ok"
curl http://localhost:8787/api/health

# Create a record (proves API → MongoDB)
curl -X POST http://localhost:8787/api/records `
  -H "Content-Type: application/json" `
  -d '{ "title": "first record", "content": "hello vii-pass" }'

# List records (should include the new record after a reload/redeploy too)
curl http://localhost:8787/api/records

# Upload a file (proves API → R2), then retrieve it
curl -X POST http://localhost:8787/api/files -F "file=@./sample.png"
curl http://localhost:8787/api/files/<returned-key> --output roundtrip.png
```

In the browser, open http://localhost:5173, confirm the app renders, creates/reads a
record, and uploads/retrieves a file. This satisfies the Independent Tests for User
Stories 1–3.

---

## 5. Provision Cloudflare resources (one-time)

```powershell
# Create the R2 bucket referenced by wrangler.toml
wrangler r2 bucket create vii-pass-files

# Store the Atlas connection string as a secret (NOT in wrangler.toml)
cd backend
wrangler secret put MONGODB_URI
```

---

## 6. Deploy

```powershell
# API → Cloudflare Workers
cd backend;  npm run deploy      # wrangler deploy
```

```powershell
# Frontend → Cloudflare Pages
cd frontend;  npm run build
wrangler pages deploy dist --project-name vii-pass-web
```

Set the production `VITE_API_BASE_URL` (the deployed Worker URL/custom domain) in the Pages
project's environment variables, and set `ALLOWED_ORIGINS` on the Worker to the deployed
Pages origin so CORS permits the SPA. Re-verify `/api/health` against the production URL.

---

## Mapping to success criteria

| Check | Success criterion |
|-------|-------------------|
| SPA loads and is interactive quickly from multiple regions | SC-001, SC-005 |
| In-app actions respond within budget | SC-002 |
| Records survive reload **and** redeploy | SC-003 |
| Uploaded file retrieved identical to original | SC-004 |
| One operator deploys from clean checkout, no secrets in source | SC-006, SC-007 |
| Errors are actionable, no stack traces leaked | SC-009 |
| Primary flows pass automated a11y check (WCAG 2.1 AA) | SC-010 |
