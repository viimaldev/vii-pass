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
import type { AuthResponse, PublicUser } from '@vii-pass/shared';
import { get, post, setUnauthorizedHandler } from '../services/apiClient';

/**
 * Authentication context: the single source of truth for the current user in the
 * SPA. On mount it bootstraps auth state from the session cookie via
 * `GET /api/auth/me` (FR-007), and it centrally handles `401` responses so a lost
 * session resets the app and surfaces an accessible "session expired" prompt
 * (FR-006, FR-015).
 */
interface AuthContextValue {
  /** The signed-in user, or `null` when unauthenticated. */
  user: PublicUser | null;
  /** True while the initial session bootstrap is in flight. */
  loading: boolean;
  /** True when a previously active session was lost (drives the expiry notice). */
  sessionExpired: boolean;
  /** Authenticate with email + password (US1). */
  login: (email: string, password: string) => Promise<void>;
  /** Self-service registration; signs the new user in (US2). */
  register: (email: string, displayName: string, password: string) => Promise<void>;
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

  // Mirror `user` in a ref so the 401 handler can tell "session dropped" (was
  // authenticated) from "never signed in" without re-registering on every change.
  const userRef = useRef<PublicUser | null>(null);
  userRef.current = user;

  // Bootstrap the current user from the session cookie.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { user: current } = await get<AuthResponse>('/api/auth/me');
        if (active) {
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

  // Central 401 handling: reset auth, and flag expiry only if a session was live.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (userRef.current) {
        setSessionExpired(true);
      }
      setUser(null);
    });
    return () => setUnauthorizedHandler(undefined);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const { user: authed } = await post<AuthResponse>('/api/auth/login', { email, password });
    setSessionExpired(false);
    setUser(authed);
  }, []);

  const register = useCallback(
    async (email: string, displayName: string, password: string): Promise<void> => {
      const { user: created } = await post<AuthResponse>('/api/auth/register', {
        email,
        displayName,
        password,
      });
      setSessionExpired(false);
      setUser(created);
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await post<void>('/api/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const clearSessionExpired = useCallback((): void => setSessionExpired(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, sessionExpired, login, register, logout, clearSessionExpired }),
    [user, loading, sessionExpired, login, register, logout, clearSessionExpired],
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
