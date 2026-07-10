import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { VaultProvider } from './vault/VaultContext';
// Bootstrap first (base layer: responsive grid, breakpoints, components), then
// tokens.css layers the vii-pass design system + accessibility overrides on top.
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/tokens.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element "#root" was not found in the document.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <VaultProvider>
        <App />
      </VaultProvider>
    </AuthProvider>
  </StrictMode>,
);
