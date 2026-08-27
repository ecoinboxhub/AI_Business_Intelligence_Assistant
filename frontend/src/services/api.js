const API_BASE = 'https://nexasphere-bi.onrender.com/api';

async function handle(res, label) {
  if (!res.ok) throw new Error(`${label} failed (${res.status})`);
  return res.json();
}

export async function fetchKPIs() {
  return handle(await fetch(`${API_BASE}/kpis`), 'Failed to fetch KPIs');
}

export async function fetchInsights() {
  return handle(await fetch(`${API_BASE}/insights`), 'Failed to fetch insights');
}

export async function fetchCatalog() {
  return handle(await fetch(`${API_BASE}/catalog`), 'Failed to fetch catalog');
}

export async function fetchAnalysis(intentId) {
  return handle(await fetch(`${API_BASE}/analysis/${intentId}`), `Analysis '${intentId}' failed`);
}

export async function askQuestion(question) {
  return handle(
    await fetch(`${API_BASE}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    }),
    'Failed to post question'
  );
}
