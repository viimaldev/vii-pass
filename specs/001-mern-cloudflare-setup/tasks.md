---
description: "Task list for MERN + Cloudflare foundation (story vii:1000)"
---

# Tasks: MERN Web Application Foundation on Cloudflare

**Input**: Design documents from `/specs/001-mern-cloudflare-setup/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml)

**Tests**: Per the project Constitution (Principle II) and project instructions, unit tests are **NOT** generated for this project. This foundation has **no authentication** yet, so no critical-security-flow integration checks are warranted either — there is **no testing phase**. Verification is via TypeScript strict, ESLint/Prettier, and the manual `quickstart.md` walkthrough (T039).

**Organization**: Tasks are grouped by user story so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependency on another incomplete task)
- **[Story]**: The user story a task belongs to (US1, US2, US3)
- Every task includes an exact file path

## Overview

| Phase | Scope | Tasks |
|-------|-------|-------|
| 1 — Setup | Shared infra: repo structure, project inits, TS strict, ESLint/Prettier, wrangler.toml, Vite, ignore/env templates | T001–T008 (8) |
| 2 — Foundational | Shared types, Zod schemas, mongo/r2 libs, Hono bootstrap, middleware, frontend client/tokens/shell | T009–T020 (12) |
| 3 — US1 (P1) 🎯 MVP | Live skeleton + `GET /api/health` + frontend health screen | T021–T024 (4) |
| 4 — US2 (P2) | Records persistence (`POST`/`GET` `/api/records`, `GET /api/records/:id`) + records UI | T025–T029 (5) |
| 5 — US3 (P3) | File/image storage (`POST /api/files`, `GET /api/files/:key`) + upload/retrieve UI | T030–T034 (5) |
| 6 — Polish | Accessibility, error consistency, lint/typecheck, secret-scan, quickstart verification | T035–T039 (5) |

**Total: 39 tasks.**

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the three packages (`backend/`, `frontend/`, `shared/`) and shared tooling per [plan.md](./plan.md).

- [x] T001 Create the repository directory structure: `backend/src/{routes,services,middleware,lib,schemas}/`, `frontend/src/{components,pages,services,types,styles}/`, and `shared/types/` per plan.md.
- [x] T002 [P] Initialize the backend Workers package: `backend/package.json` (deps: `hono`, `mongodb`@^6.7, `zod`; devDeps: `wrangler`, `typescript`, `@cloudflare/workers-types`; scripts: `dev`=`wrangler dev`, `deploy`=`wrangler deploy`, `typecheck`=`tsc --noEmit`) and `backend/tsconfig.json` (strict, `types: ["@cloudflare/workers-types"]`).
- [x] T003 [P] Initialize the frontend Vite package: `frontend/package.json` (deps: `react`@^18, `react-dom`, `react-router-dom`; devDeps: `vite`@^5, `@vitejs/plugin-react`, `typescript`; scripts: `dev`=`vite`, `build`=`vite build`, `typecheck`=`tsc --noEmit`) and `frontend/tsconfig.json` (strict).
- [x] T004 [P] Initialize the shared types package: `shared/package.json` (name `@vii-pass/shared`, `main`/`types` pointing at `types/index.ts`) and `shared/tsconfig.json` (strict).
- [x] T005 [P] Create `backend/wrangler.toml` with `compatibility_flags = ["nodejs_compat"]`, an R2 `BUCKET` binding (`bucket_name = "vii-pass-files"`), and non-secret `[vars]` (`MONGODB_DB_NAME`, `ALLOWED_ORIGINS`, `MAX_UPLOAD_BYTES`, `ALLOWED_CONTENT_TYPES`) — **no secrets** (research Decisions 2, 4, 7).
- [x] T006 [P] Create `frontend/vite.config.ts` (React plugin, dev server port 5173) and `frontend/index.html` SPA entry (mount node + `#root`).
- [x] T007 [P] Add shared lint/format config at repo root: `eslint.config.js` (TypeScript strict, no `any`, no unused) and `.prettierrc`, applied across `backend/`, `frontend/`, and `shared/` (Constitution Code Quality).
- [x] T008 [P] Create ignore + environment templates: root `.gitignore` (ignore `node_modules/`, `dist/`, `.wrangler/`, `backend/.dev.vars`, `frontend/.env.local`) plus committed templates `backend/.dev.vars.example` and `frontend/.env.local.example` with placeholder keys only (FR-008, SC-007).

