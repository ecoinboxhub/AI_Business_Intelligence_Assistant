import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
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

function KPICard({ label, value, color }) {
  return (
    <View style={[styles.kpiCard, { borderLeftColor: color }]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const [kpis, setKpis] = useState(null);
  const [charts, setCharts] = useState({});
  const [chartErrors, setChartErrors] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setError('');
    try {
      const k = await fetchKPIs();
      setKpis(k);
    } catch (e) {
      setError(e.message);
    }

    const chartResults = {};
    const chartErrs = {};
    await Promise.all(
      DASHBOARD_CHARTS.map(async (c) => {
        try {
          chartResults[c.id] = await fetchAnalysis(c.id);
        } catch (e) {
          chartErrs[c.id] = e.message;
        }
      })
    );
    setCharts(chartResults);
    setChartErrors(chartErrs);
    setLoading(false);
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.sub}>Deterministic KPIs · Full dataset</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="business" size={16} color={COLORS.primary} />
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="cloud-offline" size={18} color={COLORS.crimson} />
          <View style={{ flex: 1 }}>
            <Text style={styles.errorTitle}>Connection Error</Text>
            <Text style={styles.error}>{error}</Text>
            <Text style={styles.errorHint}>Go to Settings tab to configure the API URL</Text>
          </View>
        </View>
      ) : null}

      {loading && !kpis ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading dashboard data...</Text>
        </View>
      ) : kpis ? (
        <>
          <View style={styles.kpiGrid}>
            <KPICard label="Net Revenue" value={fmtNaira(kpis.net_revenue)} color={COLORS.primary} />
            <KPICard label="Gross Profit" value={fmtNaira(kpis.gross_profit)} color={COLORS.success} />
            <KPICard label="Profit Margin" value={`${kpis.profit_margin_pct}%`} color={COLORS.success} />
            <KPICard label="Return Rate" value={`${kpis.return_rate_pct}%`} color={COLORS.danger} />
            <KPICard label="Delivery Delays" value={`${kpis.delivery_delay_pct}%`} color={COLORS.warn} />
            <KPICard
              label="Target Attainment"
              value={`${kpis.target_attainment_pct}%`}
              color={kpis.target_attainment_pct >= 100 ? COLORS.success : COLORS.danger}
            />
          </View>

          {DASHBOARD_CHARTS.map((c) => (
            <View key={c.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{c.title}</Text>
                {chartErrors[c.id] && (
                  <Ionicons name="warning" size={14} color={COLORS.warn} />
                )}
              </View>
              {chartErrors[c.id] ? (
                <Text style={styles.chartError}>Chart unavailable</Text>
              ) : charts[c.id] ? (
                <ChartView chart={charts[c.id].chart} height={190} />
              ) : (
                <ActivityIndicator color={COLORS.primary} style={{ height: 190 }} />
              )}
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.textSoft, marginTop: 2 },
  headerBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.crimson,
  },
  errorTitle: { fontSize: 12, fontWeight: '700', color: COLORS.crimson, marginBottom: 2 },
  error: { color: COLORS.crimson, fontSize: 12, flexShrink: 1 },
  errorHint: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  loadingWrap: { alignItems: 'center', marginTop: 60 },
  loadingText: { fontSize: 13, color: COLORS.textSoft, marginTop: 10 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 8 },
  kpiCard: {
    width: '48.5%',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  kpiLabel: { fontSize: 11, color: COLORS.textSoft, fontWeight: '500' },
  kpiValue: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  chartError: { fontSize: 12, color: COLORS.textSoft, textAlign: 'center', paddingVertical: 20 },
});
