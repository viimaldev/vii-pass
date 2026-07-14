import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Theme support (feature 013).
 *
 * Three user-selectable modes: 'auto' (default — follows the OS/browser
 * `prefers-color-scheme` when declared, otherwise local time of day), 'dark'
 * (medium-gray palette), and 'light'. The provider owns the mode state and
 * projects the RESOLVED appearance ('light' | 'dark', never 'auto') onto the
 * document as `data-bs-theme` + `color-scheme`, which is the single styling
 * contract: Bootstrap 5.3 re-themes natively from the attribute and
 * tokens.css re-points all design tokens in one `[data-bs-theme='dark']`
 * block. Components must never key colors off JS state.
 */

/** The user's stored theme preference. Absent/invalid persisted values mean 'auto'. */
export type ThemeMode = 'auto' | 'dark' | 'light';

/** The effective appearance applied to the document. */
export type ResolvedTheme = 'light' | 'dark';

/**
 * localStorage key for the persisted mode (FR-008/FR-009). The value is the
 * raw mode literal. It is intentionally NEVER removed on sign-out — the theme
 * preference is device-scoped and outlives authentication (FR-011). Also read
 * by the inline no-flash script in frontend/index.html; keep in sync.
 */
const STORAGE_KEY = 'vii-pass:theme';

/** Narrows an arbitrary persisted value to a valid mode, defaulting to 'auto' (FR-008). */
function normalizeMode(value: unknown): ThemeMode {
  return value === 'dark' || value === 'light' || value === 'auto' ? value : 'auto';
}

/**
 * Reads the persisted mode. Storage access can throw (blocked cookies/private
 * mode); failures silently degrade to 'auto' — selection then works in-memory
 * for the visit with no user-facing error (FR-013).
 */
function readStoredMode(): ThemeMode {
  try {
    return normalizeMode(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'auto';
  }
}

/**
 * Resolves a theme mode to the effective appearance (FR-005 precedence):
 * an explicit 'dark'/'light' wins outright; 'auto' follows the declared
 * `prefers-color-scheme`; when neither light nor dark is declared (or
 * `matchMedia` is unavailable) fall back to the device-local clock —
 * light from 06:00 (inclusive) until 18:00 (exclusive), dark otherwise.
 *
 * NOTE: this logic is duplicated in the inline no-flash script in
 * frontend/index.html (which cannot import modules). Keep both in sync.
 */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'dark' || mode === 'light') {
    return mode;
  }
  try {
    if (typeof window.matchMedia === 'function') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    }
  } catch {
    // Fall through to the time-of-day rule.
  }
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? 'light' : 'dark';
}

/** Value exposed by {@link useTheme}. */
interface ThemeContextValue {
  /** The stored user preference ('auto' when nothing is stored). */
  mode: ThemeMode;
  /** The effective appearance currently applied to the document. */
  resolved: ResolvedTheme;
  /** Persist and immediately apply a new mode (FR-004, FR-009). */
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Provides theme state to the app and applies the resolved appearance to
 * `<html>`. Mounted OUTSIDE AuthProvider in main.tsx: the theme is
 * auth-independent and must style signed-out pages too (FR-011).
 */
export function ThemeProvider({ children }: { children: ReactNode }): ReactElement {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(mode));

  // Recompute the resolution whenever the mode changes.
  useEffect(() => {
    setResolved(resolveTheme(mode));
  }, [mode]);

  // While in Auto, react live to the environment (FR-006): follow OS/browser
  // `prefers-color-scheme` changes as they happen, and — only when NEITHER
  // light nor dark is declared, i.e. the time-of-day fallback is in use —
  // re-evaluate every 60s so crossing the 06:00/18:00 boundary updates within
  // a minute. Explicit Dark/Light modes register nothing, so environment
  // changes are ignored by design (FR-007).
  useEffect(() => {
    if (mode !== 'auto') {
      return undefined;
    }

    const recompute = (): void => {
      setResolved(resolveTheme('auto'));
    };

    let darkQuery: MediaQueryList | null = null;
    let lightQuery: MediaQueryList | null = null;
    try {
      if (typeof window.matchMedia === 'function') {
        darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
        lightQuery = window.matchMedia('(prefers-color-scheme: light)');
        darkQuery.addEventListener('change', recompute);
        lightQuery.addEventListener('change', recompute);
      }
    } catch {
      // matchMedia unavailable — the interval below covers the time fallback.
      darkQuery = null;
      lightQuery = null;
    }

    // Timer only matters when the time fallback decides the theme (no
    // declared preference). Checking inside the tick (rather than once here)
    // also handles the preference being withdrawn while the page is open.
    const timer = window.setInterval(() => {
      const declared = (darkQuery?.matches ?? false) || (lightQuery?.matches ?? false);
      if (!declared) {
        recompute();
      }
    }, 60_000);

    return () => {
      darkQuery?.removeEventListener('change', recompute);
      lightQuery?.removeEventListener('change', recompute);
      window.clearInterval(timer);
    };
  }, [mode]);

  // Project the resolved appearance onto the document. The inline head script
  // in index.html has already set the same values before first paint; this
  // effect keeps them in sync from then on (idempotent).
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-bs-theme', resolved);
    root.style.colorScheme = resolved;
  }, [resolved]);

  // Adopt a theme change made in another tab of the same origin (FR-009):
  // the 'storage' event fires only in OTHER tabs, so no echo loop.
  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key === STORAGE_KEY) {
        setModeState(normalizeMode(event.newValue));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolved,
      setMode: (next: ThemeMode) => {
        setModeState(next);
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // Storage blocked — keep the in-memory selection for this visit (FR-013).
        }
      },
    }),
    [mode, resolved],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Accesses the theme state. Must be used within {@link ThemeProvider}.
 *
 * @throws Error when no provider is mounted above the caller.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider.');
  }
  return context;
}
