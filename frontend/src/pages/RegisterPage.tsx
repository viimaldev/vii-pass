import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiClientError } from '../services/apiClient';

/** Username policy (mirrors the server-side rule; research Decision 2). */
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;
/** Allowed username characters: ASCII alphanumeric only (no special characters). */
const USERNAME_PATTERN = /^[A-Za-z0-9]+$/;
/** Password length policy 3–10 (mirrors the server-side rule; research Decision 3). */
const MIN_PASSWORD_LENGTH = 3;
const MAX_PASSWORD_LENGTH = 10;

/**
 * Validate a username against the registration rules, returning a specific,
 * human-readable message for the first violated rule, or `null` when valid
 * (FR-003, FR-004). Mirrors the server-side Zod rule so feedback is immediate.
 */
function validateUsername(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < MIN_USERNAME_LENGTH) {
    return `Username must be at least ${MIN_USERNAME_LENGTH} characters.`;
  }
  if (trimmed.length > MAX_USERNAME_LENGTH) {
    return `Username must be ${MAX_USERNAME_LENGTH} characters or fewer.`;
  }
  if (!USERNAME_PATTERN.test(trimmed)) {
    return 'Username must use letters and numbers only.';
  }
  return null;
}

/**
 * Validate a password's length against the 3–10 policy (FR-007), returning a
 * specific message or `null` when valid.
 */
function validatePassword(value: string): string | null {
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`;
  }
  return null;
}

/**
 * Registration screen (US1). Collects a username, display name, and password with
 * accessible inline validation, then signs the new user in and routes them to the
 * home page. Duplicate usernames and server validation errors are surfaced clearly
 * (FR-008, FR-009, FR-010).
 */
export function RegisterPage(): ReactElement {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  // Inline validity for accessible hints (only flag once the user has typed).
  const usernameError = username.length > 0 ? validateUsername(username) : null;
  const passwordError = password.length > 0 ? validatePassword(password) : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    // Enforce the client-side rules before any network request (FR-009).
    const usernameProblem = validateUsername(username);
    const passwordProblem = validatePassword(password);
    if (usernameProblem || passwordProblem) {
      setError(usernameProblem ?? passwordProblem);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await register(username, displayName, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Unable to create your account. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-card" aria-labelledby="register-heading">
      <h1 id="register-heading">Create your account</h1>

      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        <div className="field">
          <label htmlFor="register-username">Username</label>
          <input
            id="register-username"
            type="text"
            autoComplete="username"
            required
            minLength={MIN_USERNAME_LENGTH}
            maxLength={MAX_USERNAME_LENGTH}
            aria-describedby="register-username-hint"
            aria-invalid={usernameError !== null}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <span id="register-username-hint" className="field-hint">
            {usernameError ?? 'Letters and numbers only, at least 3 characters.'}
          </span>
        </div>

        <div className="field">
          <label htmlFor="register-name">Display name</label>
          <input
            id="register-name"
            type="text"
            autoComplete="name"
            required
            maxLength={100}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={MAX_PASSWORD_LENGTH}
            aria-describedby="register-password-hint"
            aria-invalid={passwordError !== null}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <span id="register-password-hint" className="field-hint">
            {passwordError ?? 'Use 3 to 10 characters.'}
          </span>
        </div>

        {error && (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="button" disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="auth-alt">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </section>
  );
}
