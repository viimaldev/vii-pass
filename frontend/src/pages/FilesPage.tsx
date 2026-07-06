import { useState } from 'react';
import type { ReactElement } from 'react';
import type { FileAssetMeta } from '../types';
import { FileUpload } from '../components/FileUpload';

/** Base URL of the API, used to build direct file-retrieval links. */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * Files screen (US3): upload a file, then retrieve and preview it by its
 * returned key via `GET /api/files/:key`. Rejected uploads surface a clear
 * message from {@link FileUpload}; a failed retrieval shows a not-found notice.
 */
export function FilesPage(): ReactElement {
  const [uploaded, setUploaded] = useState<FileAssetMeta | null>(null);

  return (
    <section aria-labelledby="files-heading">
      <h1 id="files-heading">Files</h1>

      <FileUpload onUploaded={setUploaded} />

      {uploaded && (
        <div aria-live="polite">
          <h2>Uploaded file</h2>
          <dl>
            <dt>Key</dt>
            <dd>
              <code>{uploaded.key}</code>
            </dd>
            <dt>Type</dt>
            <dd>{uploaded.contentType}</dd>
            <dt>Size</dt>
            <dd>{uploaded.size} bytes</dd>
          </dl>
          <FilePreview meta={uploaded} />
        </div>
      )}
    </section>
  );
}

/** Retrieve and preview a stored file by key. */
function FilePreview({ meta }: { meta: FileAssetMeta }): ReactElement {
  const [failed, setFailed] = useState(false);
  const url = `${API_BASE}/api/files/${encodeURIComponent(meta.key)}`;
  const isImage = meta.contentType.startsWith('image/');

  if (failed) {
    return <p className="alert alert--error">The file could not be retrieved.</p>;
  }

  return (
    <div>
      <h3>Retrieved file</h3>
      {isImage ? (
        <img
          src={url}
          alt={`Preview of the uploaded file ${meta.key}`}
          onError={() => setFailed(true)}
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      ) : (
        <p>
          <a href={url} target="_blank" rel="noreferrer">
            Open the file in a new tab
          </a>
        </p>
      )}
    </div>
  );
}
