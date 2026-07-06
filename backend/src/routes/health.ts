import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { buildHealthReport } from '../services/health.service';

/**
 * Health router — `GET /api/health` (FR-011, US1).
 *
 * Returns a {@link HealthReport} describing the reachability of the API and its
 * dependencies. Always responds `200`; the payload's `status` field conveys
 * whether the system is `ok`, `degraded`, or `down`.
 */
export const healthRouter = new Hono<AppEnv>();

healthRouter.get('/', async (c) => {
  const report = await buildHealthReport(c.env);
  return c.json(report);
});
