import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/**
 * Corner account menu (US4). Shows the signed-in user's identity and a logout
 * action behind a keyboard-accessible disclosure button. Renders nothing when no
 * user is authenticated, so it is safe to mount on public screens.
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
          <div className="px-3 py-2 border-bottom">
            <div className="fw-semibold">{user.displayName}</div>
            <div className="text-muted small text-break">{user.username}</div>
          </div>
          <button
            type="button"
            role="menuitem"
            className="dropdown-item"
            onClick={() => void handleLogout()}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? 'Signing out…' : 'Log out'}
          </button>
        </div>
      )}
    </div>
  );
}
