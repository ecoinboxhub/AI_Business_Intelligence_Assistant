// NexaSphere brand system — single source of truth for web UI colors.
export const COLORS = {
  ink: '#0F172A',          // Deep Slate 900 — text / darkest surface
  surface: '#0F172A',      // Deep Slate — sidebar / bottom nav
  surfaceAlt: '#1E293B',   // Deep Slate 800 — gradient end
  primary: '#4F46E5',      // Indigo
  primaryHover: '#4338CA', // Indigo 700
  sky: '#0EA5E9',          // Sky Blue
  emerald: '#10B981',      // Emerald
  amber: '#F59E0B',        // Amber
  crimson: '#EF4444',      // Crimson
  danger: '#EF4444',
  warn: '#F59E0B',
  success: '#10B981',
  bg: '#F8FAFC',           // Light background
  card: '#FFFFFF',
  text: '#0F172A',
  textSoft: '#64748B',
  border: '#E2E8F0',
};

export const CHART_COLORS = [
  COLORS.primary,
  COLORS.sky,
  COLORS.emerald,
  COLORS.amber,
  COLORS.crimson,
  '#8B5CF6', // violet accent (series overflow)
  '#64748B', // slate (remainder/other)
];

export const TREEMAP_STATUS_COLORS = {
  'STOCKOUT RISK': COLORS.crimson,
  EXCESS: COLORS.amber,
  HEALTHY: COLORS.emerald,
};
