import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { UserMenu } from './UserMenu';

interface LayoutProps {
  children: ReactNode;
}

/**
 * Accessible application shell: a skip link, semantic landmarks, the product
 * brand, and the account menu (Constitution: UX Consistency, FR-016). The menu
 * renders only when a user is signed in, so the same shell serves public and
 * protected screens alike.
 */
export function Layout({ children }: LayoutProps): ReactElement {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header">
        <Link to="/" className="app-brand">
          vii-pass
        </Link>
        <UserMenu />
      </header>
      <main id="main-content" className="app-main">
        {children}
      </main>
    </div>
  );
}
