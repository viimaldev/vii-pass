import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for the vii-pass SPA. The production build (`vite build`) emits a
// static bundle to `dist/`, which is deployed to Cloudflare Pages. The API base
// URL is injected at build time via the `VITE_API_BASE_URL` environment variable.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Fail fast if 5173 is taken instead of silently drifting to 5174. A drifted
    // port breaks CORS (ALLOWED_ORIGINS lists :5173) and the SameSite=Lax session
    // cookie, so surfacing the conflict is better than a confusing runtime failure.
    strictPort: true,
  },
});
