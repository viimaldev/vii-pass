import { useRef, useState, type FormEvent, type ReactElement } from 'react';
import type { CreateSectionRequest, Section } from '@vii-pass/shared';
import { Spinner } from './Spinner';
import { VaultModal } from './VaultModal';

/**
 * Dialog for creating a new section or editing an existing one (US2/US5). Presents
 * a required name and a color picker (native input + quick swatches). In edit mode
 * the fields are pre-filled and a Delete action is available for non-default
 * sections; deleting first asks for confirmation because it also removes every
 * credential in the section (cascade). Save is blocked while the name is empty.
 */

/** Curated palette of visually distinct, on-brand tab colors. */
const PALETTE = [
  '#0b5cad',
  '#1a7f37',
  '#b42318',
  '#8250df',
  '#bc4c00',
  '#0969da',
  '#cf222e',
  '#1f883d',
  '#9a6700',
  '#6639ba',
];

/** Pick a random color from the palette (the create dialog's default selection). */
function randomColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

export interface SectionDialogProps {
  /** Existing section to edit, or undefined to create a new one. */
  section?: Section;
  /** Called with the section's name + color when the user saves. */
  onSave: (input: CreateSectionRequest) => Promise<void> | void;
  /** Called to delete the section (edit mode, non-default only). */
  onDelete: (sectionId: string) => Promise<void> | void;
  /** Called when the dialog is dismissed without saving. */
  onClose: () => void;
}

export function SectionDialog({
  section,
  onSave,
  onDelete,
  onClose,
}: SectionDialogProps): ReactElement {
  const isEdit = section !== undefined;
  const [name, setName] = useState(section?.name ?? '');
  const [color, setColor] = useState<string>(() => section?.color ?? randomColor());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const nameId = useRef(`section-name-${Math.random().toString(36).slice(2)}`);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && !submitting;
  const canDelete = isEdit && !section?.isDefault;

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!trimmed) {
      setError('Section name is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSave({ name: trimmed, color });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the section.');
      setSubmitting(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!section) return;
    setSubmitting(true);
    setError(null);
    try {
      await onDelete(section.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the section.');
      setSubmitting(false);
    }
  }

  // Confirmation step: warn that deleting also removes all credentials.
  if (confirmingDelete && section) {
    return (
      <VaultModal
        title="Delete section?"
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
                'Delete section'
              )}
            </button>
          </>
        }
      >
        <p className="mb-0">
          Deleting <strong>{section.name}</strong> will permanently delete all the credentials in
          this section. This cannot be undone.
        </p>
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
      title={isEdit ? 'Edit section' : 'New section'}
      onClose={onClose}
      headerActions={
        canDelete ? (
          <button
            type="button"
            className="vault-modal__icon-btn"
            onClick={() => setConfirmingDelete(true)}
            disabled={submitting}
            aria-label="Delete section"
            title="Delete section"
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
            form="section-form"
            className="btn btn-primary"
            disabled={!canSave}
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
      <form id="section-form" onSubmit={handleSubmit} noValidate>
        <div className="mb-3">
          <label htmlFor={nameId.current} className="form-label">
            Section name<span aria-hidden="true"> *</span>
          </label>
          <input
            id={nameId.current}
            type="text"
            className={`form-control${error && !trimmed ? ' is-invalid' : ''}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            autoComplete="off"
            aria-required="true"
            aria-invalid={error && !trimmed ? true : undefined}
          />
        </div>

        <div className="mb-2">
          <label htmlFor="section-color" className="form-label">
            Color
          </label>
          <div className="d-flex align-items-center gap-3">
            <input
              id="section-color"
              type="color"
              className="form-control form-control-color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              title="Choose a section color"
            />
            <div className="color-swatches" role="group" aria-label="Preset colors">
              {PALETTE.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  className={`color-swatch${swatch === color ? ' is-selected' : ''}`}
                  style={{ background: swatch }}
                  aria-label={`Use color ${swatch}`}
                  aria-pressed={swatch === color}
                  onClick={() => setColor(swatch)}
                />
              ))}
            </div>
          </div>
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
