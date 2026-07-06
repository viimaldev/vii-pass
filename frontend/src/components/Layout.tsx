import type { ReactElement, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

/** Primary navigation entries; each user story appends its screen here. */
const navItems: ReadonlyArray<{ to: string; label: string }> = [
  { to: '/', label: 'Health' },
  { to: '/records', label: 'Records' },
  { to: '/files', label: 'Files' },
];

/**
 * Accessible application shell: a skip link, semantic landmarks, and a
 * keyboard-navigable primary navigation (Constitution: UX Consistency, FR-016).
 */
export function Layout({ children }: LayoutProps): ReactElement {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header">
        <span className="app-brand">vii-pass</span>
        <nav aria-label="Primary">
          <ul className="nav-list">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    isActive ? 'nav-link nav-link--active' : 'nav-link'
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main-content" className="app-main">
        {children}
      </main>
    </div>
  );
}
