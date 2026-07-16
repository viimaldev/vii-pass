import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { UserMenu } from './UserMenu';
import { SectionTabs } from './SectionTabs';
import { useVault } from '../vault/VaultContext';

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
  const { refreshVault } = useVault();

  return (
    <div className="app-shell page-bg page-bg--home">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header">
        <nav className="navbar app-navbar">
          <div className="container-fluid gap-3 flex-nowrap align-items-center">
            <Link
              to="/"
              className="navbar-brand fw-bold flex-shrink-0 me-0"
              onClick={refreshVault}
            >
              <img src="/logo/full_logo.png" alt="Vii Pass" width={1468} height={372} />
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
      <main id="main-content" className="app-main flex-grow-1 d-flex flex-column">
        {children}
      </main>
    </div>
  );
}
