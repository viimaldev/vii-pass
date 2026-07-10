import { useState, type DragEvent, type ReactElement } from 'react';
import { useVault } from '../vault/VaultContext';

/** Maximum number of sections; past this the "+" (add) tab is hidden. */
const MAX_SECTIONS = 10;

/**
 * The color-coded section tab strip shown in the app header (US1). Tabs render in
 * stored order and are horizontally scrollable on phones. Reordering is
 * drag-and-drop only. Double-clicking a tab opens its edit dialog (US2/US5). A
 * trailing "+" tab opens the create-section dialog and is hidden once the section
 * limit is reached. Chord tiles are never accepted as drop targets here.
 */
export function SectionTabs(): ReactElement | null {
  const {
    sections,
    selectedId,
    ready,
    selectSection,
    openAddSection,
    openEditSection,
    reorderSections,
  } = useVault();
  const [dragId, setDragId] = useState<string | null>(null);

  if (!ready || sections.length === 0) {
    return null;
  }

  function handleDrop(event: DragEvent, targetId: string): void {
    event.preventDefault();
    if (!dragId || dragId === targetId) {
      return;
    }
    const ids = sections.map((s) => s.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) {
      return;
    }
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    setDragId(null);
    reorderSections(ids);
  }

  return (
    <div className="section-tabs" role="tablist" aria-label="Credential sections">
      {sections.map((section) => {
        const isSelected = section.id === selectedId;
        return (
          <div
            key={section.id}
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className={`section-tab${isSelected ? ' is-selected' : ''}${
              dragId === section.id ? ' is-dragging' : ''
            }`}
            style={{ ['--section-color' as string]: section.color }}
            title={`${section.name} (double-click to edit)`}
            draggable
            onDragStart={() => setDragId(section.id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, section.id)}
            onClick={() => selectSection(section.id)}
            onDoubleClick={() => openEditSection(section)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectSection(section.id);
              }
            }}
          >
            <span className="section-tab__label">{section.name}</span>
          </div>
        );
      })}
      {sections.length < MAX_SECTIONS && (
        <button
          type="button"
          className="section-tab section-tab--add"
          onClick={openAddSection}
          aria-label="Add a section"
          title="Add a section"
        >
          +
        </button>
      )}
    </div>
  );
}
