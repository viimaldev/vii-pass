import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/**
 * Renders one decorative inline Bootstrap-Icons glyph for a menu row. Icons are
 * local to this component (only two glyphs are needed — no icon dependency,
 * matching the repo's inline-SVG pattern) and hidden from assistive technology;
 * the row label provides the accessible text.
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

/** Bootstrap Icons "palette" — Change theme row. */
const paletteIcon = menuIcon(
  <>
    <path d="M8 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m4 3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M5.5 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m.5 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" />
    <path d="M16 8c0 3.15-1.866 2.585-3.567 2.07C11.42 9.763 10.465 9.473 10 10c-.603.683-.475 1.819-.351 2.92C9.826 14.495 9.996 16 8 16a8 8 0 1 1 8-8m-8 7c.611 0 .654-.171.655-.176.078-.146.124-.464.07-1.119-.014-.168-.037-.37-.061-.591-.052-.464-.112-1.005-.118-1.462-.01-.707.083-1.61.704-2.314.369-.417.845-.578 1.272-.618.404-.038.812.026 1.16.104.343.077.702.186 1.025.284l.028.008c.346.105.658.199.953.266.653.148.904.083.991.024C14.717 9.38 15 9.161 15 8a7 7 0 1 0-7 7" />
  </>,
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

/**
 * Corner account menu (US4, redesigned in feature 012). The panel shows an
 * identity header — a circular initial badge (never a photo) beside the display
 * name (large, bold) over the username (small, muted) — followed by icon-led
 * menu rows: a non-functional "Change theme" placeholder and the logout action.
 * Renders nothing when no user is authenticated, so it is safe to mount on
 * public screens.
 */
export function UserMenu(): ReactElement | null {
  const { user, logout } = useAuth();
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
          <button
            type="button"
            role="menuitem"
            className="dropdown-item user-menu__item"
            onClick={() => {
              // Intentionally no effect (FR-006): visual placeholder until the
              // theme-switching feature ships. Does not close the menu.
            }}
          >
            {paletteIcon}
            Change theme
          </button>
          <button
            type="button"
            role="menuitem"
            className="dropdown-item user-menu__item"
            onClick={() => void handleLogout()}
            disabled={busy}
            aria-busy={busy}
          >
            {logoutIcon}
            {busy ? 'Signing out…' : 'Log out'}
          </button>
        </div>
      )}
    </div>
  );
}
