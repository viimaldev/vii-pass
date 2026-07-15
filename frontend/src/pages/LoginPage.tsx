import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Spinner } from '../components/Spinner';
import { ApiClientError } from '../services/apiClient';

/**
 * Login screen (US2). Presents an accessible username + password form, surfaces a
 * single generic error on failure (FR-012), and shows a "session expired" notice
 * when a previous session was lost (FR-015). On success the user is routed to the
 * protected home page.
 */
export function LoginPage(): ReactElement {
  const { user, login, sessionExpired, clearSessionExpired } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // An already-authenticated visitor should not see the login form.
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      clearSessionExpired();
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Unable to sign in. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-bg page-bg--login min-vh-100 d-flex flex-column">
      <div className="container py-4 py-md-5 flex-grow-1 d-flex flex-column justify-content-center">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5">
            <div className="card shadow-sm">
              <div className="card-body p-4 p-sm-5">
                <p className="auth-brand">Vii Pass</p>
                <h1 id="login-heading" className="h3 mb-4">
                  Sign in
                </h1>

                {sessionExpired && (
                  <div className="alert alert--error" role="status">
                    Your session has expired. Please sign in again.
                  </div>
                )}

                <form
                  onSubmit={(event) => void handleSubmit(event)}
                  noValidate
                  aria-labelledby="login-heading"
                >
                  <div className="mb-3">
                    <label htmlFor="login-username" className="form-label">
                      Username
                    </label>
                    <input
                      id="login-username"
                      type="text"
                      className="form-control"
                      autoComplete="username"
                      required
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="login-password" className="form-label">
                      Password
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      className="form-control"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>

                  {error && (
                    <div className="alert alert--error" role="alert">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={submitting}
                    aria-busy={submitting}
                  >
                    {submitting ? (
                      <>
                        <Spinner />
                        Signing in…
                      </>
                    ) : (
                      'Sign in'
                    )}
                  </button>
                </form>

                <p className="auth-alt mt-4 mb-0">
                  New to Vii Pass? <Link to="/register">Create an account</Link>
                </p>
                <p className="auth-alt mt-2 mb-0">
                  <Link to="/reset">Forgot password?</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
