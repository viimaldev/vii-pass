import { useState, type DragEvent, type ReactElement } from 'react';
import type { Chord } from '@vii-pass/shared';
import { ChordCard } from './ChordCard';

/**
 * Responsive grid of chord tiles for the selected section (US1). A trailing
 * "add chord" tile (same footprint as a chord) opens the add-chord dialog (US3).
 * Chords are reordered by native drag-and-drop only, and only within their own
 * section — they are never accepted as drop targets by the section tabs. The add
 * tile always stays last.
 */
export interface ChordGridProps {
  chords: Chord[];
  onAdd: () => void;
  onEdit: (chord: Chord) => void;
  /** Reorder to a new full ordered id list. */
  onReorder: (orderedIds: string[]) => void;
}

export function ChordGrid({ chords, onAdd, onEdit, onReorder }: ChordGridProps): ReactElement {
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
    <div className="chord-grid">
      {chords.map((chord) => (
        <div
          key={chord.id}
          className={dragId === chord.id ? 'is-dragging' : undefined}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            setDragId(chord.id);
          }}
          onDragEnd={() => setDragId(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, chord.id)}
        >
          <ChordCard chord={chord} onEdit={() => onEdit(chord)} />
        </div>
      ))}
      <button type="button" className="chord-add" onClick={onAdd} aria-label="Add an entry">
        <span aria-hidden="true">＋</span>
      </button>
    </div>
  );
}
