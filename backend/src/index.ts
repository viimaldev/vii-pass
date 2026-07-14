import { Hono } from 'hono';
import type { AppEnv } from './env';
import { corsMiddleware } from './middleware/cors';
import { onError, toApiError } from './middleware/error';
import { mongoConnection } from './lib/mongo';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { sectionsRouter } from './routes/sections';
import { sectionChordsRouter, chordsRouter } from './routes/chords';
import { vaultRouter } from './routes/vault';

/**
 * vii-pass API — Hono application running on Cloudflare Workers.
 *
 * Cross-cutting middleware (CORS with credentials, centralized error handling) is
 * wired here. `/api/health` is an unauthenticated infrastructure signal; the auth
 * router enforces sessions on its protected routes (`me`, `logout`). Any future
 * data routes MUST be mounted behind `requireSession` so no application data is
 * reachable without a valid session (FR-006).
 */
const app = new Hono<AppEnv>();

// Cross-cutting middleware.
app.use('*', corsMiddleware);

// Scope a MongoDB connection to each API request. Required because the mongodb
// driver's socket cannot be shared across Cloudflare Workers requests; the
// connection is opened lazily on first use and closed after the response.
app.use('/api/*', mongoConnection);

// Centralized, non-leaky error handling (FR-015, SC-004).
app.onError(onError);
app.notFound((c) => c.json(toApiError('not_found', 'The requested resource was not found.'), 404));

// --- Routers ---
// Public infrastructure signal (not a user-facing feature).
app.route('/api/health', healthRouter);
// Authentication + session management (per-route session enforcement).
app.route('/api/auth', authRouter);
// Credential vault: sections (color tabs) and chords (entry tiles). All routes
// are session-protected and strictly user-scoped. The section-scoped chord
// routes mount under `/api/sections` so their paths read `/:sectionId/chords`.
app.route('/api/sections', sectionsRouter);
app.route('/api/sections', sectionChordsRouter);
app.route('/api/chords', chordsRouter);
// Aggregate read: the whole vault (all sections + all chords) in one response,
// loaded once per signed-in page visit (specs/015-vault-perf-caching).
app.route('/api/vault', vaultRouter);

export default app;
