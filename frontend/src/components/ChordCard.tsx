import { useState, type ReactElement } from 'react';
import type { Chord } from '@vii-pass/shared';
import {
  CHORD_FIELD_TYPES,
  CheckIcon,
  CopyIcon,
  CrossIcon,
  EyeIcon,
  EyeSlashIcon,
  LinkIcon,
} from './chordFieldTypes';

/**
 * A single chord tile. The header shows the title — rendered as a safe
 * new-tab link when the chord has a URL (the URL text itself is never
 * displayed) — with a copy-link button immediately before the edit button.
 * Each filled option row shows its type icon and value: sensitive types
 * (password, other sensitive) are masked with an eye toggle + copy, others get
 * copy only. Reveal state is local, so every re-render starts masked (FR-012).
 * Reordering is drag-and-drop only (handled by the enclosing grid).
 */
export interface ChordCardProps {
  chord: Chord;
  /** Open the edit dialog for this chord. */
  onEdit: () => void;
}

/** Fixed-length mask that never leaks the value's real length. */
const MASK = '••••••••';

/** Result of a copy attempt, keyed per control for transient feedback. */
type CopyState = { key: string; ok: boolean };

export function ChordCard({ chord, onEdit }: ChordCardProps): ReactElement {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState<CopyState | null>(null);

  /**
   * Copy `value` and flash success/failure on the control identified by `key`.
   * Failure (clipboard denied/unavailable) is surfaced, never silent (FR-011).
   */
  async function copyValue(key: string, value: string): Promise<void> {
    let ok = true;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      ok = false;
    }
    setCopied({ key, ok });
    window.setTimeout(() => setCopied((c) => (c?.key === key ? null : c)), 1500);
  }

  /** Feedback glyph for a copy control, falling back to the copy icon. */
  function copyGlyph(key: string): ReactElement {
    if (copied?.key === key) {
      return copied.ok ? CheckIcon : CrossIcon;
    }
    return CopyIcon;
  }

  return (
    <div className="chord-card">
      <div className="chord-card__header">
        {chord.url ? (
          // Safe stored link: the schema restricts url to http(s), and
          // noopener+noreferrer prevents the opened page from reaching back.
          <a
            className="chord-card__title chord-card__title--link"
            href={chord.url}
            target="_blank"
            rel="noopener noreferrer"
            title={chord.title}
          >
            {chord.title}
          </a>
        ) : (
          <h3 className="chord-card__title" title={chord.title}>
            {chord.title}
          </h3>
        )}
        <div className="chord-card__actions">
          {chord.url && (
            <button
              type="button"
              className="chord-card__icon-btn"
              onClick={() => copyValue('link', chord.url as string)}
              aria-label={`Copy link for ${chord.title}`}
              title="Copy link"
            >
              {copied?.key === 'link' ? (copied.ok ? CheckIcon : CrossIcon) : LinkIcon}
            </button>
          )}
          <button
            type="button"
            className="chord-card__icon-btn"
            onClick={onEdit}
            aria-label={`Edit ${chord.title}`}
            title="Edit"
          >
            ✎
          </button>
        </div>
      </div>
      <div className="chord-card__body">
        {chord.fields.map((field, index) => {
          if (field.value === null || field.value === '') {
            return null; // Unused row: not rendered on the card.
          }
          const meta = CHORD_FIELD_TYPES[field.type];
          const isRevealed = meta.isSensitive ? (revealed[index] ?? false) : true;
          const copyKey = `field-${index}`;
          return (
            <div className="chord-field" key={index}>
              <span className="chord-field__icon" aria-hidden="true">
                {meta.icon}
              </span>
              <span className="visually-hidden">{meta.label}:</span>
              <span
                className={`chord-field__value${
                  meta.isSensitive && !isRevealed ? ' chord-field__value--masked' : ''
                }`}
              >
                {isRevealed ? field.value : MASK}
              </span>
              {meta.isSensitive && (
                <button
                  type="button"
                  className="chord-field__btn"
                  onClick={() => setRevealed((r) => ({ ...r, [index]: !isRevealed }))}
                  aria-label={isRevealed ? `Hide ${meta.label}` : `Show ${meta.label}`}
                  aria-pressed={isRevealed}
                  title={isRevealed ? 'Hide' : 'Show'}
                >
                  {isRevealed ? EyeSlashIcon : EyeIcon}
                </button>
              )}
              <button
                type="button"
                className="chord-field__btn"
                onClick={() => copyValue(copyKey, field.value as string)}
                aria-label={`Copy ${meta.label}`}
                title="Copy"
              >
                {copyGlyph(copyKey)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
