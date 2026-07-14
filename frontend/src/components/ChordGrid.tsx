import { useState, type DragEvent, type ReactElement } from 'react';
import type { Chord } from '@vii-pass/shared';
import { ChordCard } from './ChordCard';

/**
 * Responsive grid of chord tiles for the selected section (US1). A trailing
 * "add chord" tile (same footprint as a chord) opens the add-chord dialog (US3).
 * Chords are reordered by native drag-and-drop only, and only within their own
 * section — they are never accepted as drop targets by the section tabs. The add
 * tile always stays last.
 *
 * Read-only mode (specs/011-dual-user-roles FR-007): when `readOnly`, the add
 * tile and all drag-and-drop handlers are OMITTED — the grid renders cards only.
 */
export interface ChordGridProps {
  chords: Chord[];
  onAdd: () => void;
  onEdit: (chord: Chord) => void;
  /** Reorder to a new full ordered id list. */
  onReorder: (orderedIds: string[]) => void;
  /** Normal-role session: omit every mutation affordance from the DOM. */
  readOnly?: boolean;
  /**
   * Selected section's hex color, exposed to CSS as `--section-color` on the
   * grid container so chord cards inherit the section's theming ramps
   * (specs/014-section-color-theming FR-001). Purely decorative — never
   * announced to assistive tech and never affects behavior (FR-010). When
   * undefined the stylesheet falls back to `--color-primary`.
   */
  sectionColor?: string;
}

export function ChordGrid({
  chords,
  onAdd,
  onEdit,
  onReorder,
  readOnly = false,
  sectionColor,
}: ChordGridProps): ReactElement {
  const [dragId, setDragId] = useState<string | null>(null);

  function handleDrop(event: DragEvent, targetId: string): void {
    event.preventDefault();
    if (!dragId || dragId === targetId) {
      return;
    }
    const ids = chords.map((c) => c.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) {
      return;
    }
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    setDragId(null);
    onReorder(ids);
  }

  return (
    <div
      className="chord-grid"
      // Custom property keys aren't in React.CSSProperties; cast mirrors SectionTabs.
      style={sectionColor ? { ['--section-color' as string]: sectionColor } : undefined}
    >
      {chords.map((chord) => (
        <div
          key={chord.id}
          className={dragId === chord.id ? 'is-dragging' : undefined}
          draggable={readOnly ? undefined : true}
          onDragStart={
            readOnly
              ? undefined
              : (e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  setDragId(chord.id);
                }
          }
          onDragEnd={readOnly ? undefined : () => setDragId(null)}
          onDragOver={readOnly ? undefined : (e) => e.preventDefault()}
          onDrop={readOnly ? undefined : (e) => handleDrop(e, chord.id)}
        >
          <ChordCard chord={chord} onEdit={() => onEdit(chord)} readOnly={readOnly} />
        </div>
      ))}
      {!readOnly && (
        <button type="button" className="chord-add" onClick={onAdd} aria-label="Add an entry">
          <span aria-hidden="true">＋</span>
        </button>
      )}
    </div>
  );
}
