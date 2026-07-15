import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type {
  ResetQuestionResponse,
  ResetVerifyResponse,
} from '@vii-pass/shared';
import { SECURITY_QUESTIONS } from '@vii-pass/shared';
import { useAuth } from '../auth/AuthContext';
import { FieldInfo } from '../components/FieldInfo';
import { Spinner } from '../components/Spinner';
import { ApiClientError, post } from '../services/apiClient';
import {
  deriveKeys,
  deriveRecoveryKeys,
  generateKdfSalt,
  normalizeSecurityAnswer,
  unwrapVaultKey,
  wrapVaultKey,
} from '../vault/crypto';

/** Password length policy 3–10 (mirrors registration; research Decision 3). */
const MIN_PASSWORD_LENGTH = 3;
const MAX_PASSWORD_LENGTH = 10;

/** Validate the new password's length, returning a message or `null` when valid. */
function validatePassword(value: string): string | null {
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`;
  }
  return null;
}

/** The three sequential steps of the reset flow, plus the terminal success state. */
type Step = 'username' | 'answer' | 'password' | 'done';

/**
 * Forgotten-password reset flow (specs/011-dual-user-roles US3). Three steps:
 * (1) admin username → fetch the security question (decoys keep unknown names
 * indistinguishable, FR-010); (2) answer → derive the recovery keys locally and
 * verify (the raw answer never leaves the browser), then unwrap the vault key
 * from the recovery envelope; (3) new password → re-wrap the SAME vault key
 * under fresh password-derived keys and complete (vault data survives, FR-011).
 * All sessions are revoked server-side (FR-012); the user then signs in anew.
 */
export function ResetPasswordPage(): ReactElement {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('username');
  const [username, setUsername] = useState('');
  const [question, setQuestion] = useState<ResetQuestionResponse | null>(null);
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Step-2 artifacts: the one-time token and the locally unwrapped vault key.
  // Kept in refs — sensitive/opaque values that never drive rendering.
  const resetTokenRef = useRef<string | null>(null);
  const vaultKeyRef = useRef<CryptoKey | null>(null);

  // Move focus to each step's first field as the flow advances (a11y).
  const answerInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (step === 'answer') {
      answerInputRef.current?.focus();
    } else if (step === 'password') {
      passwordInputRef.current?.focus();
    }
  }, [step]);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const passwordError = newPassword.length > 0 ? validatePassword(newPassword) : null;

  /** Step 1: resolve the security question for the typed admin username. */
  const handleUsernameSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const normalized = username.trim().toLowerCase();
    if (normalized.length === 0) {
      setError('Enter your admin username.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await post<ResetQuestionResponse>('/api/auth/reset/question', {
        username: normalized,
      });
      setQuestion(result);
      setStep('answer');
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  /** Step 2: derive the recovery keys locally, verify, and unwrap the vault key. */
  const handleAnswerSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!question) {
      return;
    }
    if (answer.trim().length === 0) {
      setError('Enter your security answer.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // The raw answer never leaves the browser: only the derived hash is sent.
      const recovery = await deriveRecoveryKeys(
        normalizeSecurityAnswer(answer),
        question.recoverySalt,
      );
      const { resetToken, vaultKeyWrappedRecovery } = await post<ResetVerifyResponse>(
        '/api/auth/reset/verify',
        { username: username.trim().toLowerCase(), answerHash: recovery.answerHash },
      );
      // Unwrap the vault key locally so step 3 can re-wrap the SAME key under
      // the new password — stored entries stay readable (FR-011).
      vaultKeyRef.current = await unwrapVaultKey(vaultKeyWrappedRecovery, recovery.recoveryWrapKey);
      resetTokenRef.current = resetToken;
      setStep('password');
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 429) {
        setError('Too many failed attempts. Please try again later.');
      } else {
        // Generic for every other cause (wrong answer, unknown name, …) — no
        // enumeration (FR-010).
        setError("That didn't match our records.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  /** Step 3: re-wrap the vault key under the new password and complete the reset. */
  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const problem = validatePassword(newPassword);
    if (problem) {
      setError(problem);
      return;
    }
    const vaultKey = vaultKeyRef.current;
    const resetToken = resetTokenRef.current;
    if (!vaultKey || !resetToken) {
      setError('Your reset session was interrupted. Please start over.');
      setStep('username');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const newKdfSalt = generateKdfSalt();
      const keys = await deriveKeys(newPassword, newKdfSalt);
      const newVaultKeyWrapped = await wrapVaultKey(vaultKey, keys.wrapKey);
      await post<void>('/api/auth/reset/complete', {
        username: username.trim().toLowerCase(),
        resetToken,
        newAuthHash: keys.authHash,
        newKdfSalt,
        newVaultKeyWrapped,
      });
      // Drop the sensitive step-2 artifacts once the reset has landed.
      vaultKeyRef.current = null;
      resetTokenRef.current = null;
      setStep('done');
    } catch (err) {
      setError(
        err instanceof ApiClientError && err.status !== 401
          ? err.message
          : 'This reset link is no longer valid. Please start over.',
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
                <h1 id="reset-heading" className="h3 mb-4">
                  Reset your password
                </h1>

                {step === 'username' && (
                  <form
                    onSubmit={(event) => void handleUsernameSubmit(event)}
                    noValidate
                    aria-labelledby="reset-heading"
                  >
                    <div className="mb-3">
                      <label htmlFor="reset-username" className="form-label">
                        Admin username
                      </label>
                      <FieldInfo id="reset-username-info" label="About password reset">
                        Password reset uses your admin username and security question.
                      </FieldInfo>
                      <input
                        id="reset-username"
                        type="text"
                        className="form-control"
                        autoComplete="username"
                        required
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
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
                          Checking…
                        </>
                      ) : (
                        'Continue'
                      )}
                    </button>
                  </form>
                )}

                {step === 'answer' && question && (
                  <form
                    onSubmit={(event) => void handleAnswerSubmit(event)}
                    noValidate
                    aria-labelledby="reset-heading"
                  >
                    <div className="mb-3">
                      <label htmlFor="reset-answer" className="form-label">
                        {SECURITY_QUESTIONS[question.questionId] ?? 'Security question'}
                      </label>
                      <FieldInfo id="reset-answer-info" label="About the security answer">
                        Not case-sensitive.
                      </FieldInfo>
                      <input
                        id="reset-answer"
                        ref={answerInputRef}
                        type="text"
                        className="form-control"
                        autoComplete="off"
                        required
                        maxLength={200}
                        value={answer}
                        onChange={(event) => setAnswer(event.target.value)}
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
                          Verifying…
                        </>
                      ) : (
                        'Verify answer'
                      )}
                    </button>
                  </form>
                )}

                {step === 'password' && (
                  <form
                    onSubmit={(event) => void handlePasswordSubmit(event)}
                    noValidate
                    aria-labelledby="reset-heading"
                  >
                    <div className="mb-3">
                      <label htmlFor="reset-password" className="form-label">
                        New password
                      </label>
                      <FieldInfo id="reset-password-info" label="About the new password">
                        Use 3 to 10 characters. Applies to both of your usernames.
                      </FieldInfo>
                      <input
                        id="reset-password"
                        ref={passwordInputRef}
                        type="password"
                        className={`form-control${passwordError ? ' is-invalid' : ''}`}
                        autoComplete="new-password"
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                        maxLength={MAX_PASSWORD_LENGTH}
                        aria-describedby="reset-password-hint"
                        aria-invalid={passwordError !== null}
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                      />
                      {passwordError && (
                        <div id="reset-password-hint" className="form-text text-danger">
                          {passwordError}
                        </div>
                      )}
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
                          Resetting…
                        </>
                      ) : (
                        'Reset password'
                      )}
                    </button>
                  </form>
                )}

                {step === 'done' && (
                  <div role="status">
                    <p className="mb-4">
                      Your password has been reset. Sign in with either username and your new
                      password — your saved entries are unchanged.
                    </p>
                    <Link to="/login" className="btn btn-primary w-100">
                      Go to sign in
                    </Link>
                  </div>
                )}

                <p className="auth-alt mt-4 mb-0">
                  Remembered it? <Link to="/login">Sign in</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
