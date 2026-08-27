import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchAnalysis, fetchCatalog } from '../services/api';
import ChartView from '../components/ChartView';
import { COLORS } from '../theme';

export default function ReportsScreen() {
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [catalogError, setCatalogError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const c = await fetchCatalog();
        setCatalog(c || []);
        if (c && c.length > 0) {
          selectReport(c[0].id);
        }
      } catch (e) {
        setCatalogError(e.message);
      }
    })();
  }, []);

  const selectReport = useCallback(async (id) => {
    setSelected(id);
    setResult(null);
    setError('');
    setLoading(true);
    try {
      setResult(await fetchAnalysis(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Reports</Text>
            <Text style={styles.sub}>Nine business dimensions</Text>
          </View>
          <View style={styles.headerBadge}>
            <Ionicons name="document-text" size={16} color={COLORS.emerald} />
          </View>
        </View>

        {catalogError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="cloud-offline" size={16} color={COLORS.crimson} />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>Connection Error</Text>
              <Text style={styles.errorMsg}>{catalogError}</Text>
              <TouchableOpacity onPress={() => selectReport(selected || catalog[0]?.id)}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {catalog.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabScroll}
            contentContainerStyle={styles.tabContent}
          >
            {catalog.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.tabChip, selected === c.id && styles.tabChipActive]}
                onPress={() => selectReport(c.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.tabText, selected === c.id && styles.tabTextActive]}
                  numberOfLines={1}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="warning" size={16} color={COLORS.warn} />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorMsg}>{error}</Text>
              <TouchableOpacity onPress={() => selectReport(selected)}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading report...</Text>
            <Text style={styles.loadingHint}>First load may take 30s</Text>
          </View>
        ) : result ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{result.label || selected}</Text>
              {result.chart?.data?.length > 0 ? (
                <ChartView chart={result.chart} height={200} />
              ) : (
                <Text style={styles.noChart}>No chart data available</Text>
              )}
            </View>

            {(result.metrics || []).length > 0 && (
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="analytics" size={14} color={COLORS.primary} />
                  <Text style={[styles.sectionLabel, { color: COLORS.primary }]}>KEY METRICS</Text>
                </View>
                {(result.metrics || []).map((m, i) => (
                  <View key={i} style={styles.metricRow}>
                    <Text style={styles.metricLabel}>{m.label}</Text>
                    <Text style={styles.metricValue}>{m.value}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.card}>
              {(result.findings || []).length > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="eye" size={14} color="#0369A1" />
                    <Text style={[styles.sectionLabel, { color: '#0369A1' }]}>OBSERVED FACTS</Text>
                  </View>
                  {(result.findings || []).map((f, i) => (
                    <View key={i} style={styles.findingRow}>
                      <View style={styles.findingDot} />
                      <Text style={styles.factItem}>{f}</Text>
                    </View>
                  ))}
                </View>
              )}

              {(result.risks || []).length > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="alert-circle" size={14} color={COLORS.warn} />
                    <Text style={[styles.sectionLabel, { color: COLORS.warn }]}>RISKS</Text>
                  </View>
                  {(result.risks || []).map((r, i) => (
                    <View key={i} style={styles.riskRow}>
                      <Ionicons name="warning" size={12} color={COLORS.warn} />
                      <Text style={styles.riskItem}>{r}</Text>
                    </View>
                  ))}
                </View>
              )}

              {(result.recommendations || []).length > 0 && (
                <View>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                    <Text style={[styles.sectionLabel, { color: COLORS.success }]}>RECOMMENDATIONS</Text>
                  </View>
                  {(result.recommendations || []).map((r, i) => (
                    <View key={i} style={styles.recItem}>
                      <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                      <Text style={styles.recText}>{r}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {(result.what_if || []).length > 0 && (
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="flash" size={14} color="#8B5CF6" />
                  <Text style={[styles.sectionLabel, { color: '#8B5CF6' }]}>WHAT-IF SCENARIOS</Text>
                </View>
                {result.what_if.map((w, i) => (
                  <View key={i} style={styles.whatifItem}>
                    <Text style={styles.whatifQuestion}>{w.question}</Text>
                    <View style={styles.whatifImpact}>
                      <Text style={styles.whatifImpactText}>{w.impact}</Text>
                    </View>
                    <Text style={styles.whatifBasis}>{w.basis}</Text>
                  </View>
                ))}
              </View>
            )}

            {result.severity_score != null && (
              <View style={styles.severityBar}>
                <Text style={styles.severityLabel}>Severity</Text>
                <View style={styles.severityTrack}>
                  <View style={[styles.severityFill, { width: `${Math.min(result.severity_score, 100)}%` }]} />
                </View>
                <Text style={styles.severityValue}>{result.severity_score}/100</Text>
                <View style={[styles.urgencyBadge, { backgroundColor: result.action_urgency === 'URGENT' ? '#FEF2F2' : '#FFFBEB' }]}>
                  <Text style={[styles.urgencyText, { color: result.action_urgency === 'URGENT' ? COLORS.crimson : COLORS.warn }]}>
                    {result.action_urgency}
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : !catalogError && catalog.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading reports...</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.textSoft, marginTop: 2 },
  headerBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabScroll: { marginBottom: 12 },
  tabContent: { paddingRight: 8 },
  tabChip: {
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
    maxWidth: 220,
  },
  tabChipActive: { backgroundColor: COLORS.primary },
  tabText: { color: COLORS.primary, fontSize: 12, fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.crimson,
  },
  errorTitle: { fontSize: 12, fontWeight: '700', color: COLORS.crimson },
  errorMsg: { color: COLORS.crimson, fontSize: 12, flexShrink: 1 },
  retryText: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginTop: 4 },
  loadingWrap: { alignItems: 'center', marginTop: 40 },
  loadingText: { fontSize: 13, color: COLORS.textSoft, marginTop: 10 },
  loadingHint: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
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
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  noChart: { fontSize: 12, color: COLORS.textSoft, textAlign: 'center', paddingVertical: 30 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  metricLabel: { fontSize: 12.5, color: COLORS.textSoft, flexShrink: 1, marginRight: 8 },
  metricValue: { fontSize: 12.5, fontWeight: '700', color: COLORS.primary },
  findingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  findingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#0369A1', marginTop: 5 },
  factItem: { fontSize: 12.5, color: '#334155', flex: 1, lineHeight: 18 },
  riskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  riskItem: { fontSize: 12.5, color: '#92400E', flex: 1, lineHeight: 18 },
  recItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  recText: { fontSize: 12.5, color: '#14532D', lineHeight: 18, flex: 1 },
  whatifItem: {
    backgroundColor: '#FAF5FF',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  whatifQuestion: { fontSize: 12.5, fontWeight: '600', color: '#581C87', marginBottom: 4 },
  whatifImpact: {
    backgroundColor: '#DDD6FE',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  whatifImpactText: { fontSize: 11, fontWeight: '700', color: '#581C87' },
  whatifBasis: { fontSize: 11, color: '#7C3AED' },
  severityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    elevation: 1,
  },
  severityLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSoft },
  severityTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  severityFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.amber },
  severityValue: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  urgencyBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  urgencyText: { fontSize: 10, fontWeight: '700' },
});
