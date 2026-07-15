import { useId, useState, type CSSProperties, type FormEvent, type ReactElement } from 'react';
import type { Chord, ChordField, ChordFieldType, CreateChordRequest } from '@vii-pass/shared';
import { VALUE_LOCKED, VALUE_UNREADABLE } from '../vault/sentinels';
import { Spinner } from './Spinner';
import { VaultModal } from './VaultModal';
import {
  CHORD_FIELD_TYPES,
  CHORD_FIELD_TYPE_ORDER,
  EyeIcon,
  EyeSlashIcon,
} from './chordFieldTypes';

/**
 * Dialog for adding or editing a chord: a required title, an optional URL,
 * and exactly three typed option rows (type dropdown + value). When `chord` is
 * provided the dialog pre-fills everything — including unused rows' remembered
 * types — and edits in place.
 *
 * Since specs/010-credential-encryption this form is the AUTHORITATIVE
 * plaintext validator: values are encrypted before transmission, so the value
 * length cap and the URL normalization/allow-list are enforced here, prior to
 * encryption in VaultContext (the server only sees opaque envelopes).
 */
export interface AddChordDialogProps {
  /** Existing chord to edit, or undefined to create a new one. */
  chord?: Chord;
  /**
   * Hex color of the entry's section (specs/017 contract §3): the chord's own
   * section when editing, the selected section when adding. Styles the primary
   * Save button; when absent the button falls back to the standard primary.
   */
  sectionColor?: string;
  /** Called with the full editable payload on save. */
  onSave: (input: CreateChordRequest) => Promise<void> | void;
  /** Called to delete the chord (edit mode only). */
  onDelete: (chordId: string) => Promise<void> | void;
  /** Called when the dialog is dismissed without saving. */
  onClose: () => void;
}

/** Default row types for a brand-new chord (contracts/chord-card-ui.md). */
const DEFAULT_ROW_TYPES: ChordFieldType[] = ['username', 'password', 'other'];

/** One editable row in local form state (value as raw input text). */
interface RowState {
  type: ChordFieldType;
  value: string;
}

/** Prefill helper: sentinel (unreadable/locked) values must never enter the form. */
function safePrefill(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (value === VALUE_UNREADABLE || value === VALUE_LOCKED) return '';
  return value;
}

/**
 * Authoritative URL normalization (moved client-side from the old server
 * schema): blank → null; scheme-less input gets `https://`; must parse as
 * `http(s)` — every other scheme (`javascript:`, `data:`, …) is rejected
 * BEFORE encryption, keeping unsafe URLs out of the vault (research Decision 9).
 * Returns the normalized URL, `null` for blank, or `undefined` when invalid.
 */
function normalizeUrl(raw: string): string | null | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    if (parsed.href.length > 2048) return undefined;
    return parsed.href;
  } catch {
    return undefined;
  }
}

