import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { askQuestion, fetchCatalog } from '../services/api';
import ChatMessage from '../components/ChatMessage';
import { ErrorBanner } from '../components/ui';

export default function Assistant() {
  const [catalog, setCatalog] = useState([]);
  const [question, setQuestion] = useState('');
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    fetchCatalog().then(setCatalog).catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread, loading]);

  const ask = async (q) => {
    const text = (q || question).trim();
    if (!text || loading) return;
    setLoading(true);
    setError('');
    setQuestion('');
    setThread((prev) => [...prev, { role: 'user', text }]);
    try {
      const res = await askQuestion(text);
      setThread((prev) => [...prev, { role: 'ai', res }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="page-title">Conversational Business Intelligence</h1>
      <p className="page-sub">Structured answers with charts — numbers computed deterministically by Pandas, narrative by AI</p>

      <div className="chip-row" style={{ marginBottom: 18 }}>
        {(catalog.length ? catalog : []).slice(0, 9).map((c) => (
          <button key={c.id} className="follow-chip" onClick={() => ask(c.label)}>
            {c.label}
          </button>
        ))}
      </div>

      <ErrorBanner message={error} onRetry={() => ask(thread.filter((t) => t.role === 'user').slice(-1)[0]?.text)} />

      <div className="ask-bar">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="Ask a business question… e.g. Which region generates the most revenue and profit?"
        />
        <button className="btn-primary" onClick={() => ask()} disabled={loading}>
          {loading ? <span className="typing"><span /><span /><span /></span>
                   : <><Sparkles size={14} /> Ask</>}
        </button>
      </div>

      <div className="chat-thread">
        {thread.map((t, i) =>
          t.role === 'user'
            ? <div key={i} className="user-bubble">{t.text}</div>
            : <ChatMessage key={i} response={t.res} onFollowUp={ask} />
        )}
        {loading && thread[thread.length - 1]?.role === 'user' && !error && (
          <div className="ai-card" style={{ maxWidth: 120 }}>
            <span className="typing"><span /><span /><span /></span>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </>
  );
}
