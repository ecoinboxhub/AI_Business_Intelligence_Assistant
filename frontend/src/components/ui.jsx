import { LayoutDashboard, Sparkles, TrendingUp, Menu, AlertTriangle } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'assistant', label: 'AI Assistant', Icon: Sparkles },
  { id: 'performance', label: 'Performance', Icon: TrendingUp },
];

export function Sidebar({ page }) {
  return (
    <aside className={`sidebar${page.drawerOpen ? ' open' : ''}`}>
      <div className="logo">
        <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="NexaSphere logo" />
        <h2>NexaSphere BI</h2>
      </div>
      <p className="tagline">AI Executive Intelligence</p>
      <hr />
      <nav>
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button key={id}
                  className={`nav-item${page.current === id ? ' active' : ''}`}
                  onClick={() => { page.setPage(id); page.setDrawer(false); }}>
            <Icon size={16} strokeWidth={2.2} /> {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export function BottomNav({ current, setPage }) {
  return (
    <div className="bottom-nav">
      {NAV_ITEMS.map(({ id, label, Icon }) => (
        <button key={id} className={current === id ? 'active' : ''}
                onClick={() => setPage(id)}>
          <Icon size={17} strokeWidth={2.2} />
          {label}
        </button>
      ))}
    </div>
  );
}

export function TopBar({ title, sub, onMenu }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
      <button className="btn-primary" style={{ padding: '9px 12px', display: 'none' }}
              ref={(el) => {
                if (el && window.innerWidth < 1024) el.style.display = 'inline-flex';
              }}
              onClick={onMenu} aria-label="Toggle menu">
        <Menu size={17} />
      </button>
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-sub">{sub}</p>
      </div>
    </div>
  );
}

export function KPICard({ label, value, color = '#4F46E5' }) {
  return (
    <div className="kpi-card" style={{ borderTopColor: color }}>
      <span className="label">{label}</span>
      <div className="value" style={{ color }}>{value}</div>
    </div>
  );
}

export function Skeleton({ h = 180 }) {
  return <div className="skeleton" style={{ height: h }} />;
}

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="error-banner">
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <AlertTriangle size={15} /> {message}
      </span>
      {onRetry && (
        <button className="follow-chip" style={{ background: '#FEE2E2', color: '#991B1B' }}
                onClick={onRetry}>Retry</button>
      )}
    </div>
  );
}
