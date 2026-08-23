import ChartRenderer from './ChartRenderer';
import { renderMdLite } from '../utils/format';

function Section({ cls, title, items, ordered }) {
  if (!items?.length) return null;
  return (
    <>
      <div className={`section-label ${cls}`}>{title}</div>
      <div className={ordered ? 'facts-list' : ''}>
        {items.map((item, i) => (
          ordered
            ? <div key={i} className="fact-item"
                   dangerouslySetInnerHTML={{ __html: renderMdLite(item) }} />
            : <div key={i} className={`${cls === 'section-recs' ? 'rec-item' : 'risk-item'}`}
                   dangerouslySetInnerHTML={{ __html: renderMdLite(item) }} />
        ))}
      </div>
    </>
  );
}

export default function ChatMessage({ response, onFollowUp }) {
  return (
    <div className="ai-card">
      <div className="metrics-row">
        {response.category && (
          <span className="category-badge">{String(response.category).replace(/_/g, ' ')}</span>
        )}
        {(response.metrics || []).map((m, i) => (
          <span className="metric-chip" key={i}>
            {m.label}: <strong>{m.value}</strong>
          </span>
        ))}
      </div>

      <p className="ai-answer" dangerouslySetInnerHTML={{ __html: renderMdLite(response.answer) }} />

      {response.chart && response.chart.data?.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div className="chart-title">{response.chart_title || response.label}</div>
          <ChartRenderer analysis={response} height={260} />
        </div>
      )}

      <Section cls="section-facts" title="Observed Facts" items={response.findings} ordered />
      <Section cls="section-risks" title="Risks" items={response.risks} />
      <Section cls="section-recs" title="Recommendations" items={response.recommendations} />

      {response.follow_up_questions?.length > 0 && (
        <div className="chip-row">
          {response.follow_up_questions.map((fq, i) => (
            <button key={i} className="follow-chip" onClick={() => onFollowUp(fq)}>
              {fq}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 11, color: '#94A3B8' }}>
        Confidence: {response.confidence} · All figures computed by Pandas, narrative by AI
      </div>
    </div>
  );
}
