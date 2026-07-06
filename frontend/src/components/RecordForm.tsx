import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { StoredRecord } from '../types';
import { ApiClientError, post } from '../services/apiClient';

interface RecordFormProps {
  /** Called with the created record after a successful save. */
  onCreated: (record: StoredRecord) => void;
}

/**
 * Accessible create-record form (US2, FR-016): labelled inputs, inline
 * validation, an `aria-live` error region, and a disabled state while saving.
 */
export function RecordForm({ onCreated }: RecordFormProps): ReactElement {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setTitleError(null);

    if (title.trim().length === 0) {
      setTitleError('Title is required.');
      return;
    }

    setSubmitting(true);
    try {
      const record = await post<StoredRecord>('/api/records', {
        title: title.trim(),
        content: content.trim() || undefined,
      });
      onCreated(record);
      setTitle('');
      setContent('');
    } catch (error) {
      setFormError(
        error instanceof ApiClientError
          ? error.message
          : 'Could not save the record. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      aria-labelledby="record-form-heading"
      noValidate
    >
      <h2 id="record-form-heading">Create a record</h2>

      {formError && (
        <p className="alert alert--error" role="alert">
          {formError}
        </p>
      )}

      <div className="field">
        <label htmlFor="record-title">Title</label>
        <input
          id="record-title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={200}
          aria-describedby={titleError ? 'record-title-error' : undefined}
          aria-invalid={titleError ? true : undefined}
        />
        {titleError && (
          <span id="record-title-error" className="alert alert--error">
            {titleError}
          </span>
        )}
      </div>

      <div className="field">
        <label htmlFor="record-content">Content (optional)</label>
        <textarea
          id="record-content"
          name="content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={5000}
          rows={4}
        />
      </div>

      <button className="button" type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : 'Save record'}
      </button>
    </form>
  );
}
