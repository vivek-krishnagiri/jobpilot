import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import BrowseJobs from './pages/BrowseJobs';
import CurrentJobs from './pages/CurrentJobs';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/browse" replace />} />
          <Route path="browse" element={<BrowseJobs />} />
          <Route path="current" element={<CurrentJobs />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