export function AddChordDialog({
  chord,
  sectionColor,
  onSave,
  onDelete,
  onClose,
}: AddChordDialogProps): ReactElement {
  const [title, setTitle] = useState(chord?.title ?? '');
  const [url, setUrl] = useState(safePrefill(chord?.url));
  const [rows, setRows] = useState<RowState[]>(() =>
    DEFAULT_ROW_TYPES.map((defaultType, i) => ({
      type: chord?.fields[i]?.type ?? defaultType,
      value: safePrefill(chord?.fields[i]?.value),
    })),
  );
  const [titleError, setTitleError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  // Sensitive rows type masked (input type="password") until toggled per row.
  const [revealedRows, setRevealedRows] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const idBase = useId();

  const isEdit = chord !== undefined;

  function updateRow(index: number, patch: Partial<RowState>): void {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    // Client-side validation mirrors the API boundary for instant feedback.
    const trimmedTitle = title.trim();
    const nextTitleError = trimmedTitle.length === 0 ? 'Title is required.' : null;
    const normalizedUrl = normalizeUrl(url);
    const nextUrlError = normalizedUrl === undefined ? 'Enter a valid web address.' : null;
    setTitleError(nextTitleError);
    setUrlError(nextUrlError);
    if (nextTitleError || nextUrlError) return;

    const fields: ChordField[] = rows.map((row) => {
      const value = row.value.trim();
      // ≤200 chars enforced here (and by maxLength) — the server can no longer
      // check plaintext length, it only sees encrypted envelopes.
      return { type: row.type, value: value.length > 0 ? value.slice(0, 200) : null };
    });

    setSubmitting(true);
    try {
      await onSave({ title: trimmedTitle, url: normalizedUrl, fields });
    } catch (err) {
      // Server rejections (e.g. duplicate title 409) surface inline.
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

  // Confirmation step: deletion is irreversible, so ask before removing.
  if (confirmingDelete && chord) {
    return (
      <VaultModal
        title="Delete entry?"
        onClose={onClose}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
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
              {submitting ? (
                <>
                  <Spinner />
                  Deleting…
                </>
              ) : (
                'Delete entry'
              )}
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
      // Scope the section color to the whole dialog: the .btn-section Save
      // button AND the form-control focus styles read it via var() fallbacks.
      style={
        sectionColor ? ({ '--section-color': sectionColor } as CSSProperties) : undefined
      }
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
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="chord-form"
            className={sectionColor ? 'btn btn-section' : 'btn btn-primary'}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Spinner />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </button>
        </>
      }
    >
      <form id="chord-form" onSubmit={handleSubmit} noValidate>
        <div className="mb-3">
          <label htmlFor={`${idBase}-title`} className="form-label">
            Title
          </label>
          <input
            id={`${idBase}-title`}
            type="text"
            className={`form-control${titleError ? ' is-invalid' : ''}`}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError) setTitleError(null);
            }}
            maxLength={100}
            required
            autoComplete="off"
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? `${idBase}-title-error` : undefined}
          />
          {titleError && (
            <p id={`${idBase}-title-error`} className="invalid-feedback d-block mb-0" role="alert">
              {titleError}
            </p>
          )}
        </div>

        <div className="mb-3">
          <label htmlFor={`${idBase}-url`} className="form-label">
            URL <span className="text-muted fw-normal">(optional, opened from the title)</span>
          </label>
          <input
            id={`${idBase}-url`}
            type="text"
            inputMode="url"
            className={`form-control${urlError ? ' is-invalid' : ''}`}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (urlError) setUrlError(null);
            }}
            maxLength={2048}
            autoComplete="off"
            aria-invalid={urlError ? true : undefined}
            aria-describedby={urlError ? `${idBase}-url-error` : undefined}
          />
          {urlError && (
            <p id={`${idBase}-url-error`} className="invalid-feedback d-block mb-0" role="alert">
              {urlError}
            </p>
          )}
        </div>

        {rows.map((row, index) => {
          const isSensitive = CHORD_FIELD_TYPES[row.type].isSensitive;
          const isRevealed = revealedRows[index] ?? false;
          return (
            <div
              className={index < rows.length - 1 ? 'chord-form-row mb-3' : 'chord-form-row mb-2'}
              key={index}
            >
              <span className="chord-form-row__icon" aria-hidden="true">
                {CHORD_FIELD_TYPES[row.type].icon}
              </span>
              <select
                className="form-select chord-form-row__type"
                value={row.type}
                onChange={(e) => updateRow(index, { type: e.target.value as ChordFieldType })}
                aria-label={`Type for option ${index + 1}`}
              >
                {CHORD_FIELD_TYPE_ORDER.map((type) => (
                  <option key={type} value={type}>
                    {CHORD_FIELD_TYPES[type].label}
                  </option>
                ))}
              </select>
              <div
                className={`chord-form-row__value${
                  isSensitive ? ' chord-form-row__value--sensitive' : ''
                }`}
              >
                <input
                  type={isSensitive && !isRevealed ? 'password' : 'text'}
                  className="form-control"
                  value={row.value}
                  onChange={(e) => updateRow(index, { value: e.target.value })}
                  maxLength={200}
                  autoComplete="off"
                  aria-label={`Value for option ${index + 1}`}
                />
                {isSensitive && (
                  <button
                    type="button"
                    className="chord-form-row__reveal"
                    onClick={() =>
                      setRevealedRows((prev) => ({ ...prev, [index]: !isRevealed }))
                    }
                    aria-label={
                      isRevealed
                        ? `Hide value for option ${index + 1}`
                        : `Show value for option ${index + 1}`
                    }
                    aria-pressed={isRevealed}
                    title={isRevealed ? 'Hide' : 'Show'}
                  >
                    {isRevealed ? EyeSlashIcon : EyeIcon}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {error && (
          <p className="text-danger small mb-0" role="alert">
            {error}
          </p>
        )}
      </form>
    </VaultModal>
  );
}
