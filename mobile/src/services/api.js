import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_KEY = '@nexasphere_api_base';
const CONNECTED_KEY = '@nexasphere_connected';

const HOSTED_BASE = 'https://nexasphere-bi.onrender.com/api';

function getDefaultBase() {
  return HOSTED_BASE;
}

export async function getApiBase() {
  try {
    return (await AsyncStorage.getItem(BASE_KEY)) || getDefaultBase();
  } catch {
    return getDefaultBase();
  }
}

export async function setApiBase(base) {
  const trimmed = (base || '').trim().replace(/\/+$/, '');
  if (trimmed) {
    await AsyncStorage.setItem(BASE_KEY, trimmed);
  } else {
    await AsyncStorage.removeItem(BASE_KEY);
  }
}

export async function isConnected() {
  try {
    const v = await AsyncStorage.getItem(CONNECTED_KEY);
    return v === 'true';
  } catch {
    return false;
  }
}

export async function setConnected(v) {
  await AsyncStorage.setItem(CONNECTED_KEY, v ? 'true' : 'false');
}

async function apiFetch(url, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
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
      throw new Error('Connection timed out — check your network and API URL in Settings');
    }
    if (e.message?.includes('Network request failed') || e.message?.includes('Failed to fetch')) {
      throw new Error('Cannot reach server — ensure the backend is running and the API URL is correct in Settings');
    }
    throw e;
  }
}

export async function testConnection(url) {
  try {
    const res = await apiFetch(`${url}/health`);
    return res.status === 'healthy';
  } catch {
    return false;
  }
}

export async function fetchKPIs() {
  const base = await getApiBase();
  return apiFetch(`${base}/kpis`);
}

export async function fetchCatalog() {
  const base = await getApiBase();
  return apiFetch(`${base}/catalog`);
}

export async function fetchAnalysis(intentId) {
  const base = await getApiBase();
  return apiFetch(`${base}/analysis/${intentId}`);
}

export async function askQuestion(question) {
  const base = await getApiBase();
  return apiFetch(`${base}/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
}
