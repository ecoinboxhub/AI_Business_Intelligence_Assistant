import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { fetchAnalysis, fetchCatalog } from '../services/api';
import ChartRenderer from '../components/ChartRenderer';
import { TopBar, Skeleton, ErrorBanner, KPICard } from '../components/ui';
import { fmtFull } from '../utils/format';
import { COLORS } from '../theme';

function toCsv(data) {
  if (!data?.length) return '';
  const cols = Object.keys(data[0]);
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  return [cols.join(','), ...data.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

function exportCsv(filename, data) {
  const blob = new Blob([toCsv(data)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Performance() {
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCatalog().then((c) => {
      setCatalog(c);
      if (c.length) select(c[0].id);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (id) => {
    setSelected(id);
    setResult(undefined);
    setError('');
    fetchAnalysis(id).then(setResult).catch((e) => setError(e.message));
  };

  return (
    <>
      <TopBar title="Performance Drill-Down" sub="Deterministic analysis across all nine business dimensions — exportable" />
      <ErrorBanner message={error} onRetry={() => selected && select(selected)} />

      <div className="chip-row" style={{ marginBottom: 20 }}>
        {catalog.map((c) => (
          <button key={c.id}
                  className="follow-chip"
                  style={selected === c.id ? { background: COLORS.primary, color: '#fff' } : undefined}
                  onClick={() => select(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      {!result || result === undefined ? (
        <Skeleton h={320} />
      ) : (
        <>
          <div className="kpi-grid">
            {(result.metrics || []).map((m, i) => (
              <KPICard key={i} label={m.label} value={m.value} />
            ))}
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{result.label} — chart</h3>
              <button className="btn-primary" style={{ padding: '8px 14px', fontSize: 12.5 }}
                      onClick={() => exportCsv(selected, result.chart.data)}>
                <Download size={13} /> Export CSV
              </button>
            </div>
            <ChartRenderer analysis={result} height={330} />
          </div>

          {result.secondary_chart && (
            <div className="card">
              <h3>Secondary view</h3>
              <ChartRenderer analysis={{ ...result, chart: result.secondary_chart }} height={300} />
            </div>
          )}

          <div className="grid-2">
            <div className="card">
              <h3>Data table</h3>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>{Object.keys(result.chart.data[0]).map((k) => <th key={k}>{k}</th>)}</tr>
                  </thead>
                  <tbody>
                    {result.chart.data.map((row, i) => (
                      <tr key={i}>
                        {Object.keys(result.chart.data[0]).map((k) => {
                          const v = row[k];
                          const isMoney = typeof v === 'number' && Math.abs(v) >= 10000 && !String(k).includes('%') && k !== 'Volume';
                          return <td key={k}>{isMoney ? fmtFull(v) : String(v)}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div className="card">
                <h3 style={{ color: '#0284C7' }}>Observed Facts</h3>
                {(result.findings || []).map((f, i) => (
                  <p key={i} style={{ fontSize: 13.5, color: '#334155', margin: '0 0 8px' }}>{f}</p>
                ))}
              </div>
              <div className="card">
                <h3 style={{ color: '#047857' }}>Recommendations</h3>
                {(result.recommendations || []).map((r, i) => (
                  <div key={i} className="rec-item">{r}</div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
