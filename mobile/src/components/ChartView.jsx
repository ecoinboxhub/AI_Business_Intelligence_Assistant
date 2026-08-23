import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import {
  CHART_COLORS, COLORS, STATUS_COLORS, fmtNaira,
} from '../theme';

function compact(v) {
  const ax = Math.abs(v);
  if (ax >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (ax >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (ax >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return `${Math.round(v)}`;
}

// ---------------------------------------------------------------------------
// Native treemap — recursive half-split partition rendered with plain Views.
// ---------------------------------------------------------------------------
function partition(items, x, y, w, h, out) {
  if (!items.length) return;
  const total = items.reduce((s, d) => s + d.size, 0);
  if (total <= 0 || w <= 0 || h <= 0) return;
  if (items.length === 1) {
    out.push({ ...items[0], x, y, w, h });
    return;
  }
  let acc = 0;
  let cut = 1;
  for (let i = 0; i < items.length; i += 1) {
    acc += items[i].size;
    if (acc >= total / 2) { cut = i + 1; break; }
  }
  const a = items.slice(0, cut);
  const b = items.slice(cut);
  const frac = a.reduce((s, d) => s + d.size, 0) / total;
  if (w >= h) {
    partition(a, x, y, w * frac, h, out);
    partition(b, x + w * frac, y, w * (1 - frac), h, out);
  } else {
    partition(a, x, y, w, h * frac, out);
    partition(b, x, y + h * frac, w, h * (1 - frac), out);
  }
}

function TreemapView({ data, height }) {
  const sorted = [...data].sort((p, q) => q.size - p.size);
  const tiles = [];
  partition(sorted, 0, 0, 100, height, tiles);
  return (
    <View style={[styles.treemap, { height }]}>
      {tiles.map((t, i) => (
        <View key={i} style={{
          position: 'absolute',
          left: `${t.x}%`,
          top: t.y,
          width: `${t.w}%`,
          height: t.h,
          backgroundColor: STATUS_COLORS[t.status] || COLORS.primary,
          opacity: 0.88,
          borderWidth: 1,
          borderColor: '#FFFFFF',
          borderRadius: 3,
          padding: 3,
          overflow: 'hidden',
        }}>
          {t.h > 30 && t.w > 18 && (
            <>
              <Text style={styles.tileTitle} numberOfLines={1}>{String(t.name).replace(' · ', '\n')}</Text>
              {t.h > 52 && <Text style={styles.tileStatus}>{t.status}</Text>}
            </>
          )}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Native funnel — centered rows whose widths track the value drop-off.
// ---------------------------------------------------------------------------
function FunnelView({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <View style={{ alignItems: 'center', paddingVertical: 8 }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        const share = Math.round((d.value / total) * 100);
        return (
          <View key={d.stage ?? d.name ?? i} style={styles.funnelRow}>
            <View style={{
              width: `${Math.max(pct, 22)}%`,
              backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
              opacity: 1 - i * 0.16,
              borderRadius: 6,
              paddingVertical: 9,
              alignItems: 'center',
            }}>
              <Text style={styles.funnelValue}>{fmtNaira(d.value)}</Text>
              <Text style={styles.funnelShare}>{share}% of flow</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------

export default function ChartView({ chart, height = 220 }) {
  if (!chart?.data?.length) return null;
  const { type, x_axis: xAxis, y_axis: yKeys, threshold } = chart;

  if (type === 'pie' || type === 'donut') {
    const total = chart.data.reduce((s, d) => s + (Number(d.value) || 0), 0) || 1;
    const data = chart.data.map((d, i) => ({
      value: d.value,
      label: d.name,
      color: CHART_COLORS[i % CHART_COLORS.length],
      text: `${Math.round(((Number(d.value) || 0) / total) * 100)}%`,
      textColor: '#0F172A',
    }));
    return (
      <View style={{ alignItems: 'center' }}>
        <PieChart
          data={data}
          donut={type === 'donut'}
          innerRadius={type === 'donut' ? 42 : 0}
          radius={78}
          innerCircleColor={COLORS.surface2}
          centerLabel=""
          focusEnabled
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
          {data.map((d, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: d.color }]} />
              <Text style={styles.legendText}>{d.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (type === 'treemap') return <TreemapView data={chart.data} height={230} />;
  if (type === 'funnel') return <FunnelView data={chart.data} />;

  if (type === 'combo') {
    const bars = chart.data.map((d) => ({
      label: String(d[xAxis] ?? '').slice(2),
      value: d[yKeys[0]] ?? d.Revenue ?? 0,
    }));
    const line = chart.data.map((d) => ({ value: d['Margin %'] ?? 0 }));
    const lineMin = Math.min(...line.map((l) => l.value));
    const lineMax = Math.max(...line.map((l) => l.value));
    // Shared geometry (initialSpacing/spacing) keeps both strips on one grid.
    return (
      <View>
        <BarChart data={bars} height={height} barWidth={14} spacing={14}
                  initialSpacing={20} frontColor={COLORS.primary} roundedTop
                  yAxisThickness={0} xAxisThickness={0} isAnimated
                  noOfSections={4} formatYLabel={(v) => compact(Number(v))} />
        <LineChart data={line} height={110} curved thickness={2.5} color={COLORS.amber}
                   initialSpacing={20} spacing={14}
                   yAxisThickness={0} xAxisThickness={0} hideYAxisText hideDataPoints1={false}
                   yAxisOffset={lineMin - 2}
                   maxValue={lineMax + 2}
                   rulesType="dashed" hideRules />
        <Text style={styles.lineCaption}>Margin % over the same months</Text>
      </View>
    );
  }

  const numericKey = yKeys.find((k) => typeof chart.data[0][k] === 'number') || yKeys[0];
  const horizontal = type === 'horizontal_bar';

  const barData = [...chart.data].slice(0, 15).map((r, i) => {
    const raw = Number(r.value ?? r[numericKey]) || 0;
    const flagged = type === 'bar_threshold' && threshold != null && Math.abs(raw) > threshold;
    return {
      label: String(r[xAxis] ?? r.name ?? '').slice(0, 12),
      value: raw,
      frontColor: flagged ? COLORS.crimson : CHART_COLORS[i % CHART_COLORS.length],
      topLabelComponent: () => (
        <Text style={styles.barTop}>{compact(Math.abs(raw))}</Text>
      ),
    };
  });

  if (horizontal) {
    return (
      <BarChart
        data={barData} horizontal height={Math.max(height, barData.length * 34)}
        barWidth={16} spacing={10} frontColor={COLORS.primary}
        yAxisThickness={0} xAxisThickness={0} disableScroll={false}
        noOfSections={4} isAnimated
        formatYLabel={() => ''} xAxisLabelTextStyle={styles.axis}
        endSpacing={40}
      />
    );
  }

  return (
    <BarChart
      data={barData} height={height} barWidth={16} spacing={14}
      roundedTop isAnimated noOfSections={4}
      yAxisThickness={0} xAxisThickness={0}
      formatYLabel={(v) => compact(Number(v))}
      xAxisLabelTextStyle={styles.axis}
      labelsExtraHeight={12}
    />
  );
}

const styles = StyleSheet.create({
  axis: { fontSize: 9, color: COLORS.textSoft },
  barTop: { fontSize: 8.5, color: COLORS.text },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12, marginVertical: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  legendText: { fontSize: 11, color: COLORS.text },
  lineCaption: { fontSize: 11, color: COLORS.textSoft, textAlign: 'center', marginTop: 4 },
  treemap: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 8, overflow: 'hidden' },
  tileTitle: { fontSize: 8.5, fontWeight: '700', color: '#FFFFFF' },
  tileStatus: { fontSize: 7.5, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  funnelRow: { width: '100%', alignItems: 'center', marginBottom: 5 },
  funnelValue: { fontSize: 12, fontWeight: '800', color: '#0F172A' },
  funnelShare: { fontSize: 9.5, color: 'rgba(15,23,42,0.7)' },
});
