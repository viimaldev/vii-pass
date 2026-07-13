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
import type { AuthResponse, PublicUser, SaltResponse } from '@vii-pass/shared';
import { get, post, setUnauthorizedHandler } from '../services/apiClient';
import {
  deriveKeys,
  generateKdfSalt,
  generateVaultKey,
  unwrapVaultKey,
  wrapVaultKey,
} from '../vault/crypto';

/**
 * Authentication context: the single source of truth for the current user in the
 * SPA. On mount it bootstraps auth state from the session cookie via
 * `GET /api/auth/me` (FR-007), and it centrally handles `401` responses so a lost
 * session resets the app and surfaces an accessible "session expired" prompt
 * (FR-006, FR-015).
 *
 * Since specs/010-credential-encryption this context also owns the vault key:
 * the password never leaves the browser — login/register derive an `authHash`
 * (sent to the server) and a wrap key (kept local) from it, and the unwrapped
 * AES-256-GCM vault key lives ONLY in this provider's memory. It is cleared on
 * logout and on 401; after a page refresh the session survives but the vault is
 * locked until the user re-enters their password ({@link AuthContextValue.unlockVault}).
 */
interface AuthContextValue {
  /** The signed-in user, or `null` when unauthenticated. */
  user: PublicUser | null;
  /** True while the initial session bootstrap is in flight. */
  loading: boolean;
  /** True when a previously active session was lost (drives the expiry notice). */
  sessionExpired: boolean;
  /** The unwrapped vault key, or `null` while the vault is locked / signed out. */
  vaultKey: CryptoKey | null;
  /** True when signed in but the vault key is not in memory (e.g. after refresh). */
  vaultLocked: boolean;
  /** Authenticate with username + password (US2). */
  login: (username: string, password: string) => Promise<void>;
  /** Self-service registration; signs the new user in (US1). */
  register: (username: string, displayName: string, password: string) => Promise<void>;
  /** Re-derive keys from the password and unwrap the vault key (locked vault). */
  unlockVault: (password: string) => Promise<void>;
  /** End the session (US4). */
  logout: () => Promise<void>;
  /** Dismiss the session-expired notice. */
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Provider that owns auth state and exposes it via {@link useAuth}. */
export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);

  // The wrapped vault key from the server — needed to unlock after a refresh.
  // Opaque ciphertext (not a secret usable without the password), kept in a ref
  // because it never drives rendering.
  const vaultKeyWrappedRef = useRef<string | null>(null);

  // Mirror `user` in a ref so the 401 handler can tell "session dropped" (was
  // authenticated) from "never signed in" without re-registering on every change.
  const userRef = useRef<PublicUser | null>(null);
  userRef.current = user;

  // Bootstrap the current user from the session cookie. The vault key cannot
  // survive a refresh, so the vault starts locked (unlock prompt on HomePage).
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { user: current, vaultKeyWrapped } = await get<AuthResponse>('/api/auth/me');
        if (active) {
          vaultKeyWrappedRef.current = vaultKeyWrapped;
          setUser(current);
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Central 401 handling: reset auth, drop key material, and flag expiry only if
  // a session was live (FR-006).
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (userRef.current) {
        setSessionExpired(true);
      }
      vaultKeyWrappedRef.current = null;
      setVaultKey(null);
      setUser(null);
    });
    return () => setUnauthorizedHandler(undefined);
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<void> => {
    // Fetch the per-user KDF salt (decoy for unknown users), derive the auth
    // hash + wrap key locally, and authenticate with the hash — the password
    // itself never leaves the browser.
    const normalized = username.trim().toLowerCase();
    const { kdfSalt } = await get<SaltResponse>(
      `/api/auth/salt/${encodeURIComponent(normalized)}`,
    );
    const keys = await deriveKeys(password, kdfSalt);
    const { user: authed, vaultKeyWrapped } = await post<AuthResponse>('/api/auth/login', {
      username: normalized,
      authHash: keys.authHash,
    });
    // Unwrap the vault key so the vault is immediately usable after sign-in.
    const key = vaultKeyWrapped ? await unwrapVaultKey(vaultKeyWrapped, keys.wrapKey) : null;
    vaultKeyWrappedRef.current = vaultKeyWrapped;
    setVaultKey(key);
    setSessionExpired(false);
    setUser(authed);
  }, []);

  const register = useCallback(
    async (username: string, displayName: string, password: string): Promise<void> => {
      // Generate the account's crypto material client-side: a fresh KDF salt and
      // a random vault key, wrapped under the password-derived wrap key.
      const kdfSalt = generateKdfSalt();
      const keys = await deriveKeys(password, kdfSalt);
      const newVaultKey = await generateVaultKey();
      const wrapped = await wrapVaultKey(newVaultKey, keys.wrapKey);
      const { user: created, vaultKeyWrapped } = await post<AuthResponse>('/api/auth/register', {
        username,
        displayName,
        authHash: keys.authHash,
        kdfSalt,
        vaultKeyWrapped: wrapped,
      });
      vaultKeyWrappedRef.current = vaultKeyWrapped ?? wrapped;
      setVaultKey(newVaultKey);
      setSessionExpired(false);
      setUser(created);
    },
    [],
  );

  const unlockVault = useCallback(async (password: string): Promise<void> => {
    const current = userRef.current;
    if (!current) {
      throw new Error('Not signed in.');
    }
    let wrapped = vaultKeyWrappedRef.current;
    if (!wrapped) {
      // Defensive re-fetch (e.g. bootstrap raced): the wrapped key is served on /me.
      const { vaultKeyWrapped } = await get<AuthResponse>('/api/auth/me');
      wrapped = vaultKeyWrapped;
      vaultKeyWrappedRef.current = vaultKeyWrapped;
    }
    if (!wrapped) {
      throw new Error('Vault key unavailable. Please sign out and back in.');
    }
    const { kdfSalt } = await get<SaltResponse>(
      `/api/auth/salt/${encodeURIComponent(current.username)}`,
    );
    const keys = await deriveKeys(password, kdfSalt);
    // Throws on a wrong password (GCM auth failure) — callers surface the error.
    const key = await unwrapVaultKey(wrapped, keys.wrapKey);
    setVaultKey(key);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await post<void>('/api/auth/logout');
    } finally {
      vaultKeyWrappedRef.current = null;
      setVaultKey(null);
      setUser(null);
    }
  }, []);

  const clearSessionExpired = useCallback((): void => setSessionExpired(false), []);

  const vaultLocked = user !== null && vaultKey === null;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      sessionExpired,
      vaultKey,
      vaultLocked,
      login,
      register,
      unlockVault,
      logout,
      clearSessionExpired,
    }),
    [
      user,
      loading,
      sessionExpired,
      vaultKey,
      vaultLocked,
      login,
      register,
      unlockVault,
      logout,
      clearSessionExpired,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth context. Throws if used outside an {@link AuthProvider}. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return ctx;
}
