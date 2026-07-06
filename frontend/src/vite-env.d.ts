/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the vii-pass API (the Cloudflare Worker). */
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
