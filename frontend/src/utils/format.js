export function fmtNairaCompact(x) {
  const ax = Math.abs(x);
  const sign = x < 0 ? '-' : '';
  if (ax >= 1e12) return `${sign}₦${(ax / 1e12).toFixed(2)}T`;
  if (ax >= 1e9) return `${sign}₦${(ax / 1e9).toFixed(2)}B`;
  if (ax >= 1e6) return `${sign}₦${(ax / 1e6).toFixed(1)}M`;
  if (ax >= 1e3) return `${sign}₦${(ax / 1e3).toFixed(1)}K`;
  return `${sign}₦${ax.toLocaleString()}`;
}

export function fmtFull(x) {
  return `₦${Number(x).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function renderMdLite(text) {
  const escaped = String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/₦([\d,.]+[TKMB]?)/g, '<strong>₦$1</strong>')
    .replace(/\n/g, '<br/>');
}
