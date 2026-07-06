import type { HealthReport } from '@vii-pass/shared';
import type { Bindings } from '../env';
import { pingDatabase } from '../lib/mongo';
import { storageReachable } from '../lib/r2';

/**
 * Build a {@link HealthReport} by probing each dependency in parallel (FR-011).
 *
 * The API is `ok` by definition when this runs. Overall status rolls up as:
 * - `ok`      — every dependency reachable
 * - `degraded`— at least one, but not all, dependencies reachable
 * - `down`    — no dependencies reachable
 *
 * Probes never throw (they return booleans), so a single failing dependency
 * still yields a well-formed report rather than an error (research Decision 8).
 */
export async function buildHealthReport(env: Bindings): Promise<HealthReport> {
  const [databaseOk, storageOk] = await Promise.all([
    pingDatabase(env),
    storageReachable(env.BUCKET),
  ]);

  const reachableCount = Number(databaseOk) + Number(storageOk);
  const status: HealthReport['status'] =
    reachableCount === 2 ? 'ok' : reachableCount === 0 ? 'down' : 'degraded';

  return {
    status,
    components: {
      api: 'ok',
      database: databaseOk ? 'ok' : 'down',
      storage: storageOk ? 'ok' : 'down',
    },
    timestamp: new Date().toISOString(),
  };
}
