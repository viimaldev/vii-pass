import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { RecordListResponse, StoredRecord } from '../types';
import { ApiClientError, get } from '../services/apiClient';
import { RecordForm } from '../components/RecordForm';

/** State of the records list request. */
type ListState =
  | { status: 'loading' }
  | { status: 'success'; items: StoredRecord[] }
  | { status: 'error'; message: string };

/** State of the single-record detail request. */
type DetailState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; record: StoredRecord }
  | { status: 'error'; message: string };

/**
 * Records screen (US2): create records with {@link RecordForm}, list them, and
 * view a selected record's detail via `GET /api/records/:id`. Includes empty,
 * loading, and error states.
 */
export function RecordsPage(): ReactElement {
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [detail, setDetail] = useState<DetailState>({ status: 'idle' });

  const loadRecords = useCallback(async () => {
    setList({ status: 'loading' });
    try {
      const page = await get<RecordListResponse>('/api/records');
      setList({ status: 'success', items: page.items });
    } catch (error) {
      setList({
        status: 'error',
        message: error instanceof ApiClientError ? error.message : 'Could not load records.',
      });
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const handleCreated = useCallback((record: StoredRecord) => {
    setList((prev) =>
      prev.status === 'success' ? { status: 'success', items: [record, ...prev.items] } : prev,
    );
  }, []);

  const viewRecord = useCallback(async (id: string) => {
    setDetail({ status: 'loading' });
    try {
      const record = await get<StoredRecord>(`/api/records/${id}`);
      setDetail({ status: 'success', record });
    } catch (error) {
      setDetail({
        status: 'error',
        message: error instanceof ApiClientError ? error.message : 'Could not load that record.',
      });
    }
  }, []);

  return (
    <section aria-labelledby="records-heading">
      <h1 id="records-heading">Records</h1>

      <RecordForm onCreated={handleCreated} />

      <h2>Saved records</h2>
      <div aria-live="polite">
        {list.status === 'loading' && <p>Loading records…</p>}
        {list.status === 'error' && <p className="alert alert--error">{list.message}</p>}
        {list.status === 'success' && list.items.length === 0 && (
          <p className="text-muted">No records yet. Create your first one above.</p>
        )}
        {list.status === 'success' && list.items.length > 0 && (
          <ul className="record-list">
            {list.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => void viewRecord(item.id)}
                >
                  {item.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div aria-live="polite">
        {detail.status === 'loading' && <p>Loading record…</p>}
        {detail.status === 'error' && <p className="alert alert--error">{detail.message}</p>}
        {detail.status === 'success' && (
          <article aria-label={`Record: ${detail.record.title}`}>
            <h2>{detail.record.title}</h2>
            {detail.record.content ? (
              <p>{detail.record.content}</p>
            ) : (
              <p className="text-muted">No content.</p>
            )}
            <p className="text-muted">
              Created {new Date(detail.record.createdAt).toLocaleString()}
            </p>
          </article>
        )}
      </div>
    </section>
  );
}
