import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { Chord, ChordField, CreateChordRequest, CreateSectionRequest, Section } from '@vii-pass/shared';
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
 * provider.
 *
 * Caching model (specs/015-vault-perf-caching): the WHOLE vault — every section
 * and every chord — is loaded in ONE request (`GET /api/vault`) per signed-in
 * page visit and then held in memory only. Section switches are a pure filter
 * over the cached chords (zero requests, no loading state); mutations each send
 * exactly one request and patch the cache from their own response; a browser
 * refresh is the sync point (fresh load); sign-out/401 discards everything.
 * Vault data never touches persistent browser storage.
 *
 * This provider is also the SINGLE crypto boundary of the vault
 * (specs/010-credential-encryption): chord `url`/`fields[].value` arrive from
 * the API as Level-1 envelopes and are decrypted here with the in-memory vault
 * key before entering React state; plaintext from the dialogs is encrypted here
 * before anything reaches `vaultApi` (FR-004/FR-008/FR-009). The raw envelope
 * copies are kept in a ref (never exposed) so unlocking re-decrypts locally
 * without re-downloading. Components above only ever see plaintext — or a
 * sentinel from `./sentinels`.
 */

interface VaultContextValue {
  sections: Section[];
  selectedId: string | null;
  chords: Chord[];
  loading: boolean;
  /** Always `false` after the initial load — section switches never fetch (015). */
  chordsLoading: boolean;
  error: string | null;
  /** True once the initial vault load has completed for a signed-in user. */
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
  /**
   * Re-fetch the whole vault (sections + chords) from the server on demand —
   * the in-app equivalent of a browser refresh (e.g. clicking the brand logo).
   * Keeps the current section selected when it still exists.
   */
  refreshVault: () => void;
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

// ─────────────────────────────────────────────────────────────────────────────
// TEMPORARY — one-time bulk credential import. Exposes
// `window.__viiPassImport(items, sectionId?)` (currently in ALL builds so it
// can run once against production). Usage from
// the browser console while signed in (admin) with the vault unlocked:
//   await __viiPassImport([{ title: 'GitHub', url: 'github.com',
//     username: 'me', password: 's3cret' }], /* optional sectionId */);
// DELETE this whole block (and the registration effect below) after the import.
// ─────────────────────────────────────────────────────────────────────────────

/** One credential to import; provide at most three of the field keys. */
interface ImportItem {
  title: string;
  url?: string;
  username?: string;
  email?: string;
  password?: string;
  other?: string;
  otherSensitive?: string;
}

declare global {
  interface Window {
    /** TEMPORARY dev-only bulk import — see block comment above. */
    __viiPassImport?: (items: ImportItem[], sectionId?: string) => Promise<void>;
  }
}

/** Field keys mapped, in order, onto the chord's three typed rows. */
const IMPORT_FIELD_KEYS = ['username', 'email', 'password', 'other', 'otherSensitive'] as const;

/**
 * Map a raw import item to a plaintext {@link CreateChordRequest}, applying the
 * same title/URL rules as the entry dialog (trim, 1–100 chars; scheme-less URLs
 * get `https://`, only http(s) allowed). Throws with a per-item reason.
 */
function buildImportInput(item: ImportItem): CreateChordRequest {
  const title = item.title?.trim();
  if (!title || title.length > 100) {
    throw new Error(`invalid title: ${JSON.stringify(item.title)}`);
  }
  let url: string | null = null;
  const rawUrl = item.url?.trim();
  if (rawUrl) {
    const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const parsed = new URL(candidate); // throws on unparseable input
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.href.length > 2048) {
      throw new Error(`invalid url: ${rawUrl}`);
    }
    url = parsed.href;
  }
  const present = IMPORT_FIELD_KEYS.filter((k) => {
    const v = item[k];
    return typeof v === 'string' && v.length > 0;
  });
  if (present.length > 3) {
    throw new Error(`more than 3 field values (${present.join(', ')})`);
  }
  const fields: ChordField[] = [0, 1, 2].map((i) => {
    const key = present[i];
    return key ? { type: key, value: item[key] ?? null } : { type: 'other', value: null };
  });
  return { title, url, fields };
}

// ───────────────────────────── end TEMPORARY block ──────────────────────────

/** Access the vault context; throws if used outside {@link VaultProvider}. */
export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error('useVault must be used within a VaultProvider.');
  }
  return ctx;
}

