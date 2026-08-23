import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { fetchAnalysis, fetchInsights, fetchKPIs } from '../services/api';
import { TopBar, KPICard, Skeleton, ErrorBanner } from '../components/ui';
import ChartRenderer from '../components/ChartRenderer';
import { fmtNairaCompact } from '../utils/format';
import { COLORS } from '../theme';

const DASHBOARD_CHARTS = [
  { id: 'revenue_profit_drivers', title: 'Revenue & Profit by Region' },
  { id: 'campaign_roi', title: 'Campaign ROI Leaderboard' },
  { id: 'customer_segments', title: 'Customer Segment Value' },
  { id: 'delivery_partners', title: 'Delivery Partner Scorecard' },
];

export default function Dashboard() {
  const [kpis, setKpis] = useState(null);
  const [insights, setInsights] = useState(null);
  const [charts, setCharts] = useState({});
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    fetchKPIs().then(setKpis).catch((e) => setError(e.message));
    fetchInsights().then(setInsights).catch(() => {});
    DASHBOARD_CHARTS.forEach((c) => {
      fetchAnalysis(c.id)
        .then((res) => setCharts((prev) => ({ ...prev, [c.id]: res })))
        .catch(() => setCharts((prev) => ({ ...prev, [c.id]: null })));
    });
  };

  useEffect(load, []);

  return (
    <>
      <TopBar title="Executive Performance Dashboard"
              sub="Live deterministic KPIs over the full dataset — every figure computed by Pandas" />
      <ErrorBanner message={error} onRetry={load} />

      {!kpis ? (
        <div className="kpi-grid">{[...Array(6)].map((_, i) => <Skeleton key={i} h={92} />)}</div>
      ) : (
        <div className="kpi-grid">
          <KPICard label="Total Revenue (Net)" value={fmtNairaCompact(kpis.net_revenue)} />
          <KPICard label="Gross Profit" value={fmtNairaCompact(kpis.gross_profit)} color={COLORS.emerald} />
          <KPICard label="Profit Margin" value={`${kpis.profit_margin_pct}%`} color={COLORS.emerald} />
          <KPICard label="Return Rate" value={`${kpis.return_rate_pct}%`} color={COLORS.crimson} />
          <KPICard label="Delivery Delay Rate" value={`${kpis.delivery_delay_pct}%`} color={COLORS.amber} />
          <KPICard label="Target Attainment"
                   value={`${kpis.target_attainment_pct}%`}
                   color={kpis.target_attainment_pct >= 100 ? COLORS.emerald : COLORS.crimson} />
        </div>
      )}

      {insights && (
        <div className="insight-banner">
          <h3><Zap size={14} /> Proactive Anomaly Insights</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {insights.findings.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}

      <div className="charts-grid">
        {DASHBOARD_CHARTS.map((c) => {
          const res = charts[c.id];
          return (
            <div className="card" key={c.id}>
              <h3>{c.title}</h3>
              {res === undefined ? <Skeleton />
                : res === null ? <p style={{ color: '#94A3B8', fontSize: 13 }}>Chart unavailable.</p>
                  : <ChartRenderer analysis={res} height={270} />}
            </div>
          );
        })}
      </div>
    </>
  );
}
