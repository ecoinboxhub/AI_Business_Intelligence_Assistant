import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator, Dimensions, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchAnalysis, fetchKPIs, fetchInsights } from '../services/api';
import ChartView from '../components/ChartView';
import { COLORS, fmtNaira } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GAP = 10;
const CARD_WIDTH = (SCREEN_W - 32 - CARD_GAP) / 2;

const DASHBOARD_CHARTS = [
  { id: 'revenue_profit_drivers', title: 'Revenue & Profit by Region', icon: 'bar-chart' },
  { id: 'customer_segments', title: 'Customer Segments', icon: 'people' },
  { id: 'campaign_roi', title: 'Campaign ROI', icon: 'trending-up' },
];

function KPICard({ label, value, color, icon }) {
  return (
    <TouchableOpacity activeOpacity={0.7} style={[styles.kpiCard, { borderLeftColor: color }]}>
      <View style={styles.kpiTop}>
        <Ionicons name={icon} size={14} color={color} />
        <Text style={styles.kpiLabel}>{label}</Text>
      </View>
      <Text style={[styles.kpiValue, { color }]} numberOfLines={1}>{value}</Text>
    </TouchableOpacity>
  );
}

function InsightCard({ finding, index }) {
  return (
    <View style={styles.insightRow}>
      <View style={[styles.insightDot, { backgroundColor: index === 0 ? COLORS.primary : index === 1 ? COLORS.warn : COLORS.success }]} />
      <Text style={styles.insightText} numberOfLines={2}>{finding}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const [kpis, setKpis] = useState(null);
  const [charts, setCharts] = useState({});
  const [chartErrors, setChartErrors] = useState({});
  const [insights, setInsights] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [k, ins] = await Promise.all([fetchKPIs(), fetchInsights()]);
      setKpis(k);
      setInsights(ins);
      setLastUpdated(new Date());
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
  }, []);

  useEffect(() => { load(); }, [load]);

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
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.sub}>Deterministic KPIs</Text>
        </View>
        {lastUpdated && (
          <Text style={styles.timestamp}>
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="cloud-offline" size={18} color={COLORS.crimson} />
          <View style={{ flex: 1 }}>
            <Text style={styles.errorTitle}>Connection Error</Text>
            <Text style={styles.errorMsg}>{error}</Text>
            <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {loading && !kpis ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading dashboard data...</Text>
          <Text style={styles.loadingHint}>First load may take 30s (server cold start)</Text>
        </View>
      ) : kpis ? (
        <>
          <View style={styles.kpiGrid}>
            <KPICard label="Net Revenue" value={fmtNaira(kpis.net_revenue)} color={COLORS.primary} icon="wallet" />
            <KPICard label="Gross Profit" value={fmtNaira(kpis.gross_profit)} color={COLORS.success} icon="cash" />
            <KPICard label="Margin" value={`${kpis.profit_margin_pct}%`} color={COLORS.success} icon="percent" />
            <KPICard label="Return Rate" value={`${kpis.return_rate_pct}%`} color={COLORS.danger} icon="return-up-back" />
            <KPICard label="Delivery Delays" value={`${kpis.delivery_delay_pct}%`} color={COLORS.warn} icon="car" />
            <KPICard
              label="Target Hit"
              value={`${kpis.target_attainment_pct}%`}
              color={kpis.target_attainment_pct >= 100 ? COLORS.success : COLORS.danger}
              icon="flag"
            />
          </View>

          {insights?.findings?.length > 0 && (
            <View style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <Ionicons name="bulb" size={14} color={COLORS.amber} />
                <Text style={styles.insightTitle}>Key Insights</Text>
              </View>
              {insights.findings.slice(0, 3).map((f, i) => (
                <InsightCard key={i} finding={f} index={i} />
              ))}
            </View>
          )}

          {DASHBOARD_CHARTS.map((c) => (
            <View key={c.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name={c.icon} size={14} color={COLORS.primary} />
                  <Text style={styles.cardTitle}>{c.title}</Text>
                </View>
                {chartErrors[c.id] && (
                  <Ionicons name="warning" size={14} color={COLORS.warn} />
                )}
              </View>
              {chartErrors[c.id] ? (
                <View style={styles.chartErrorWrap}>
                  <Ionicons name="cloud-offline" size={20} color={COLORS.textSoft} />
                  <Text style={styles.chartError}>Chart unavailable</Text>
                  <TouchableOpacity onPress={() => load()}>
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
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
  timestamp: { fontSize: 10, color: COLORS.textSoft, marginTop: 4 },
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
  errorMsg: { color: COLORS.crimson, fontSize: 12, flexShrink: 1 },
  retryBtn: { marginTop: 6, alignSelf: 'flex-start' },
  retryText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  loadingWrap: { alignItems: 'center', marginTop: 60 },
  loadingText: { fontSize: 13, color: COLORS.textSoft, marginTop: 10 },
  loadingHint: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  kpiCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: CARD_GAP,
    borderLeftWidth: 3,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  kpiTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  kpiLabel: { fontSize: 11, color: COLORS.textSoft, fontWeight: '500' },
  kpiValue: { fontSize: 17, fontWeight: '800', marginTop: 6 },
  insightCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.amber,
  },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  insightTitle: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  insightDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  insightText: { fontSize: 12, color: '#78350F', flex: 1, lineHeight: 17 },
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
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  chartErrorWrap: { alignItems: 'center', paddingVertical: 20 },
  chartError: { fontSize: 12, color: COLORS.textSoft, marginTop: 6 },
});
