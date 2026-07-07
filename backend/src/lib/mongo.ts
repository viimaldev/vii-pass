import { MongoClient, type Db, type MongoClientOptions } from 'mongodb';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';

/**
 * MongoDB Atlas access for the Worker runtime.
 *
 * IMPORTANT — connection lifetime is PER REQUEST, not module-scoped. The official
 * `mongodb` driver holds a persistent TCP socket, and Cloudflare Workers forbids
 * using a socket created by one request in a different request (per-request I/O
 * isolation). A module-scoped, cross-request client therefore throws
 * "Cannot perform I/O on behalf of a different request" (Worker error 1101) on the
 * second and subsequent requests. To stay correct we open a connection lazily on
 * first use within each request (see {@link getDb}) and close it once the response
 * has been sent (see {@link mongoConnection}). The connection is shared for the
 * duration of a single request via {@link AsyncLocalStorage}.
 *
 * Connectivity relies on the `nodejs_compat` compatibility flag (wrangler.toml).
 */

/** Subset of the Worker bindings this module needs. */
export interface MongoEnv {
  MONGODB_URI: string;
  MONGODB_DB_NAME: string;
}

/** Mutable, request-scoped holder for the lazily-opened client. */
interface RequestMongo {
  clientPromise?: Promise<MongoClient>;
}

const store = new AsyncLocalStorage<RequestMongo>();

/**
 * Fail fast instead of the driver's 30s default so an unreachable database
 * surfaces as a clean error (or `database: down`) rather than hanging until the
 * Workers runtime cancels the request.
 */
const CLIENT_OPTIONS: MongoClientOptions = {
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 8000,
};

/**
 * Return a `waitUntil` that defers work until after the response on Workers, and
 * degrades to a fire-and-forget no-op on the local Node dev runner (which invokes
 * `app.fetch` without an `ExecutionContext`).
 */
function getWaitUntil(c: Context<AppEnv>): (p: Promise<unknown>) => void {
  try {
    const ctx = c.executionCtx;
    return (p) => ctx.waitUntil(p);
  } catch {
    return (p) => void p.catch(() => undefined);
  }
}

/**
 * Hono middleware that scopes a single MongoDB connection to the current request
 * and closes it after the response is sent. Mount this ahead of every route that
 * touches the database (see `index.ts`).
 */
export const mongoConnection: MiddlewareHandler<AppEnv> = async (c, next) => {
  const holder: RequestMongo = {};
  const waitUntil = getWaitUntil(c);
  try {
    await store.run(holder, next);
  } finally {
    const clientPromise = holder.clientPromise;
    if (clientPromise) {
      waitUntil(clientPromise.then((client) => client.close()).catch(() => undefined));
    }
  }
};

/**
 * Resolve the request-scoped database, connecting lazily on first use. Throws if
 * called outside the {@link mongoConnection} middleware or without a configured
 * connection string.
 */
export async function getDb(env: MongoEnv): Promise<Db> {
  const holder = store.getStore();
  if (!holder) {
    throw new Error('MongoDB connection middleware is not installed for this request.');
  }
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }
  if (!holder.clientPromise) {
    holder.clientPromise = new MongoClient(env.MONGODB_URI, CLIENT_OPTIONS).connect();
  }
  const client = await holder.clientPromise;
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
