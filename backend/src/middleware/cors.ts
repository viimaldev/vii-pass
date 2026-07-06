import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';

/**
 * CORS middleware restricted to the origins configured in `ALLOWED_ORIGINS`
 * (research.md Decision 6, FR-015). Origins are read from the environment on each
 * request because Worker bindings are only available per-invocation.
 */
export const corsMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const origins = (c.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const handler = cors({
    origin: origins,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 86400,
  });

  return handler(c, next);
};
