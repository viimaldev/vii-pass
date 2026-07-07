import type { ReactElement } from 'react';
import { useAuth } from '../auth/AuthContext';

/**
 * Authenticated landing page (US3). Only reachable through `ProtectedRoute`, so a
 * user is always present; it greets them by display name and stands in for the
 * future vault experience.
 */
export function HomePage(): ReactElement {
  const { user } = useAuth();

  return (
    <section aria-labelledby="home-heading">
      <h1 id="home-heading">Welcome, {user?.displayName ?? 'friend'}</h1>
      <p className="text-muted">
        You are signed in to vii-pass. Your secure password vault will appear here.
      </p>
    </section>
  );
}