/** Provider that owns the vault cache (sections + all chords) and renders the vault dialogs. */
export function VaultProvider({ children }: { children: ReactNode }): ReactElement {
  const { user, vaultKey, vaultLocked } = useAuth();

  const [sections, setSections] = useState<Section[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** ALL of the user's chords, decrypted (plaintext or sentinels), across every section. */
  const [allChords, setAllChords] = useState<Chord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  /** Bumped by {@link VaultContextValue.refreshVault} to re-run the load effect. */
  const [refreshCount, setRefreshCount] = useState(0);

  /**
   * Raw chords exactly as received (L1 envelopes) — the local source of truth
   * for re-decryption on unlock. Never exposed through context; kept in sync by
   * every chord mutation. A ref (not state): ciphertext changes must not
   * re-render consumers.
   */
  const envelopesRef = useRef<Chord[]>([]);
  /** Key used for the most recent full decrypt — skips redundant re-decrypts. */
  const lastDecryptKeyRef = useRef<CryptoKey | null | undefined>(undefined);
  /**
   * Live vault key for the one-shot load effect, so a key change (unlock) never
   * re-runs the load (and re-downloads) — unlock re-decrypts locally instead.
   */
  const vaultKeyRef = useRef<CryptoKey | null>(vaultKey);
  vaultKeyRef.current = vaultKey;

  // TEMPORARY bulk import registration — deliberately NOT dev-gated so the
  // one-time import can run against production. REVERT this commit right
  // after the import (see the TEMPORARY block above `useVault`).
  const selectedIdRef = useRef<string | null>(selectedId);
  selectedIdRef.current = selectedId;
  useEffect(() => {
    window.__viiPassImport = async (items, sectionId) => {
      const target = sectionId ?? selectedIdRef.current;
      if (!target) throw new Error('No section selected — pass a sectionId.');
      const key = vaultKeyRef.current;
      if (!key) throw new Error('The vault is locked — unlock it first.');
      let imported = 0;
      const failures: { title: string; reason: string }[] = [];
      // Sequential on purpose: createChord computes `position` and pre-checks
      // title uniqueness server-side, so parallel posts would race.
      for (const item of items) {
        try {
          const payload = await encryptChordInput(buildImportInput(item), key);
          await vaultApi.createChord(target, payload);
          imported += 1;
        } catch (err) {
          failures.push({
            title: item?.title ?? '(untitled)',
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }
      console.info(`[vii-pass import] ${imported}/${items.length} imported.`, failures);
      // Re-load the whole vault so the new chords appear (same as refreshVault).
      setRefreshCount((n) => n + 1);
    };
    return () => {
      delete window.__viiPassImport;
    };
  }, []);

  // Dialog state.
  const [sectionDialog, setSectionDialog] = useState<{ mode: 'add' | 'edit'; section?: Section } | null>(
    null,
  );
  const [chordDialog, setChordDialog] = useState<{ chord?: Chord } | null>(null);

  // Load the WHOLE vault once when the signed-in user changes (or on an
  // explicit refreshVault trigger); clear on sign-out.
  useEffect(() => {
    if (!user) {
      setSections([]);
      setSelectedId(null);
      setAllChords([]);
      envelopesRef.current = [];
      lastDecryptKeyRef.current = undefined;
      setReady(false);
      // Drop any stale error (e.g. a fetch aborted by sign-out) so it does not
      // leak into the next user's session.
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setReady(false);
    setError(null);
    void (async () => {
      try {
        const vault = await vaultApi.loadVault();
        if (!active) return;
        // Cache the envelopes, then decrypt with whatever key is present right
        // now — a locked vault yields VALUE_LOCKED sentinels and the unlock
        // effect below re-decrypts locally once the key arrives (FR-008).
        envelopesRef.current = vault.chords;
        const key = vaultKeyRef.current;
        const decrypted = await Promise.all(vault.chords.map((c) => decryptChord(c, key)));
        if (!active) return;
        lastDecryptKeyRef.current = key;
        setSections(vault.sections);
        setAllChords(decrypted);
        // Keep the current selection across an in-app refresh when the section
        // still exists; otherwise fall back to the first section.
        setSelectedId((prev) =>
          prev !== null && vault.sections.some((s) => s.id === prev)
            ? prev
            : (vault.sections[0]?.id ?? null),
        );
        setReady(true);
      } catch {
        if (active) setError('Could not load your vault. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, refreshCount]);

  /** Trigger a fresh full-vault load (see {@link VaultContextValue.refreshVault}). */
  const refreshVault = useCallback(() => setRefreshCount((n) => n + 1), []);

  // Unlock (or any key change) re-decrypts the cached envelopes in place — no
  // network request (FR-008, research D3).
  useEffect(() => {
    if (!ready || vaultKey === lastDecryptKeyRef.current) return;
    let active = true;
    void (async () => {
      const decrypted = await Promise.all(
        envelopesRef.current.map((c) => decryptChord(c, vaultKey)),
      );
      if (!active) return;
      lastDecryptKeyRef.current = vaultKey;
      setAllChords(decrypted);
    })();
    return () => {
      active = false;
    };
  }, [vaultKey, ready]);

  // The visible list is a pure derivation — switching sections never fetches
  // and never shows a loading state (FR-002, FR-009).
  const chords = useMemo(
    () =>
      allChords
        .filter((c) => c.sectionId === selectedId)
        .sort((a, b) => a.position - b.position),
    [allChords, selectedId],
  );

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
      const sectionId = selectedId;
      const previous = allChords;
      const positionOf = new Map(orderedIds.map((id, i) => [id, i]));
      /** Rewrite `position` for the reordered section's chords, leaving values intact. */
      const applyPositions = (list: Chord[], positions: Map<string, number>): Chord[] =>
        list.map((c) => {
          if (c.sectionId !== sectionId) return c;
          const pos = positions.get(c.id);
          return pos === undefined || pos === c.position ? c : { ...c, position: pos };
        });
      // Optimistic order for instant feedback.
      setAllChords((prev) => applyPositions(prev, positionOf));
      try {
        const updated = await vaultApi.reorderChords(sectionId, orderedIds);
        // Apply only the server-confirmed positions onto the existing decrypted
        // chords and envelope cache — never replace state with the response's
        // envelope chords, which would clobber plaintext (research D4).
        const serverPositions = new Map(updated.map((c) => [c.id, c.position]));
        setAllChords((prev) => applyPositions(prev, serverPositions));
        envelopesRef.current = applyPositions(envelopesRef.current, serverPositions);
      } catch {
        // Restore the last server-consistent order (FR-005).
        setAllChords(previous);
        setError('Could not save the entry order.');
      }
    },
    [selectedId, allChords],
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
    // Mirror the server-side cascade: the section's chords go with it.
    envelopesRef.current = envelopesRef.current.filter((c) => c.sectionId !== sectionId);
    setAllChords((prev) => prev.filter((c) => c.sectionId !== sectionId));
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
      envelopesRef.current = envelopesRef.current.map((c) => (c.id === updated.id ? updated : c));
      setAllChords((prev) => prev.map((c) => (c.id === updated.id ? { ...updated, ...plain } : c)));
    } else {
      const created = await vaultApi.createChord(selectedId, payload);
      envelopesRef.current = [...envelopesRef.current, created];
      setAllChords((prev) => [...prev, { ...created, ...plain }]);
    }
    setChordDialog(null);
  }

  async function handleDeleteChord(chordId: string): Promise<void> {
    await vaultApi.deleteChord(chordId);
    envelopesRef.current = envelopesRef.current.filter((c) => c.id !== chordId);
    setAllChords((prev) => prev.filter((c) => c.id !== chordId));
    setChordDialog(null);
  }

  const value = useMemo<VaultContextValue>(
    () => ({
      sections,
      selectedId,
      chords,
      loading,
      // Chords ship with the single vault load — nothing loads on section switch
      // (FR-002/FR-009). Kept so the context shape is unchanged for consumers.
      chordsLoading: false,
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
      refreshVault,
    }),
    [sections, selectedId, chords, loading, error, ready, vaultLocked, reorderSections, reorderChords, refreshVault],
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
          // The entry dialog's primary action adopts the active section's color
          // (specs/017 contract §3): the chord's own section when editing, the
          // currently selected section when adding.
          sectionColor={
            sections.find(
              (s) => s.id === (chordDialog.chord ? chordDialog.chord.sectionId : selectedId),
            )?.color
          }
          onSave={handleSaveChord}
          onDelete={handleDeleteChord}
          onClose={() => setChordDialog(null)}
        />
      )}
    </VaultContext.Provider>
  );
}
