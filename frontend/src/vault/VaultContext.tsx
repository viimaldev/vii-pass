import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { Chord, CreateChordRequest, CreateSectionRequest, Section } from '@vii-pass/shared';
import { useAuth } from '../auth/AuthContext';
import * as vaultApi from '../services/vaultApi';
import { SectionDialog } from '../components/SectionDialog';
import { AddChordDialog } from '../components/AddChordDialog';

/**
 * Vault state shared across the app shell (US1–US5). The section tabs live in the
 * top header (rendered by {@link Layout}) while the chord grid lives on the home
 * page, so the sections/selection/chords state is lifted here into a single
 * provider. Only fetches when a user is signed in; clears when they sign out.
 */
interface VaultContextValue {
  sections: Section[];
  selectedId: string | null;
  chords: Chord[];
  loading: boolean;
  chordsLoading: boolean;
  error: string | null;
  /** True once the initial sections load has completed for a signed-in user. */
  ready: boolean;
  selectSection: (id: string) => void;
  openAddSection: () => void;
  openEditSection: (section: Section) => void;
  reorderSections: (orderedIds: string[]) => void;
  openAddChord: () => void;
  openEditChord: (chord: Chord) => void;
  reorderChords: (orderedIds: string[]) => void;
}

const VaultContext = createContext<VaultContextValue | undefined>(undefined);

/** Access the vault context; throws if used outside {@link VaultProvider}. */
export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error('useVault must be used within a VaultProvider.');
  }
  return ctx;
}

/** Provider that owns sections + chords state and renders the vault dialogs. */
export function VaultProvider({ children }: { children: ReactNode }): ReactElement {
  const { user } = useAuth();

  const [sections, setSections] = useState<Section[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chords, setChords] = useState<Chord[]>([]);
  const [loading, setLoading] = useState(false);
  const [chordsLoading, setChordsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Dialog state.
  const [sectionDialog, setSectionDialog] = useState<{ mode: 'add' | 'edit'; section?: Section } | null>(
    null,
  );
  const [chordDialog, setChordDialog] = useState<{ chord?: Chord } | null>(null);

  // Load sections when the signed-in user changes; clear on sign-out.
  useEffect(() => {
    if (!user) {
      setSections([]);
      setSelectedId(null);
      setChords([]);
      setReady(false);
      return;
    }
    let active = true;
    setLoading(true);
    setReady(false);
    void (async () => {
      try {
        const loaded = await vaultApi.listSections();
        if (!active) return;
        setSections(loaded);
        setSelectedId(loaded[0]?.id ?? null);
        setReady(true);
      } catch {
        if (active) setError('Could not load your sections. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  // Load the selected section's chords whenever the selection changes.
  const loadChords = useCallback(async (sectionId: string) => {
    setChordsLoading(true);
    try {
      const loaded = await vaultApi.listChords(sectionId);
      setChords(loaded);
    } catch {
      setError('Could not load entries for this section.');
    } finally {
      setChordsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadChords(selectedId);
    } else {
      setChords([]);
    }
  }, [selectedId, loadChords]);

  const reorderSections = useCallback(
    async (orderedIds: string[]) => {
      const byId = new Map(sections.map((s) => [s.id, s]));
      setSections(
        orderedIds
          .map((id, i) => {
            const s = byId.get(id);
            return s ? { ...s, position: i } : undefined;
          })
          .filter((s): s is Section => s !== undefined),
      );
      try {
        const updated = await vaultApi.reorderSections(orderedIds);
        setSections(updated);
      } catch {
        setError('Could not save the section order.');
      }
    },
    [sections],
  );

  const reorderChords = useCallback(
    async (orderedIds: string[]) => {
      if (!selectedId) return;
      const byId = new Map(chords.map((c) => [c.id, c]));
      setChords(
        orderedIds
          .map((id, i) => {
            const c = byId.get(id);
            return c ? { ...c, position: i } : undefined;
          })
          .filter((c): c is Chord => c !== undefined),
      );
      try {
        const updated = await vaultApi.reorderChords(selectedId, orderedIds);
        setChords(updated);
      } catch {
        setError('Could not save the entry order.');
      }
    },
    [selectedId, chords],
  );

  async function handleSaveSection(input: CreateSectionRequest): Promise<void> {
    if (sectionDialog?.mode === 'edit' && sectionDialog.section) {
      const updated = await vaultApi.updateSection(sectionDialog.section.id, input);
      setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } else {
      const created = await vaultApi.createSection(input);
      setSections((prev) => [...prev, created]);
      setSelectedId(created.id);
    }
    setSectionDialog(null);
  }

  async function handleDeleteSection(sectionId: string): Promise<void> {
    await vaultApi.deleteSection(sectionId);
    setSections((prev) => {
      const remaining = prev.filter((s) => s.id !== sectionId);
      // Activate the first remaining section when the active one was deleted.
      setSelectedId((current) =>
        current === sectionId ? (remaining[0]?.id ?? null) : current,
      );
      return remaining;
    });
    setSectionDialog(null);
  }

  async function handleSaveChord(input: CreateChordRequest): Promise<void> {
    if (!selectedId) return;
    if (chordDialog?.chord) {
      const updated = await vaultApi.updateChord(chordDialog.chord.id, input);
      setChords((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } else {
      const created = await vaultApi.createChord(selectedId, input);
      setChords((prev) => [...prev, created]);
    }
    setChordDialog(null);
  }

  async function handleDeleteChord(chordId: string): Promise<void> {
    await vaultApi.deleteChord(chordId);
    setChords((prev) => prev.filter((c) => c.id !== chordId));
    setChordDialog(null);
  }

  const value = useMemo<VaultContextValue>(
    () => ({
      sections,
      selectedId,
      chords,
      loading,
      chordsLoading,
      error,
      ready,
      selectSection: setSelectedId,
      openAddSection: () => setSectionDialog({ mode: 'add' }),
      openEditSection: (section) => setSectionDialog({ mode: 'edit', section }),
      reorderSections,
      openAddChord: () => setChordDialog({}),
      openEditChord: (chord) => setChordDialog({ chord }),
      reorderChords,
    }),
    [sections, selectedId, chords, loading, chordsLoading, error, ready, reorderSections, reorderChords],
  );

  return (
    <VaultContext.Provider value={value}>
      {children}

      {sectionDialog && (
        <SectionDialog
          section={sectionDialog.mode === 'edit' ? sectionDialog.section : undefined}
          onSave={handleSaveSection}
          onDelete={handleDeleteSection}
          onClose={() => setSectionDialog(null)}
        />
      )}

      {chordDialog && (
        <AddChordDialog
          chord={chordDialog.chord}
          onSave={handleSaveChord}
          onDelete={handleDeleteChord}
          onClose={() => setChordDialog(null)}
        />
      )}
    </VaultContext.Provider>
  );
}
