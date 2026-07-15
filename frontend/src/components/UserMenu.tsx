import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Spinner } from './Spinner';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeMode } from '../theme/ThemeContext';

/**
 * Renders one decorative inline Bootstrap-Icons glyph for a menu row. Icons are
 * local to this component (only a handful of glyphs are needed — no icon
 * dependency, matching the repo's inline-SVG pattern) and hidden from assistive
 * technology; each control's label provides the accessible text.
 */
function menuIcon(path: ReactElement): ReactElement {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className="user-menu__icon"
    >
      {path}
    </svg>
  );
}

/** Bootstrap Icons "circle-half" — Auto theme (follows the environment). */
const autoIcon = menuIcon(
  <path d="M8 15A7 7 0 1 0 8 1zm0 1A8 8 0 1 1 8 0a8 8 0 0 1 0 16" />,
);

/** Bootstrap Icons "moon-fill" — Dark theme. */
const darkIcon = menuIcon(
  <path d="M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278" />,
);

/** Bootstrap Icons "sun-fill" — Light theme. */
const lightIcon = menuIcon(
  <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708" />,
);

/** Bootstrap Icons "box-arrow-right" — Log out row. */
const logoutIcon = menuIcon(
  <>
    <path
      fillRule="evenodd"
      d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0z"
    />
    <path
      fillRule="evenodd"
      d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708z"
    />
  </>,
);

/** The three selectable theme modes, in the mandated display order (FR-002). */
const THEME_OPTIONS: ReadonlyArray<{ mode: ThemeMode; label: string; icon: ReactElement }> = [
  { mode: 'auto', label: 'Auto theme', icon: autoIcon },
  { mode: 'dark', label: 'Dark theme', icon: darkIcon },
  { mode: 'light', label: 'Light theme', icon: lightIcon },
];

/**
 * Corner account menu (US4, redesigned in feature 012). The panel shows an
 * identity header — a circular initial badge (never a photo) beside the display
 * name (large, bold) over the username (small, muted) — followed by icon-led
 * menu rows: a theme selector (Auto / Dark / Light, feature 013) and the logout
 * action. Renders nothing when no user is authenticated, so it is safe to mount
 * on public screens.
 */
export function UserMenu(): ReactElement | null {
  const { user, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the menu on outside clicks and the Escape key while it is open.
  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointer = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!user) {
    return null;
  }

  const handleLogout = async (): Promise<void> => {
    setBusy(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  // First letter of the display name (fallback to username) for the avatar button.
  const initial = (user.displayName || user.username || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="user-menu" ref={containerRef}>
      <button
        type="button"
        className="user-menu__avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.displayName}`}
        title={user.displayName}
        onClick={() => setOpen((value) => !value)}
      >
        {initial}
      </button>

      {open && (
        <div className="user-menu__panel" role="menu" aria-label="Account">
          <div className="user-menu__header">
            {/* Decorative: the display name follows as text, so the badge is
             * hidden from assistive technology. */}
            <span className="user-menu__badge" aria-hidden="true">
              {initial}
            </span>
            <div className="user-menu__identity">
              <div className="user-menu__name">{user.displayName}</div>
              <div className="user-menu__id">{user.username}</div>
            </div>
          </div>
          <div className="user-menu__theme-row">
            <span className="user-menu__theme-label" id="user-menu-theme-label">
              Theme
            </span>
            <div className="user-menu__theme-group" aria-labelledby="user-menu-theme-label">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  role="menuitemradio"
                  aria-checked={mode === option.mode}
                  aria-label={option.label}
                  title={option.label}
                  className="user-menu__theme-btn"
                  onClick={() => {
                    // Applies instantly; the menu deliberately stays open so
                    // the user can compare appearances (contract §3).
                    setMode(option.mode);
                  }}
                >
                  {option.icon}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            className="dropdown-item user-menu__item"
            onClick={() => void handleLogout()}
            disabled={busy}
            aria-busy={busy}
          >
            {logoutIcon}
            {busy ? (
              <>
                <Spinner />
                Signing out…
              </>
            ) : (
              'Log out'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
