import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { HealthReport } from '../types';
import { ApiClientError, get } from '../services/apiClient';

/** UI state machine for the health check request. */
type LoadState =
  | { status: 'loading' }
  | { status: 'success'; report: HealthReport }
  | { status: 'error'; message: string };

/**
 * Health screen (US1): calls `GET /api/health` on load and on demand, then
 * renders per-component reachability with accessible loading/error states.
 * Failures surface a friendly, actionable message — never a raw error.
 */
export function HealthPage(): ReactElement {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const runCheck = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const report = await get<HealthReport>('/api/health');
      setState({ status: 'success', report });
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : 'Unable to reach the API. Please try again.';
      setState({ status: 'error', message });
    }
  }, []);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  return (
    <section aria-labelledby="health-heading">
      <h1 id="health-heading">System health</h1>
      <p className="text-muted">Live reachability of the API and its dependencies.</p>

      <button
        className="button"
        type="button"
        onClick={() => void runCheck()}
        disabled={state.status === 'loading'}
      >
        {state.status === 'loading' ? 'Checking…' : 'Re-run check'}
      </button>

      <div aria-live="polite" role="status">
        {state.status === 'loading' && <p>Checking system health…</p>}
        {state.status === 'error' && <p className="alert alert--error">{state.message}</p>}
        {state.status === 'success' && <HealthDetails report={state.report} />}
      </div>
    </section>
  );
}

/** Accessible table of component statuses for a successful health report. */
function HealthDetails({ report }: { report: HealthReport }): ReactElement {
  const rows: ReadonlyArray<{ label: string; value: string }> = [
    { label: 'API', value: report.components.api },
    { label: 'Database', value: report.components.database },
    { label: 'Storage', value: report.components.storage },
  ];

  return (
    <div>
      <p>
        Overall status: <strong>{report.status}</strong>
      </p>
      <table>
        <caption className="text-muted">Component reachability</caption>
        <thead>
          <tr>
            <th scope="col">Component</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted">Checked at {new Date(report.timestamp).toLocaleString()}</p>
    </div>
  );
}
