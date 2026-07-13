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
import { decryptValue, encryptValue } from './crypto';
import { VALUE_LOCKED, VALUE_UNREADABLE } from './sentinels';

/**
 * Vault state shared across the app shell (US1–US5). The section tabs live in the
 * top header (rendered by {@link Layout}) while the chord grid lives on the home
 * page, so the sections/selection/chords state is lifted here into a single
 * provider. Only fetches when a user is signed in; clears when they sign out.
 *
 * This provider is also the SINGLE crypto boundary of the vault
 * (specs/010-credential-encryption): chord `url`/`fields[].value` arrive from
 * the API as Level-1 envelopes and are decrypted here with the in-memory vault
 * key before entering React state; plaintext from the dialogs is encrypted here
 * before anything reaches `vaultApi` (FR-004/FR-008/FR-009). Components above
 * only ever see plaintext — or a sentinel from `./sentinels`.
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
  /** True when signed in but the vault key is absent (values masked, US2). */
  vaultLocked: boolean;
  selectSection: (id: string) => void;
  openAddSection: () => void;
  openEditSection: (section: Section) => void;
  reorderSections: (orderedIds: string[]) => void;
  openAddChord: () => void;
  openEditChord: (chord: Chord) => void;
  reorderChords: (orderedIds: string[]) => void;
}

const VaultContext = createContext<VaultContextValue | undefined>(undefined);

/** The server's per-field unwrap-failure sentinel (contracts/chords-api.md). */
const SERVER_ERROR_SENTINEL = 'v1.err';

/**
 * Decrypt one envelope to plaintext, mapping any failure — server sentinel,
 * tampered ciphertext, wrong key — to {@link VALUE_UNREADABLE}, and a locked
 * vault (no key) to {@link VALUE_LOCKED}. `null` (unused) passes through.
 */
async function decryptField(
  envelope: string | null,
  key: CryptoKey | null,
): Promise<string | null> {
  if (envelope === null) return null;
  if (envelope === SERVER_ERROR_SENTINEL) return VALUE_UNREADABLE;
  if (!key) return VALUE_LOCKED;
  try {
    return await decryptValue(envelope, key);
  } catch {
    return VALUE_UNREADABLE;
  }
}

/** Decrypt a chord's `url` and all field values for use in React state. */
async function decryptChord(chord: Chord, key: CryptoKey | null): Promise<Chord> {
  const [url, ...values] = await Promise.all([
    decryptField(chord.url, key),
    ...chord.fields.map((f) => decryptField(f.value, key)),
  ]);
  return {
    ...chord,
    url,
    fields: chord.fields.map((f, i) => ({ type: f.type, value: values[i] ?? null })),
  };
}

/** Encrypt a plaintext dialog payload into L1 envelopes for the API. */
async function encryptChordInput(
  input: CreateChordRequest,
  key: CryptoKey,
): Promise<CreateChordRequest> {
  const plainUrl = input.url ?? null;
  const [url, ...values] = await Promise.all([
    plainUrl === null ? Promise.resolve(null) : encryptValue(plainUrl, key),
    ...input.fields.map((f) =>
      f.value === null ? Promise.resolve(null) : encryptValue(f.value, key),
    ),
  ]);
  return {
    title: input.title,
    url,
    fields: input.fields.map((f, i) => ({ type: f.type, value: values[i] ?? null })),
  };
}

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
  const { user, vaultKey, vaultLocked } = useAuth();

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

  // Load the selected section's chords whenever the selection changes, and
  // re-fetch + decrypt when the vault key becomes available (unlock).
  const loadChords = useCallback(
    async (sectionId: string) => {
      setChordsLoading(true);
      try {
        const loaded = await vaultApi.listChords(sectionId);
        const decrypted = await Promise.all(loaded.map((c) => decryptChord(c, vaultKey)));
        setChords(decrypted);
      } catch {
        setError('Could not load entries for this section.');
      } finally {
        setChordsLoading(false);
      }
    },
    [vaultKey],
  );

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
    // Encrypt before anything leaves the crypto boundary. A missing key or an
    // encryption failure aborts the save — nothing is transmitted (FR-009).
    if (!vaultKey) {
      throw new Error('The vault is locked. Unlock it before saving.');
    }
    const payload = await encryptChordInput(input, vaultKey);
    // Keep the plaintext the user just typed in state — responses carry envelopes.
    const plain = { url: input.url ?? null, fields: input.fields };
    if (chordDialog?.chord) {
      const updated = await vaultApi.updateChord(chordDialog.chord.id, payload);
      setChords((prev) => prev.map((c) => (c.id === updated.id ? { ...updated, ...plain } : c)));
    } else {
      const created = await vaultApi.createChord(selectedId, payload);
      setChords((prev) => [...prev, { ...created, ...plain }]);
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
      vaultLocked,
      selectSection: setSelectedId,
      openAddSection: () => setSectionDialog({ mode: 'add' }),
      openEditSection: (section) => setSectionDialog({ mode: 'edit', section }),
      reorderSections,
      openAddChord: () => setChordDialog({}),
      openEditChord: (chord) => setChordDialog({ chord }),
      reorderChords,
    }),
    [sections, selectedId, chords, loading, chordsLoading, error, ready, vaultLocked, reorderSections, reorderChords],
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
