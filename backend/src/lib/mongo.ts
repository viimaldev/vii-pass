import { MongoClient, type Db } from 'mongodb';

/**
 * MongoDB Atlas access for the Worker runtime.
 *
 * The `MongoClient` is cached at module scope so it is reused across invocations
 * within the same isolate. This avoids paying the TCP + TLS handshake on every
 * request, protecting the p95 latency budget (SC-002, research.md Decision 2).
 *
 * Connectivity relies on the `nodejs_compat` compatibility flag (wrangler.toml).
 */

/** Subset of the Worker bindings this module needs. */
export interface MongoEnv {
  MONGODB_URI: string;
  MONGODB_DB_NAME: string;
}

let cachedClient: MongoClient | undefined;
let connecting: Promise<MongoClient> | undefined;

async function getClient(env: MongoEnv): Promise<MongoClient> {
  if (cachedClient) {
    return cachedClient;
  }
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }
  if (!connecting) {
    connecting = new MongoClient(env.MONGODB_URI).connect();
  }
  cachedClient = await connecting;
  return cachedClient;
}

/** Resolve the target database, connecting (and caching) on first use. */
export async function getDb(env: MongoEnv): Promise<Db> {
  const client = await getClient(env);
  return client.db(env.MONGODB_DB_NAME);
}

/**
 * Lightweight reachability probe used by the health endpoint (FR-011).
 * Returns `true` when a `ping` command succeeds, `false` otherwise — never throws.
 */
export async function pingDatabase(env: MongoEnv): Promise<boolean> {
  try {
    const db = await getDb(env);
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
