/**
 * Persistence of the unlocked vault key across page refreshes
 * (specs/010-credential-encryption, post-ship UX refinement).
 *
 * The unwrapped vault key is stored in IndexedDB as a **non-extractable**
 * `CryptoKey`: the browser persists an opaque key handle that can be *used*
 * for AES-GCM operations but whose raw bytes can never be exported — not even
 * by our own code, so an XSS payload cannot exfiltrate the key material.
 * This lets a refresh silently restore the unlocked vault with no password
 * prompt while still never writing key bytes to any storage.
 *
 * The record is tagged with the owning user's id (restored only for the same
 * signed-in user) and is cleared on logout and on session loss (401).
 *
 * Every function degrades gracefully: if IndexedDB is unavailable (private
 * browsing, storage pressure) the app simply falls back to the locked-vault
 * password prompt — persistence is an enhancement, never a dependency.
 */

const DB_NAME = 'vii-pass-vault';
const DB_VERSION = 1;
const STORE_NAME = 'keys';
const RECORD_ID = 'vaultKey';

/** Shape of the single record kept in the object store. */
interface StoredVaultKey {
  userId: string;
  key: CryptoKey;
}

/** Open (and lazily create) the vault key database. */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'));
  });
}

/** Run one read/write transaction against the key store. */
async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const request = action(tx.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
    });
  } finally {
    db.close();
  }
}

/**
 * Persist the vault key for silent restore after a refresh.
 *
 * The in-memory key (extractable, so it can be re-wrapped on a future password
 * change — FR-010) is first cloned into a NON-extractable key; only that
 * handle is stored. Failures are swallowed — persistence is best-effort.
 *
 * @param userId The signed-in user's id; the key is only restored for this user.
 * @param vaultKey The unwrapped (extractable) vault key held in memory.
 */
export async function saveVaultKey(userId: string, vaultKey: CryptoKey): Promise<void> {
  try {
    const raw = await crypto.subtle.exportKey('raw', vaultKey);
    const persistable = await crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'AES-GCM', length: 256 },
      false, // non-extractable: the stored handle can never yield key bytes
      ['encrypt', 'decrypt'],
    );
    const record: StoredVaultKey = { userId, key: persistable };
    await withStore('readwrite', (store) => store.put(record, RECORD_ID));
  } catch {
    // Best-effort only: the user just unlocks with their password next refresh.
  }
}

/**
 * Load the persisted vault key for the given user, or `null` when absent,
 * owned by a different user, or IndexedDB is unavailable.
 */
export async function loadVaultKey(userId: string): Promise<CryptoKey | null> {
  try {
    const record = await withStore<StoredVaultKey | undefined>('readonly', (store) =>
      store.get(RECORD_ID),
    );
    if (record && record.userId === userId) {
      return record.key;
    }
    return null;
  } catch {
    return null;
  }
}

/** Remove any persisted vault key (logout / session loss). Best-effort. */
export async function clearVaultKey(): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.delete(RECORD_ID));
  } catch {
    // Nothing to do — worst case a stale key handle remains for a signed-out
    // user; it is never restored without a matching authenticated session.
  }
}
