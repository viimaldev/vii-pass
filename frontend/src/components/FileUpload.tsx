import { useState } from 'react';
import type { ChangeEvent, FormEvent, ReactElement } from 'react';
import type { FileAssetMeta } from '../types';
import { ApiClientError, postForm } from '../services/apiClient';

interface FileUploadProps {
  /** Called with the stored file's metadata after a successful upload. */
  onUploaded: (meta: FileAssetMeta) => void;
}

/**
 * Accessible file-upload control (US3, FR-016): a labelled file input with a
 * help hint, an `aria-live` error region, and a disabled state while uploading.
 * Server-side limits (type/size) are surfaced as friendly messages.
 */
export function FileUpload({ onUploaded }: FileUploadProps): ReactElement {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    setError(null);
    setFile(event.target.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError(null);

    if (!file) {
      setError('Please choose a file to upload.');
      return;
    }

    setUploading(true);
    try {
      const data = new FormData();
      data.append('file', file);
      const meta = await postForm<FileAssetMeta>('/api/files', data);
      onUploaded(meta);
      setFile(null);
      formElement.reset();
    } catch (uploadError) {
      setError(
        uploadError instanceof ApiClientError
          ? uploadError.message
          : 'Upload failed. Please try again.',
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} aria-labelledby="file-upload-heading">
      <h2 id="file-upload-heading">Upload a file</h2>

      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}

      <div className="field">
        <label htmlFor="file-input">Choose a file</label>
        <input
          id="file-input"
          name="file"
          type="file"
          onChange={handleChange}
          aria-describedby="file-help"
        />
        <span id="file-help" className="text-muted">
          Images and common document types are supported, subject to a size limit.
        </span>
      </div>

      <button className="button" type="submit" disabled={uploading || !file}>
        {uploading ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  );
}
