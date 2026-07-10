import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { UserMenu } from './UserMenu';
import { SectionTabs } from './SectionTabs';

interface LayoutProps {
  children: ReactNode;
}

/**
 * Accessible application shell: a skip link, semantic landmarks, the product
 * brand, the credential section tabs, and the account menu (Constitution: UX
 * Consistency, FR-016). The header is a full-width Bootstrap navbar laid out as
 * brand (left) · section tabs (center, scrollable) · account menu (right). The
 * tabs render only for a signed-in user with sections, so the same shell serves
 * public and protected screens alike.
 */
export function Layout({ children }: LayoutProps): ReactElement {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header>
        <nav className="navbar bg-body-tertiary border-bottom">
          <div className="container-fluid gap-3 flex-nowrap align-items-center">
            <Link to="/" className="navbar-brand fw-bold flex-shrink-0 me-0">
              vii-pass
            </Link>
            <div className="flex-grow-1 overflow-hidden">
              <SectionTabs />
            </div>
            <div className="flex-shrink-0">
              <UserMenu />
            </div>
          </div>
        </nav>
      </header>
      <main id="main-content" className="flex-grow-1 d-flex flex-column">
        {children}
      </main>
    </div>
  );
}
