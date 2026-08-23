// NexaSphere brand system — shared design tokens for the Expo app.
export const COLORS = {
  ink: '#0F172A',        // Deep Slate 900
  surface: '#0F172A',    // Deep Slate — tab bar / dark chrome
  surface2: '#1E293B',   // Deep Slate 800
  primary: '#4F46E5',    // Indigo
  sky: '#0EA5E9',        // Sky Blue
  emerald: '#10B981',    // Emerald
  amber: '#F59E0B',      // Amber
  crimson: '#EF4444',    // Crimson
  danger: '#EF4444',
  warn: '#F59E0B',
  success: '#10B981',
  bg: '#F8FAFC',         // Light background
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
  '#8B5CF6',
  '#64748B',
];

const STATUS_COLORS = {
  'STOCKOUT RISK': COLORS.crimson,
  EXCESS: COLORS.amber,
  HEALTHY: COLORS.emerald,
};

export { STATUS_COLORS };

export function fmtNaira(x) {
  const ax = Math.abs(x);
  const sign = x < 0 ? '-' : '';
  if (ax >= 1e12) return `${sign}₦${(ax / 1e12).toFixed(2)}T`;
  if (ax >= 1e9) return `${sign}₦${(ax / 1e9).toFixed(2)}B`;
  if (ax >= 1e6) return `${sign}₦${(ax / 1e6).toFixed(1)}M`;
  if (ax >= 1e3) return `${sign}₦${(ax / 1e3).toFixed(1)}K`;
  return `${sign}₦${Math.round(ax).toLocaleString()}`;
}
