import { Hono } from 'hono';
import type { AppEnv } from './env';
import { corsMiddleware } from './middleware/cors';
import { onError, toApiError } from './middleware/error';
import { healthRouter } from './routes/health';
import { recordsRouter } from './routes/records';
import { filesRouter } from './routes/files';

/**
 * vii-pass API — Hono application running on Cloudflare Workers.
 *
 * Cross-cutting middleware (CORS, centralized error handling) is wired here.
 * Per-user-story routers are mounted below as they are implemented
 * (US1 health, US2 records, US3 files).
 */
const app = new Hono<AppEnv>();

// Cross-cutting middleware.
app.use('*', corsMiddleware);

// Centralized, non-leaky error handling (FR-010, SC-009).
app.onError(onError);
app.notFound((c) => c.json(toApiError('not_found', 'The requested resource was not found.'), 404));

// --- Per-story routers are mounted here ---
app.route('/api/health', healthRouter);
app.route('/api/records', recordsRouter);
app.route('/api/files', filesRouter);

export default app;
