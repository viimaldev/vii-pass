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
  deriveRecoveryKeys,
  generateKdfSalt,
  generateVaultKey,
  normalizeSecurityAnswer,
  unwrapVaultKey,
  wrapVaultKey,
} from '../vault/crypto';
import { clearVaultKey, loadVaultKey, saveVaultKey } from '../vault/keyStore';
import {
  grantLease,
  hasLease,
  probeForLiveTab,
  releaseLease,
  startLeaseResponder,
} from './tabLease';

/**
 * Authentication context: the single source of truth for the current user in the
 * SPA. On mount it bootstraps auth state from the session cookie via
 * `GET /api/auth/me` (FR-007), and it centrally handles `401` responses so a lost
 * session resets the app and surfaces an accessible "session expired" prompt
 * (FR-006, FR-015). Since specs/019-mobile-scroll-tab-session, sessions are
 * TAB-SCOPED: the bootstrap first consults the per-tab lease / cross-tab
 * handshake in {@link module:tabLease} to decide whether to resume, adopt, or
 * revoke the session before ever calling `/me`.
 *
 * Since specs/010-credential-encryption this context also owns the vault key:
 * the password never leaves the browser — login/register derive an `authHash`
 * (sent to the server) and a wrap key (kept local) from it, and the unwrapped
 * AES-256-GCM vault key lives in this provider's memory. A NON-extractable
 * copy is persisted in IndexedDB ({@link saveVaultKey}) so a page refresh
 * silently restores the unlocked vault without re-prompting for the password;
 * both copies are cleared on logout and on 401. The password unlock prompt
 * ({@link AuthContextValue.unlockVault}) remains as the fallback when no
 * persisted key is available (e.g. cleared browser storage).
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
  /** Authenticate with either account username + the shared password (US2). */
  login: (username: string, password: string) => Promise<void>;
  /**
   * Self-service registration (specs/011-dual-user-roles US1): creates ONE
   * account with an admin + a normal username sharing `password`, plus a
   * security question/answer for password reset, then signs the caller in as
   * ADMIN. The password and raw answer never leave the browser.
   */
  register: (input: {
    adminUsername: string;
    username: string;
    displayName: string;
    password: string;
    securityQuestionId: number;
    securityAnswer: string;
  }) => Promise<void>;
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

  // Bootstrap auth state. Sessions are TAB-SCOPED
  // (specs/019-mobile-scroll-tab-session): before touching `/api/auth/me` the
  // tab decides whether it may use the session cookie at all —
  //   1. it holds the per-tab lease (this boot is a refresh/navigation) → resume;
  //   2. no lease, but a live signed-in tab answers the broadcast probe → adopt
  //      the session (grant this tab a lease) and resume;
  //   3. silence → the last holding tab was closed, so the cookie is stale:
  //      revoke the server-side session (fire-and-forget logout — a harmless
  //      no-op on true first visits), clear the persisted vault key, and finish
  //      signed out WITHOUT calling `/me`.
  // On resume, the vault key persisted in IndexedDB (non-extractable handle) is
  // silently restored so a refresh does not require re-entering the password.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!hasLease() && !(await probeForLiveTab())) {
          // Stale session: no tab holds it anymore. Revoke server-side and
          // drop local key material; errors are irrelevant (already signed out).
          void post<void>('/api/auth/logout').catch(() => undefined);
          await clearVaultKey();
          if (active) {
            setUser(null);
          }
          return;
        }
        const { user: current, vaultKeyWrapped } = await get<AuthResponse>('/api/auth/me');
        const restored = await loadVaultKey(current.id);
        if (active) {
          // /me succeeded — this tab is (now) a legitimate holder. Covers the
          // adoption path and repairs a lost lease after a refresh race.
          grantLease();
          vaultKeyWrappedRef.current = vaultKeyWrapped;
          setVaultKey(restored);
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

  // Central 401 handling: reset auth, drop key material AND the tab lease, and
  // flag expiry only if a session was live (FR-006).
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (userRef.current) {
        setSessionExpired(true);
      }
      releaseLease();
      vaultKeyWrappedRef.current = null;
      setVaultKey(null);
      setUser(null);
      void clearVaultKey();
    });
    return () => setUnauthorizedHandler(undefined);
  }, []);

  // Answer "who-is-alive" probes from booting sibling tabs so they can adopt
  // the session (specs/019-mobile-scroll-tab-session US3). Only vouch while a
  // user is signed in AND this tab holds the lease — a signed-out or 401'd tab
  // must never keep a dead session alive.
  useEffect(() => startLeaseResponder(() => userRef.current !== null && hasLease()), []);

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
    grantLease();
    vaultKeyWrappedRef.current = vaultKeyWrapped;
    setVaultKey(key);
    setSessionExpired(false);
    setUser(authed);
    if (key) {
      void saveVaultKey(authed.id, key);
    }
  }, []);

  const register = useCallback(
    async (input: {
      adminUsername: string;
      username: string;
      displayName: string;
      password: string;
      securityQuestionId: number;
      securityAnswer: string;
    }): Promise<void> => {
      // Generate the account's crypto material client-side: a fresh KDF salt, a
      // random vault key wrapped under the password-derived wrap key, and a
      // SECOND wrap of the SAME vault key under the security-answer-derived
      // recovery key (password-reset support, FR-008/FR-011).
      const kdfSalt = generateKdfSalt();
      const keys = await deriveKeys(input.password, kdfSalt);
      const newVaultKey = await generateVaultKey();
      const wrapped = await wrapVaultKey(newVaultKey, keys.wrapKey);
      const recoverySalt = generateKdfSalt();
      const recovery = await deriveRecoveryKeys(
        normalizeSecurityAnswer(input.securityAnswer),
        recoverySalt,
      );
      const wrappedRecovery = await wrapVaultKey(newVaultKey, recovery.recoveryWrapKey);
      const { user: created, vaultKeyWrapped } = await post<AuthResponse>('/api/auth/register', {
        adminUsername: input.adminUsername,
        username: input.username,
        displayName: input.displayName,
        authHash: keys.authHash,
        kdfSalt,
        vaultKeyWrapped: wrapped,
        securityQuestionId: input.securityQuestionId,
        answerHash: recovery.answerHash,
        recoverySalt,
        vaultKeyWrappedRecovery: wrappedRecovery,
      });
      grantLease();
      vaultKeyWrappedRef.current = vaultKeyWrapped ?? wrapped;
      setVaultKey(newVaultKey);
      setSessionExpired(false);
      setUser(created);
      void saveVaultKey(created.id, newVaultKey);
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
    void saveVaultKey(current.id, key);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await post<void>('/api/auth/logout');
    } finally {
      releaseLease();
      vaultKeyWrappedRef.current = null;
      setVaultKey(null);
      setUser(null);
      void clearVaultKey();
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
