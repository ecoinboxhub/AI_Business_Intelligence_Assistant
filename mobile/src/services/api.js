import AsyncStorage from '@react-native-async-storage/async-storage';

// Default works for iOS simulator; Android emulator: http://10.0.2.2:5050/api
// Physical device: use your PC's LAN IP, e.g. http://192.168.x.x:5050/api
const DEFAULT_BASE = 'http://localhost:5050/api';
const BASE_KEY = '@nexasphere_api_base';

export async function getApiBase() {
  try {
    return (await AsyncStorage.getItem(BASE_KEY)) || DEFAULT_BASE;
  } catch {
    return DEFAULT_BASE;
  }
}

export async function setApiBase(base) {
  const trimmed = (base || '').trim().replace(/\/+$/, '');
  if (trimmed) await AsyncStorage.setItem(BASE_KEY, trimmed);
  else await AsyncStorage.removeItem(BASE_KEY);
}

async function handle(res, label) {
  if (!res.ok) throw new Error(`${label} (${res.status})`);
  return res.json();
}

export async function fetchKPIs() {
  const base = await getApiBase();
  return handle(await fetch(`${base}/kpis`), 'Failed to fetch KPIs');
}

export async function fetchCatalog() {
  const base = await getApiBase();
  return handle(await fetch(`${base}/catalog`), 'Failed to fetch catalog');
}

export async function fetchAnalysis(intentId) {
  const base = await getApiBase();
  return handle(await fetch(`${base}/analysis/${intentId}`), `Analysis '${intentId}' failed`);
}

export async function askQuestion(question) {
  const base = await getApiBase();
  return handle(
    await fetch(`${base}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    }),
    'Failed to post question'
  );
}
