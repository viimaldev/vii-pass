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
    <div className="page-bg page-bg--home flex-grow-1">
      <div className="container py-4 py-md-5">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-10 col-xl-8">
            <section aria-labelledby="home-heading" className="card shadow-sm">
              <div className="card-body p-4 p-sm-5">
                <h1 id="home-heading" className="h3 mb-3">
                  Welcome, {user?.displayName ?? 'friend'}
                </h1>
                <p className="text-muted mb-0">
                  You are signed in to vii-pass. Your secure password vault will appear here.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