**Checkpoint**: All three packages install and typecheck against an empty `src`; tooling is uniform.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting infrastructure every user story depends on — shared types, validation schemas, data/storage libs, the Hono app + middleware, and the frontend client/design system/app shell.

**⚠️ CRITICAL**: No user story work may begin until this phase is complete.

- [x] T009 [P] Define shared TypeScript interfaces in `shared/types/index.ts`: `StoredRecord`, `FileAssetMeta`, `ComponentStatus`, `HealthReport`, `ApiError` per [data-model.md](./data-model.md).
- [x] T010 [P] Create the Zod validation schemas (source of truth, FR-009) in `backend/src/schemas/record.schema.ts` (`CreateRecordRequest`, `StoredRecord`), `backend/src/schemas/file.schema.ts` (upload content-type/size constraints, `FileAssetMeta`), and `backend/src/schemas/health.schema.ts` (`HealthReport`); infer and align with the shared interfaces.
- [x] T011 [P] Implement `backend/src/lib/mongo.ts`: a module-scoped, cached `MongoClient` reused across invocations, reading `MONGODB_URI`/`MONGODB_DB_NAME` from env, exposing a `getDb()` helper (research Decision 2; protects SC-002).
- [x] T012 [P] Implement `backend/src/lib/r2.ts`: thin helpers over the `BUCKET` R2 binding (`put`, `get`, `head`) with strong read-after-write semantics (research Decision 4).
- [x] T013 [P] Implement `backend/src/middleware/error.ts`: centralized error handler mapping thrown errors to the `ApiError` shape with actionable, non-leaky messages and correct status codes — never exposes stack traces/connection strings (FR-010, SC-009).
- [x] T014 [P] Implement `backend/src/middleware/cors.ts`: Hono CORS restricted to the origins in `ALLOWED_ORIGINS` (research Decision 6, FR-015).
- [x] T015 [P] Implement `backend/src/middleware/validate.ts`: a reusable Zod validation middleware for request bodies/queries that returns `400` + `ApiError` on failure (FR-009).
- [x] T016 Implement `backend/src/index.ts`: define the `Bindings`/`Env` type (R2 `BUCKET`, vars, `MONGODB_URI` secret), construct the Hono app, and wire the CORS + error middleware; leave a clear place to mount per-story routers (depends on T013, T014, T015).
- [x] T017 [P] Implement `frontend/src/services/apiClient.ts`: a typed client built on `VITE_API_BASE_URL` exposing generic `get`, `post`, and `postForm` helpers that parse JSON, throw typed `ApiError`, and surface friendly messages (research Decision 5).
- [x] T018 [P] Create `frontend/src/styles/tokens.css`: design tokens (color palette with WCAG 2.1 AA contrast, spacing, typography, focus-visible styles) as the single design-system source (Constitution UX Consistency, FR-016).
- [x] T019 [P] Create `frontend/src/types/index.ts`: re-export the shared types from `shared/types` for frontend consumption.
- [x] T020 Implement the app shell: `frontend/src/main.tsx` (bootstraps React, imports tokens), `frontend/src/App.tsx` (Router + route registry placeholder), and an accessible `frontend/src/components/Layout.tsx` (semantic landmarks + keyboard-navigable nav) (depends on T017, T018, T019).

**Checkpoint**: The Worker boots and serves `404` cleanly through the error middleware; the SPA renders the shell with tokens applied. User stories can now proceed (in parallel if staffed).

---

## Phase 3: User Story 1 — Live, globally served application skeleton (Priority: P1) 🎯 MVP

**Goal**: A deployable skeleton whose SPA calls its own API: `GET /api/health` reports API/DB/storage reachability and a frontend screen displays it — proving the front-end→API path end to end.

**Independent Test**: Open the app, trigger the health check, and confirm the rendered report shows `api: ok` (and DB/storage status) with a friendly message on failure — per spec US1 Independent Test.

