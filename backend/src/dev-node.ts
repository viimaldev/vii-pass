/**
 * Local Node.js runner for the vii-pass API (development only).
 *
 * The API targets Cloudflare Workers, but `wrangler dev` in local mode cannot
 * reuse the module-scoped MongoDB TCP socket across requests — Miniflare enforces
 * per-request I/O isolation, so only the first database call after each reload
 * succeeds and the next one hangs. This runner serves the exact same Hono app on
 * Node, where the official `mongodb` driver's connection pooling works normally,
 * giving a reliable local dev loop without deploying.
 *
 * Production still runs on Workers via `wrangler deploy`; this file is never
 * bundled into the Worker (it is not imported by `src/index.ts`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import app from './index';
import type { Bindings } from './env';

/** Parse a dotenv-style `.dev.vars` file into a key/value record. */
function loadDevVars(fileUrl: URL): Record<string, string> {
  let contents: string;
  try {
    contents = readFileSync(fileURLToPath(fileUrl), 'utf8');
  } catch {
    return {};
  }

  const vars: Record<string, string> = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const fileVars = loadDevVars(new URL('../.dev.vars', import.meta.url));
/** File values are the base; real process env overrides them when present. */
const source: Record<string, string | undefined> = { ...fileVars, ...process.env };

/**
 * The Worker `Bindings` include a dormant R2 `BUCKET` (unused by any current
 * route). A throwing stub keeps the type honest without a real R2 implementation.
 */
const bucketStub = new Proxy(
  {},
  {
    get() {
      throw new Error('R2 BUCKET is not available in the local Node dev runner.');
    },
  },
);

const env = {
  BUCKET: bucketStub,
  MONGODB_URI: source.MONGODB_URI ?? '',
  MONGODB_DB_NAME: source.MONGODB_DB_NAME ?? 'vii_pass',
  ALLOWED_ORIGINS: source.ALLOWED_ORIGINS ?? 'http://localhost:5173',
  SESSION_IDLE_TTL_SECONDS: source.SESSION_IDLE_TTL_SECONDS ?? '1800',
  SESSION_ABSOLUTE_TTL_SECONDS: source.SESSION_ABSOLUTE_TTL_SECONDS ?? '86400',
  PBKDF2_ITERATIONS: source.PBKDF2_ITERATIONS ?? '600000',
  VAULT_ENC_KEY: source.VAULT_ENC_KEY ?? '',
  SALT_DECOY_PEPPER: source.SALT_DECOY_PEPPER ?? '',
  COOKIE_DOMAIN: source.COOKIE_DOMAIN,
} as unknown as Bindings;

const port = Number.parseInt(process.env.PORT ?? '8787', 10);

serve({ fetch: (request) => app.fetch(request, env), port }, (info) => {
  console.log(`vii-pass API (Node dev) listening on http://localhost:${info.port}`);
});
