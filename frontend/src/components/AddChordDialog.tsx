import { useRef, useState, type FormEvent, type ReactElement } from 'react';
import type { Chord, CreateChordRequest } from '@vii-pass/shared';
import { VaultModal } from './VaultModal';

/**
 * Dialog for adding a chord (US3) or editing an existing one (US5). Chord fields
 * are placeholders for now — three generic fields labelled "1", "2", "3". When
 * `chord` is provided the dialog pre-fills those values and edits in place.
 */
export interface AddChordDialogProps {
  /** Existing chord to edit, or undefined to create a new one. */
  chord?: Chord;
  /** Called with the field values on save. */
  onSave: (input: CreateChordRequest) => Promise<void> | void;
  /** Called to delete the chord (edit mode only). */
  onDelete: (chordId: string) => Promise<void> | void;
  /** Called when the dialog is dismissed without saving. */
  onClose: () => void;
}

export function AddChordDialog({
  chord,
  onSave,
  onDelete,
  onClose,
}: AddChordDialogProps): ReactElement {
  const [field1, setField1] = useState(chord?.field1 ?? '');
  const [field2, setField2] = useState(chord?.field2 ?? '');
  const [field3, setField3] = useState(chord?.field3 ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const ids = useRef({
    f1: `chord-field1-${Math.random().toString(36).slice(2)}`,
    f2: `chord-field2-${Math.random().toString(36).slice(2)}`,
    f3: `chord-field3-${Math.random().toString(36).slice(2)}`,
  });

  const isEdit = chord !== undefined;

  /** Convert an input to the stored shape (empty string → null). */
  function toValue(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSave({
        field1: toValue(field1),
        field2: toValue(field2),
        field3: toValue(field3),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the entry.');
      setSubmitting(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!chord) return;
    setSubmitting(true);
    setError(null);
    try {
      await onDelete(chord.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the entry.');
      setSubmitting(false);
    }
  }

  // Confirmation step: deletion is irreversible, so ask before removing (FR-010).
  if (confirmingDelete && chord) {
    return (
      <VaultModal
        title="Delete entry?"
        onClose={onClose}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setConfirmingDelete(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting ? 'Deleting…' : 'Delete entry'}
            </button>
          </>
        }
      >
        <p className="mb-0">This entry will be permanently deleted. This cannot be undone.</p>
        {error && (
          <p className="text-danger small mb-0 mt-3" role="alert">
            {error}
          </p>
        )}
      </VaultModal>
    );
  }

  return (
    <VaultModal
      title={isEdit ? 'Edit entry' : 'New entry'}
      onClose={onClose}
      headerActions={
        isEdit ? (
          <button
            type="button"
            className="vault-modal__icon-btn"
            onClick={() => setConfirmingDelete(true)}
            disabled={submitting}
            aria-label="Delete entry"
            title="Delete entry"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M6.5 1a1 1 0 0 0-1 1V3H2.5a.5.5 0 0 0 0 1h.54l.7 9.1A2 2 0 0 0 6.23 15h3.54a2 2 0 0 0 1.99-1.9L12.46 4H13a.5.5 0 0 0 0-1H10.5V2a1 1 0 0 0-1-1h-3zm0 1h3v1h-3V2zM4.05 4h7.9l-.69 8.98a1 1 0 0 1-1 .92H6.23a1 1 0 0 1-1-.92L4.05 4zM6.5 5.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5z" />
            </svg>
          </button>
        ) : undefined
      }
      footer={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="chord-form"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="chord-form" onSubmit={handleSubmit} noValidate>
        <div className="mb-3">
          <label htmlFor={ids.current.f1} className="form-label">
            1
          </label>
          <input
            id={ids.current.f1}
            type="text"
            className="form-control"
            value={field1}
            onChange={(e) => setField1(e.target.value)}
            maxLength={200}
            autoComplete="off"
          />
        </div>
        <div className="mb-3">
          <label htmlFor={ids.current.f2} className="form-label">
            2
          </label>
          <input
            id={ids.current.f2}
            type="text"
            className="form-control"
            value={field2}
            onChange={(e) => setField2(e.target.value)}
            maxLength={200}
            autoComplete="off"
          />
        </div>
        <div className="mb-2">
          <label htmlFor={ids.current.f3} className="form-label">
            3
          </label>
          <input
            id={ids.current.f3}
            type="text"
            className="form-control"
            value={field3}
            onChange={(e) => setField3(e.target.value)}
            maxLength={200}
            autoComplete="off"
          />
        </div>

        {error && (
          <p className="text-danger small mb-0" role="alert">
            {error}
          </p>
        )}
      </form>
    </VaultModal>
  );
}
