import { useState, type ReactElement } from 'react';
import type { Chord } from '@vii-pass/shared';
import { VALUE_LOCKED, VALUE_UNREADABLE } from '../vault/sentinels';
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
 *
 * Encryption states (specs/010-credential-encryption): a field whose value is
 * the unreadable sentinel renders an inline "could not be read" error with
 * eye/copy disabled for that field only (FR-007); while the vault is locked
 * every value renders as a plain mask with controls disabled. The decrypted
 * URL is re-checked against the `http(s)` allow-list before use as an `href` —
 * the stored-XSS boundary now sits at decrypt-render (research Decision 9).
 *
 * Read-only mode (specs/011-dual-user-roles FR-007): when `readOnly`, the edit
 * button is OMITTED from the DOM; copy-link, reveal (eye), and copy-value stay
 * identical to admin sessions.
 */
export interface ChordCardProps {
  chord: Chord;
  /** Open the edit dialog for this chord. */
  onEdit: () => void;
  /** Normal-role session: omit the edit affordance from the DOM. */
  readOnly?: boolean;
}

/** Fixed-length mask that never leaks the value's real length. */
const MASK = '••••••••';

/** Result of a copy attempt, keyed per control for transient feedback. */
type CopyState = { key: string; ok: boolean };

/**
 * Return a URL safe to use as an `href`, or `null`. Values are re-validated
 * after decryption: anything that is a sentinel, fails to parse, or is not
 * `http(s)` never becomes a link.
 */
function safeHref(url: string | null): string | null {
  if (url === null || url === VALUE_UNREADABLE || url === VALUE_LOCKED) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function ChordCard({ chord, onEdit, readOnly = false }: ChordCardProps): ReactElement {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState<CopyState | null>(null);

  // Re-validated at decrypt-render: only http(s) URLs ever become links.
  const href = safeHref(chord.url);

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
        {href ? (
          // Safe stored link: only allow-listed http(s) URLs reach this branch,
          // and noopener+noreferrer prevents the opened page from reaching back.
          <a
            className="chord-card__title chord-card__title--link"
            href={href}
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
          {chord.url === VALUE_UNREADABLE && (
            <span className="chord-field__error small" role="status">
              Link could not be read
            </span>
          )}
          {href && (
            <button
              type="button"
              className="chord-card__icon-btn"
              onClick={() => copyValue('link', href)}
              aria-label={`Copy link for ${chord.title}`}
              title="Copy link"
            >
              {copied?.key === 'link' ? (copied.ok ? CheckIcon : CrossIcon) : LinkIcon}
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              className="chord-card__icon-btn"
              onClick={onEdit}
              aria-label={`Edit ${chord.title}`}
              title="Edit"
            >
              ✎
            </button>
          )}
        </div>
      </div>
      <div className="chord-card__body">
        {chord.fields.map((field, index) => {
          if (field.value === null || field.value === '') {
            return null; // Unused row: not rendered on the card.
          }
          const meta = CHORD_FIELD_TYPES[field.type];

          // Per-field decrypt failure: inline error, eye/copy disabled for this
          // row only — the rest of the card stays fully usable (FR-007).
          if (field.value === VALUE_UNREADABLE) {
            return (
              <div className="chord-field" key={index}>
                <span className="chord-field__icon" aria-hidden="true">
                  {meta.icon}
                </span>
                <span className="visually-hidden">{meta.label}:</span>
                <span className="chord-field__value chord-field__error" role="status">
                  This value could not be read
                </span>
              </div>
            );
          }

          // Locked vault: values render masked with controls withheld (US2).
          if (field.value === VALUE_LOCKED) {
            return (
              <div className="chord-field" key={index}>
                <span className="chord-field__icon" aria-hidden="true">
                  {meta.icon}
                </span>
                <span className="visually-hidden">{meta.label}:</span>
                <span className="chord-field__value chord-field__value--masked">{MASK}</span>
              </div>
            );
          }

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
