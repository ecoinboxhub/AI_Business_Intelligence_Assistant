import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchAnalysis, fetchKPIs } from '../services/api';
import ChartView from '../components/ChartView';
import { COLORS, fmtNaira } from '../theme';

const DASHBOARD_CHARTS = [
  { id: 'revenue_profit_drivers', title: 'Revenue & Profit by Region' },
  { id: 'customer_segments', title: 'Customer Segment Value' },
  { id: 'campaign_roi', title: 'Campaign ROI Leaderboard' },
];

export default function DashboardScreen() {
  const [kpis, setKpis] = useState(null);
  const [charts, setCharts] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const [k, ...cs] = await Promise.all([
        fetchKPIs(),
        ...DASHBOARD_CHARTS.map((c) => fetchAnalysis(c.id)),
      ]);
      setKpis(k);
      const next = {};
      DASHBOARD_CHARTS.forEach((c, i) => { next[c.id] = cs[i]; });
      setCharts(next);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Executive Dashboard</Text>
      <Text style={styles.sub}>Deterministic KPIs · full dataset</Text>
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="warning" size={14} color={COLORS.crimson} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      {!kpis ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <View style={styles.kpiGrid}>
          {[
            ['Net Revenue', fmtNaira(kpis.net_revenue), COLORS.primary],
            ['Gross Profit', fmtNaira(kpis.gross_profit), COLORS.success],
            ['Profit Margin', `${kpis.profit_margin_pct}%`, COLORS.success],
            ['Return Rate', `${kpis.return_rate_pct}%`, COLORS.danger],
            ['Delivery Delays', `${kpis.delivery_delay_pct}%`, COLORS.warn],
            ['Target Attainment', `${kpis.target_attainment_pct}%`,
              kpis.target_attainment_pct >= 100 ? COLORS.success : COLORS.danger],
          ].map(([label, value, color]) => (
            <View key={label} style={[styles.kpiCard, { borderTopColor: color }]}>
              <Text style={styles.kpiLabel}>{label}</Text>
              <Text style={[styles.kpiValue, { color }]}>{value}</Text>
            </View>
          ))}
        </View>
      )}

      {DASHBOARD_CHARTS.map((c) => (
        <View key={c.id} style={styles.card}>
          <Text style={styles.cardTitle}>{c.title}</Text>
          {charts[c.id]
            ? <ChartView chart={charts[c.id].chart} height={190} />
            : <ActivityIndicator color={COLORS.primary} />}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  sub: { fontSize: 12.5, color: COLORS.textSoft, marginBottom: 14 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  error: { color: COLORS.crimson, fontSize: 12.5, flexShrink: 1 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  kpiCard: {
    width: '48.5%', backgroundColor: COLORS.card, borderRadius: 10, padding: 13,
    marginBottom: 10, borderTopWidth: 3, elevation: 2,
  },
  kpiLabel: { fontSize: 11, color: COLORS.textSoft },
  kpiValue: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  card: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 14, elevation: 2,
  },
  cardTitle: { fontSize: 13.5, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
});
