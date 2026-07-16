import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { SECURITY_QUESTIONS } from '@vii-pass/shared';
import { useAuth } from '../auth/AuthContext';
import { FieldInfo } from '../components/FieldInfo';
import { Spinner } from '../components/Spinner';
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
 * (FR-003). Mirrors the server-side Zod rule so feedback is immediate.
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
 * Validate a password's length against the 3–10 policy, returning a specific
 * message or `null` when valid.
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
 * Registration screen (specs/011-dual-user-roles US1). Collects an ADMIN
 * username, a normal (view-only) username, a display name, ONE shared password,
 * and a security question + answer (password-reset support) with accessible
 * inline validation, then creates the account and signs the caller in as admin.
 * Duplicate/identical usernames and server validation errors are surfaced
 * clearly (FR-001, FR-002, FR-003, FR-013).
 */
export function RegisterPage(): ReactElement {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [adminUsername, setAdminUsername] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [securityQuestionId, setSecurityQuestionId] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  // Inline validity for accessible hints (only flag once the user has typed).
  const adminUsernameError = adminUsername.length > 0 ? validateUsername(adminUsername) : null;
  const usernameError =
    username.length > 0
      ? (validateUsername(username) ??
        (username.trim().toLowerCase() === adminUsername.trim().toLowerCase()
          ? 'Admin username and username must be different.'
          : null))
      : null;
  const passwordError = password.length > 0 ? validatePassword(password) : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    // Enforce the client-side rules before any network/KDF work (FR-003).
    const adminProblem = validateUsername(adminUsername);
    const usernameProblem = validateUsername(username);
    const passwordProblem = validatePassword(password);
    const identicalProblem =
      !adminProblem &&
      !usernameProblem &&
      adminUsername.trim().toLowerCase() === username.trim().toLowerCase()
        ? 'Admin username and username must be different.'
        : null;
    const questionProblem = securityQuestionId === '' ? 'Choose a security question.' : null;
    const answerProblem = securityAnswer.trim().length === 0 ? 'Enter a security answer.' : null;
    const problem =
      adminProblem ??
      usernameProblem ??
      identicalProblem ??
      passwordProblem ??
      questionProblem ??
      answerProblem;
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await register({
        adminUsername: adminUsername.trim().toLowerCase(),
        username: username.trim().toLowerCase(),
        displayName,
        password,
        securityQuestionId: Number(securityQuestionId),
        securityAnswer,
      });
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
    <div className="page-bg page-bg--login min-vh-100 d-flex flex-column">
      <div className="container py-4 py-md-5 flex-grow-1 d-flex flex-column justify-content-center">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5">
            <div className="card shadow-sm">
              <div className="card-body p-4 p-sm-5">
                <img
                  className="auth-logo"
                  src="/logo/full_logo.png"
                  alt="Vii Pass"
                  width={1468}
                  height={372}
                />
                <h1 id="register-heading" className="h3 mb-4">
                  Create your account
                </h1>

                <form
                  onSubmit={(event) => void handleSubmit(event)}
                  noValidate
                  aria-labelledby="register-heading"
                >
                  <div className="mb-3">
                    <label htmlFor="register-admin-username" className="form-label">
                      Admin username
                    </label>
                    <FieldInfo id="register-admin-username-info" label="About the admin username">
                      Full access: add, edit, move, and delete entries. Letters and numbers only.
                    </FieldInfo>
                    <input
                      id="register-admin-username"
                      type="text"
                      className={`form-control${adminUsernameError ? ' is-invalid' : ''}`}
                      autoComplete="username"
                      required
                      minLength={MIN_USERNAME_LENGTH}
                      maxLength={MAX_USERNAME_LENGTH}
                      aria-describedby="register-admin-username-hint"
                      aria-invalid={adminUsernameError !== null}
                      value={adminUsername}
                      onChange={(event) => setAdminUsername(event.target.value)}
                    />
                    {adminUsernameError && (
                      <div id="register-admin-username-hint" className="form-text text-danger">
                        {adminUsernameError}
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="register-username" className="form-label">
                      Username
                    </label>
                    <FieldInfo id="register-username-info" label="About the username">
                      View-only access: see, reveal, and copy entries. Must differ from the admin
                      username.
                    </FieldInfo>
                    <input
                      id="register-username"
                      type="text"
                      className={`form-control${usernameError ? ' is-invalid' : ''}`}
                      autoComplete="off"
                      required
                      minLength={MIN_USERNAME_LENGTH}
                      maxLength={MAX_USERNAME_LENGTH}
                      aria-describedby="register-username-hint"
                      aria-invalid={usernameError !== null}
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                    />
                    {usernameError && (
                      <div id="register-username-hint" className="form-text text-danger">
                        {usernameError}
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="register-name" className="form-label">
                      Display name
                    </label>
                    <input
                      id="register-name"
                      type="text"
                      className="form-control"
                      autoComplete="name"
                      required
                      maxLength={100}
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="register-password" className="form-label">
                      Password
                    </label>
                    <FieldInfo id="register-password-info" label="About the password">
                      Use 3 to 10 characters. Shared by both usernames.
                    </FieldInfo>
                    <input
                      id="register-password"
                      type="password"
                      className={`form-control${passwordError ? ' is-invalid' : ''}`}
                      autoComplete="new-password"
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                      maxLength={MAX_PASSWORD_LENGTH}
                      aria-describedby="register-password-hint"
                      aria-invalid={passwordError !== null}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    {passwordError && (
                      <div id="register-password-hint" className="form-text text-danger">
                        {passwordError}
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="register-question" className="form-label">
                      Security question
                    </label>
                    <FieldInfo id="register-question-info" label="About the security question">
                      Used to reset your password if you forget it.
                    </FieldInfo>
                    <select
                      id="register-question"
                      className="form-select"
                      required
                      value={securityQuestionId}
                      onChange={(event) => setSecurityQuestionId(event.target.value)}
                    >
                      <option value="" disabled>
                        Choose a question…
                      </option>
                      {SECURITY_QUESTIONS.map((question, index) => (
                        <option key={question} value={index}>
                          {question}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="register-answer" className="form-label">
                      Security answer
                    </label>
                    <FieldInfo id="register-answer-info" label="About the security answer">
                      Not case-sensitive. If you forget both your password and this answer, your
                      saved entries cannot be recovered.
                    </FieldInfo>
                    <input
                      id="register-answer"
                      type="text"
                      className="form-control"
                      autoComplete="off"
                      required
                      maxLength={200}
                      value={securityAnswer}
                      onChange={(event) => setSecurityAnswer(event.target.value)}
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
                        Creating account…
                      </>
                    ) : (
                      'Create account'
                    )}
                  </button>
                </form>

                <p className="auth-alt mt-4 mb-0">
                  Already have an account? <Link to="/login">Sign in</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
