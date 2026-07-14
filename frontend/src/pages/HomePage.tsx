import { useId, useState, type FormEvent, type ReactElement } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ChordGrid } from '../components/ChordGrid';
import { useVault } from '../vault/VaultContext';

/**
 * Authenticated vault surface (US1–US5). The section tabs live in the app header
 * (see {@link Layout}); this page renders the chords of the selected section from
 * the shared {@link useVault} state and lets the user add, edit, delete, and
 * reorder them. Only reachable through `ProtectedRoute`, so a user is always
 * present.
 *
 * Locked vault (specs/010-credential-encryption US2): after a page refresh the
 * session survives but the encryption key does not, so sections/titles still
 * list while every value renders masked. An inline unlock form re-derives the
 * key from the password; a wrong password errors and the vault stays locked.
 */
export function HomePage(): ReactElement {
  const { user } = useAuth();
  const {
    sections,
    selectedId,
    chords,
    loading,
    chordsLoading,
    error,
    vaultLocked,
    openAddChord,
    openEditChord,
    reorderChords,
  } = useVault();

  // Selected section's color feeds the chord-card theming ramps
  // (specs/014-section-color-theming FR-001) — decorative only.
  const sectionColor = sections.find((s) => s.id === selectedId)?.color;

  // View-only capability (specs/011-dual-user-roles FR-007): normal-role
  // sessions get the same content with every mutation affordance omitted.
  const readOnly = user?.role !== 'admin';

  return (
    <div className="vault-page flex-grow-1 d-flex flex-column">
      <div className="vault-page__inner container-fluid py-3 d-flex flex-column flex-grow-1">
        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        {vaultLocked && <UnlockVaultForm />}

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
                  readOnly={readOnly}
                  sectionColor={sectionColor}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Inline unlock prompt shown while the vault is locked. Submitting re-derives
 * the keys from the password and unwraps the vault key entirely client-side —
 * the password never leaves the browser. On success the vault decrypts and
 * behaves normally; a wrong password surfaces an accessible error and the
 * vault stays locked.
 */
function UnlockVaultForm(): ReactElement {
  const { unlockVault } = useAuth();
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const inputId = useId();

  async function handleUnlock(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (password.length === 0 || unlocking) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      await unlockVault(password);
      // Success: `vaultLocked` flips false upstream and this form unmounts.
    } catch {
      setUnlockError('That password is incorrect. Your vault stays locked.');
      setUnlocking(false);
    }
  }

  return (
    <form className="vault-unlock mb-3" onSubmit={handleUnlock} noValidate>
      <div className="row g-2 align-items-end">
        <div className="col-12 col-sm-auto flex-sm-grow-1 vault-unlock__field">
          <label htmlFor={inputId} className="form-label mb-1">
            Vault locked — enter your password to unlock
          </label>
          <input
            id={inputId}
            type="password"
            className={`form-control${unlockError ? ' is-invalid' : ''}`}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (unlockError) setUnlockError(null);
            }}
            autoComplete="current-password"
            aria-invalid={unlockError ? true : undefined}
            aria-describedby={unlockError ? `${inputId}-error` : undefined}
          />
        </div>
        <div className="col-12 col-sm-auto">
          <button type="submit" className="btn btn-primary" disabled={unlocking}>
            {unlocking ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </div>
      {unlockError && (
        <p id={`${inputId}-error`} className="alert alert--error mt-2 mb-0" role="alert">
          {unlockError}
        </p>
      )}
    </form>
  );
}
