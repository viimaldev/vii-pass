import { type ReactElement } from 'react';
import { ChordGrid } from '../components/ChordGrid';
import { useVault } from '../vault/VaultContext';

/**
 * Authenticated vault surface (US1–US5). The section tabs live in the app header
 * (see {@link Layout}); this page renders the chords of the selected section from
 * the shared {@link useVault} state and lets the user add, edit, delete, and
 * reorder them. Only reachable through `ProtectedRoute`, so a user is always
 * present.
 */
export function HomePage(): ReactElement {
  const {
    chords,
    loading,
    chordsLoading,
    error,
    openAddChord,
    openEditChord,
    reorderChords,
  } = useVault();

  return (
    <div className="vault-page flex-grow-1 d-flex flex-column">
      <div className="vault-page__inner container-fluid py-3 d-flex flex-column flex-grow-1">
        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-muted">Loading your sections…</p>
        ) : (
          <>
            {chordsLoading ? (
              <p className="text-muted">Loading entries…</p>
            ) : (
              <div className="chord-scroll">
                <ChordGrid
                  chords={chords}
                  onAdd={openAddChord}
                  onEdit={openEditChord}
                  onReorder={reorderChords}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
