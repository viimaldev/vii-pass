import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { UserMenu } from './UserMenu';

interface LayoutProps {
  children: ReactNode;
}

/**
 * Accessible application shell: a skip link, semantic landmarks, the product
 * brand, and the account menu (Constitution: UX Consistency, FR-016). The header
 * is a responsive Bootstrap navbar and each page owns a Bootstrap container, so
 * the shell adapts cleanly from mobile through desktop. The menu renders only
 * when a user is signed in, so the same shell serves public and protected screens
 * alike.
 */
export function Layout({ children }: LayoutProps): ReactElement {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header>
        <nav className="navbar bg-body-tertiary border-bottom">
          <div className="container">
            <Link to="/" className="navbar-brand fw-bold">
              vii-pass
            </Link>
            <UserMenu />
          </div>
        </nav>
      </header>
      <main id="main-content" className="flex-grow-1">
        {children}
      </main>
    </div>
  );
}
