import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/**
 * Route guard that only renders its children for an authenticated user (FR-006).
 * While the initial session bootstrap is in flight it shows an accessible loading
 * state; unauthenticated visitors are redirected to the login page.
 */
export function ProtectedRoute({ children }: { children: ReactElement }): ReactElement {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <p role="status" aria-live="polite" className="route-status">
        Loading…
      </p>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
