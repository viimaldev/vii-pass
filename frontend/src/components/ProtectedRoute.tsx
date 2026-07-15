import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Spinner } from './Spinner';

/**
 * Route guard that only renders its children for an authenticated user (FR-006).
 * While the initial session bootstrap is in flight it shows the shared loading
 * spinner centered in the viewport (specs/016-loading-spinner US1) with a
 * visually-hidden textual status for assistive technology; unauthenticated
 * visitors are redirected to the login page.
 */
export function ProtectedRoute({ children }: { children: ReactElement }): ReactElement {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-spinner">
        <p role="status" aria-live="polite" className="mb-0">
          <Spinner size="page" />
          <span className="visually-hidden">Loading…</span>
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