- [x] T021 [P] [US1] Implement `backend/src/services/health.service.ts`: build a `HealthReport` by pinging MongoDB (via `lib/mongo.ts`) and probing R2 with a cheap `head`/`list` (via `lib/r2.ts`), rolling components up to `ok`/`degraded`/`down` (FR-011, research Decision 8).
- [x] T022 [US1] Implement `backend/src/routes/health.ts`: `GET /api/health` returning the service's `HealthReport`; mount it on the Hono app in `backend/src/index.ts` (depends on T021, T016).
- [x] T023 [P] [US1] Implement `frontend/src/pages/HealthPage.tsx`: on load/action, call `apiClient.get('/api/health')`, render each component's status with accessible loading and error states (actionable message, no raw error) (US1 acceptance 2 & 4).
- [x] T024 [US1] Register `HealthPage` as the home route in `frontend/src/App.tsx` and add its nav entry in `Layout.tsx` (depends on T023, T020).

**Checkpoint**: US1 is independently demoable — the live skeleton proves the front-end↔API path (MVP).

---

## Phase 4: User Story 2 — Durable data persistence (Priority: P2)

**Goal**: The API durably stores and retrieves structured records in MongoDB Atlas, and the SPA can create, list, and view them — data survives reload and redeploy.

**Independent Test**: Create a record in the UI, reload (and redeploy), then confirm it is still listed and viewable unchanged — per spec US2 Independent Test.

- [x] T025 [P] [US2] Implement `backend/src/services/records.service.ts`: `create`, `list` (with `limit` + opaque `cursor`), and `getById` against the `records` collection via `lib/mongo.ts`; set `createdAt`/`updatedAt`, map Mongo `_id` → string `id` (data-model StoredRecord).
- [x] T026 [US2] Implement `backend/src/routes/records.ts`: `POST /api/records` (validate `CreateRecordRequest` via `middleware/validate.ts` → `201`), `GET /api/records` (paged list), `GET /api/records/:id` (`200`/`404`), with `503` on DB unavailability; mount on the app in `backend/src/index.ts` (depends on T025, T015, T016; contract `openapi.yaml`).
- [x] T027 [P] [US2] Implement `frontend/src/components/RecordForm.tsx`: an accessible create-record form (labelled inputs, inline validation messages, submits via `apiClient.post`) (FR-016).
- [x] T028 [P] [US2] Implement `frontend/src/pages/RecordsPage.tsx`: list records via `apiClient.get('/api/records')` and view a selected record's detail via `GET /api/records/:id`, with empty/error states.
- [x] T029 [US2] Compose `RecordForm` + `RecordsPage`, register the records route in `frontend/src/App.tsx`, and add its nav entry in `Layout.tsx` (depends on T027, T028, T020).

**Checkpoint**: US1 and US2 both work independently; records persist across reload and redeploy (SC-003).

---

## Phase 5: User Story 3 — File and image storage (Priority: P3)

**Goal**: Users upload files/images to Cloudflare R2 and retrieve them by a stable key, with enforced type/size limits — object storage proven separately from structured data.

**Independent Test**: Upload an image, then fetch it via the returned key and confirm it is byte-identical; attempt an oversized/unsupported file and confirm a clear rejection with nothing stored — per spec US3 Independent Test.

- [x] T030 [P] [US3] Implement `backend/src/services/files.service.ts`: validate content type against `ALLOWED_CONTENT_TYPES` (→ `415`) and size against `MAX_UPLOAD_BYTES` (→ `413`) **before** writing, generate a stable key, `put` bytes to R2 via `lib/r2.ts`, return `FileAssetMeta`; `get` streams the object body (FR-013, research Decision 4; no partial writes).
- [x] T031 [US3] Implement `backend/src/routes/files.ts`: `POST /api/files` (multipart parse → `201`/`413`/`415`) and `GET /api/files/:key` (`200` stream / `404`); mount on the app in `backend/src/index.ts` (depends on T030, T016; contract `openapi.yaml`).
- [x] T032 [P] [US3] Implement `frontend/src/components/FileUpload.tsx`: an accessible file input with client-side type/size hinting and error display, uploading via `apiClient.postForm` (FR-013, FR-016).
- [x] T033 [US3] Implement `frontend/src/pages/FilesPage.tsx`: use `FileUpload` to upload, then retrieve and preview a file by its returned key, with clear not-found/rejected states (depends on T032).
- [x] T034 [US3] Register the files route in `frontend/src/App.tsx` and add its nav entry in `Layout.tsx` (depends on T033, T020).

