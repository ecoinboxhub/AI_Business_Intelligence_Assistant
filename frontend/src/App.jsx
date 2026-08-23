import { useState } from 'react';
import { BottomNav, Sidebar } from './components/ui';
import Dashboard from './pages/Dashboard';
import Assistant from './pages/Assistant';
import Performance from './pages/Performance';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar page={{ current: page, setPage, drawerOpen, setDrawer: setDrawerOpen }} />
      <main className="main">
        {page === 'dashboard' && <Dashboard />}
        {page === 'assistant' && <Assistant />}
        {page === 'performance' && <Performance />}
      </main>
      <BottomNav current={page} setPage={setPage} />
    </div>
  );
}
