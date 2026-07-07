import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';

/**
 * CORS middleware restricted to the origins configured in `ALLOWED_ORIGINS`
 * (research.md Decision 4, FR-013). `credentials: true` is required so the browser
 * sends the HttpOnly session cookie on cross-origin API calls. Origins are read
 * from the environment on each request because Worker bindings are only available
 * per-invocation.
 */
export const corsMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const origins = (c.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const handler = cors({
    origin: origins,
    credentials: true,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 86400,
  });

  return handler(c, next);
};
