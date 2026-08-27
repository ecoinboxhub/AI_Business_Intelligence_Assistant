const API_BASE = 'https://ai-business-intelligence-assistant.onrender.com/api';

const TIMEOUT_MS = 15000;

async function apiFetch(url, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(body || `Request failed (${res.status})`);
    }
    return res.json();
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError' || e.message?.includes('abort')) {
      throw new Error('Connection timed out — server may be waking up, try again');
    }
    if (e.message?.includes('Network request failed') || e.message?.includes('Failed to fetch')) {
      throw new Error('Cannot reach server — check your internet connection');
    }
    throw e;
  }
}

export function getApiBase() {
  return API_BASE;
}

export async function testConnection() {
  try {
    const res = await apiFetch(`${API_BASE}/health`);
    return res.status === 'healthy';
  } catch {
    return false;
  }
}

export async function fetchKPIs() {
  return apiFetch(`${API_BASE}/kpis`);
}

export async function fetchInsights() {
  return apiFetch(`${API_BASE}/insights`);
}

export async function fetchCatalog() {
  return apiFetch(`${API_BASE}/catalog`);
}

export async function fetchAnalysis(intentId) {
  return apiFetch(`${API_BASE}/analysis/${intentId}`);
}

export async function askQuestion(question) {
  return apiFetch(`${API_BASE}/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
}