**Checkpoint**: All three user stories are independently functional; upload→retrieve round-trips identically (SC-004).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final quality, accessibility, security, and end-to-end verification across all stories.

- [x] T035 [P] Accessibility pass to WCAG 2.1 AA across `frontend/src/pages/` and `frontend/src/components/`: keyboard navigation, focus order, color contrast, semantic labels/ARIA (FR-016, SC-010).
- [x] T036 [P] Error-message consistency audit: confirm every backend route surfaces failures through `backend/src/middleware/error.ts` as non-leaky `ApiError`s, and every frontend page renders an actionable message with no raw detail (FR-010, SC-009).
- [x] T037 Run ESLint + `tsc --noEmit` (strict) across `backend/`, `frontend/`, and `shared/` and fix all issues so the tree is lint- and type-clean (Constitution Code Quality).
- [x] T038 [P] Secret-scan / no-secrets verification: confirm no credentials exist in source, that `backend/.dev.vars` and `frontend/.env.local` are git-ignored, and that only `*.example` templates are committed (FR-008, SC-007).
- [ ] T039 Execute the [quickstart.md](./quickstart.md) walkthrough end to end (health `ok`; record create → list survives reload; file upload → identical retrieval) and record results (SC-003, SC-004, SC-006; depends on all prior phases).

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies — start immediately (T001 first; T002–T008 parallel).
- **Foundational (Phase 2)**: depends on Setup — **blocks all user stories**.
- **User Stories (Phases 3–5)**: each depends only on Foundational; they are mutually independent and may run in parallel or in priority order P1 → P2 → P3.
- **Polish (Phase 6)**: depends on the user stories being complete (T039 depends on everything).

### Key intra-phase dependencies

- T016 (Hono bootstrap) depends on T013–T015 (middleware).
- T020 (app shell) depends on T017–T019 (client, tokens, types).
- Each story's route mounts into `backend/src/index.ts` (T022, T026, T031) and each story's screen registers in `frontend/src/App.tsx` + `Layout.tsx` (T024, T029, T034) — these shared files are edited sequentially, so those wiring tasks are **not** `[P]` across stories.
- Within a story: service → route; component/page → route registration.

### Parallel opportunities

- Setup: T002–T008 run in parallel.
- Foundational: T009–T015 and T017–T019 run in parallel; T016 and T020 join their respective sides.
- Across stories: once Phase 2 is done, US1, US2, and US3 can be built by different developers simultaneously (each touches its own service/route/pages).
- Within a story, backend service (`[P]`) and frontend page/component (`[P]`) proceed in parallel until the wiring task.

---

## Parallel Example: after Foundational completes

```text
# Backend + frontend of each story in parallel (different files):
Dev A → T021 health.service.ts  → T022 routes/health.ts  → T023/T024 health screen   (US1)
Dev B → T025 records.service.ts → T026 routes/records.ts → T027/T028/T029 records UI (US2)
Dev C → T030 files.service.ts   → T031 routes/files.ts   → T032/T033/T034 files UI   (US3)
```

---

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1 → Phase 2 → Phase 3.
2. **Stop and validate** US1 (live skeleton + `/api/health`), deploy/demo.

### Incremental delivery

1. Setup + Foundational → foundation ready.
2. US1 → test → deploy (**MVP**).
3. US2 → test → deploy (durable records).
4. US3 → test → deploy (file storage).
5. Polish → accessibility, error/lint/secret gates, quickstart verification.

---

## Notes

- **No unit-test tasks** are included (Constitution Principle II + project instructions); no auth exists in this foundation, so no security-flow integration checks are warranted.
- `[P]` = different files, no dependency on another incomplete task.
- `[Story]` labels (US1–US3) map tasks to spec user stories for traceability.
- No secrets in source: all credentials come from Wrangler secrets / `.dev.vars` / Pages env vars (FR-008, SC-007).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
