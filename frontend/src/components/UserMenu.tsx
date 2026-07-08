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

  return (
    <div className="user-menu" ref={containerRef}>
      <button
        type="button"
        className="user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="user-menu__name">{user.displayName}</span>
        <span aria-hidden="true" className="user-menu__caret">
          ▾
        </span>
      </button>

      {open && (
        <div className="user-menu__panel" role="menu" aria-label="Account">
          <div className="user-menu__identity">
            <span className="user-menu__display">{user.displayName}</span>
            <span className="user-menu__username">{user.username}</span>
          </div>
          <button
            type="button"
            role="menuitem"
            className="user-menu__logout"
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
