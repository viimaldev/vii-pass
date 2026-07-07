import type { HealthReport } from '@vii-pass/shared';
import type { Bindings } from '../env';
import { pingDatabase } from '../lib/mongo';

/**
 * Build a {@link HealthReport} by probing the database. Retained as an
 * infrastructure-only signal after the user-facing health screen was removed
 * (FR-012).
 *
 * The API is `ok` by definition when this runs. Overall status is `ok` when the
 * database is reachable and `down` otherwise. The probe never throws (it returns
 * a boolean), so a failing database still yields a well-formed report.
 */
export async function buildHealthReport(env: Bindings): Promise<HealthReport> {
  const databaseOk = await pingDatabase(env);

  return {
    status: databaseOk ? 'ok' : 'down',
    components: {
      api: 'ok',
      database: databaseOk ? 'ok' : 'down',
    },
    timestamp: new Date().toISOString(),
  };
}
