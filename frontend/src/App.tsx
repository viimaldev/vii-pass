import type { ReactElement } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HealthPage } from './pages/HealthPage';
import { RecordsPage } from './pages/RecordsPage';
import { FilesPage } from './pages/FilesPage';

/**
 * Application root. Per-user-story screens register their routes here as they are
 * implemented (US1 health, US2 records, US3 files).
 */
export function App(): ReactElement {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HealthPage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/files" element={<FilesPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
