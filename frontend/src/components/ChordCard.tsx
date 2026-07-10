import { useState, type ReactElement } from 'react';
import type { Chord } from '@vii-pass/shared';

/**
 * A single chord tile (US1) with show/copy/edit affordances (US5). Chord fields
 * are placeholders ("1", "2", "3") for now; each value can be revealed, copied to
 * the clipboard, and the whole chord can be edited. Reordering is drag-and-drop
 * only (handled by the enclosing grid).
 */
export interface ChordCardProps {
  chord: Chord;
  /** Open the edit dialog for this chord. */
  onEdit: () => void;
}

/** Placeholder field definitions rendered on every chord tile. */
const FIELDS: { key: 'field1' | 'field2' | 'field3'; label: string }[] = [
  { key: 'field1', label: '1' },
  { key: 'field2', label: '2' },
  { key: 'field3', label: '3' },
];

export function ChordCard({
  chord,
  onEdit,
}: ChordCardProps): ReactElement {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const title = chord.field1?.trim() || `Entry ${chord.position + 1}`;

  async function copyValue(key: string, value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context); silently ignore.
    }
  }

  return (
    <div className="chord-card">
      <div className="chord-card__header">
        <h3 className="chord-card__title" title={title}>
          {title}
        </h3>
        <div className="chord-card__actions">
          <button
            type="button"
            className="chord-card__icon-btn"
            onClick={onEdit}
            aria-label={`Edit ${title}`}
            title="Edit"
          >
            ✎
          </button>
        </div>
      </div>
      <div className="chord-card__body">
        {FIELDS.map(({ key, label }) => {
          const value = chord[key];
          const isRevealed = revealed[key] ?? false;
          const hasValue = value !== null && value !== '';
          return (
            <div className="chord-field" key={key}>
              <span className="visually-hidden">Field {label}:</span>
              <span
                className={`chord-field__value${hasValue ? '' : ' chord-field__value--empty'}`}
              >
                {hasValue ? (isRevealed ? value : '••••••••') : 'Empty'}
              </span>
              {hasValue && (
                <>
                  <button
                    type="button"
                    className="chord-field__btn"
                    onClick={() => setRevealed((r) => ({ ...r, [key]: !isRevealed }))}
                    aria-label={isRevealed ? `Hide field ${label}` : `Show field ${label}`}
                    aria-pressed={isRevealed}
                    title={isRevealed ? 'Hide' : 'Show'}
                  >
                    {isRevealed ? '🙈' : '👁'}
                  </button>
                  <button
                    type="button"
                    className="chord-field__btn"
                    onClick={() => copyValue(key, value)}
                    aria-label={`Copy field ${label}`}
                    title="Copy"
                  >
                    {copied === key ? '✓' : '⧉'}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
