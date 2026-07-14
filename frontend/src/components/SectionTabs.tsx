import { useState, type DragEvent, type ReactElement } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useVault } from '../vault/VaultContext';

/** Maximum number of sections; past this the "+" (add) tab is hidden. */
const MAX_SECTIONS = 10;

/**
 * The color-coded section tab strip shown in the app header (US1). Tabs render in
 * stored order and are horizontally scrollable on phones. Reordering is
 * drag-and-drop only. Double-clicking a tab opens its edit dialog (US2/US5). A
 * trailing "+" tab opens the create-section dialog and is hidden once the section
 * limit is reached. Chord tiles are never accepted as drop targets here.
 *
 * Read-only mode (specs/011-dual-user-roles FR-007): normal-role sessions get
 * the same tabs with selection intact, but every mutation affordance — the "+"
 * add tab, drag-and-drop reordering, and double-click editing — is OMITTED from
 * the DOM entirely (not merely disabled).
 */
export function SectionTabs(): ReactElement | null {
  const { user } = useAuth();
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

  // View-only capability: hide every mutation affordance (FR-007).
  const readOnly = user?.role !== 'admin';

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
      {sections.map((section, index) => {
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
            style={{
              ['--section-color' as string]: section.color,
              // Base stacking order: earlier tabs sit behind later ones so each
              // tab tucks behind its right-hand neighbor (the selected tab is
              // lifted above all of these via CSS).
              ['--tab-z' as string]: sections.length - index,
            }}
            title={readOnly ? section.name : `${section.name} (double-click to edit)`}
            draggable={readOnly ? undefined : true}
            onDragStart={readOnly ? undefined : () => setDragId(section.id)}
            onDragEnd={readOnly ? undefined : () => setDragId(null)}
            onDragOver={readOnly ? undefined : (e) => e.preventDefault()}
            onDrop={readOnly ? undefined : (e) => handleDrop(e, section.id)}
            onClick={() => selectSection(section.id)}
            onDoubleClick={readOnly ? undefined : () => openEditSection(section)}
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
      {!readOnly && sections.length < MAX_SECTIONS && (
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
