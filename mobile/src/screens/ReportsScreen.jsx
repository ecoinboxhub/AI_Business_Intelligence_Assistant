import React, { useEffect, useState } from 'react';
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
          select(c[0].id);
        }
      } catch (e) {
        setCatalogError(e.message);
      }
    })();
  }, []);

  const select = async (id) => {
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
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Reports</Text>
            <Text style={styles.sub}>All nine business dimensions</Text>
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
              <Text style={styles.error}>{catalogError}</Text>
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
                onPress={() => select(c.id)}
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
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading report...</Text>
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
                <Text style={[styles.sectionLabel, { color: COLORS.primary }]}>KEY METRICS</Text>
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
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.sectionLabel, { color: '#0369A1' }]}>OBSERVED FACTS</Text>
                  {(result.findings || []).map((f, i) => (
                    <Text key={i} style={styles.factItem}>• {f}</Text>
                  ))}
                </View>
              )}

              {(result.risks || []).length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.sectionLabel, { color: COLORS.warn }]}>RISKS</Text>
                  {(result.risks || []).map((r, i) => (
                    <Text key={i} style={styles.riskItem}>⚠ {r}</Text>
                  ))}
                </View>
              )}

              {(result.recommendations || []).length > 0 && (
                <View>
                  <Text style={[styles.sectionLabel, { color: COLORS.success }]}>RECOMMENDATIONS</Text>
                  {(result.recommendations || []).map((r, i) => (
                    <View key={i} style={styles.recItem}>
                      <Text style={styles.recText}>{r}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
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
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.crimson,
  },
  errorTitle: { fontSize: 12, fontWeight: '700', color: COLORS.crimson },
  error: { color: COLORS.crimson, fontSize: 12, flexShrink: 1 },
  loadingWrap: { alignItems: 'center', marginTop: 40 },
  loadingText: { fontSize: 13, color: COLORS.textSoft, marginTop: 10 },
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
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  metricLabel: { fontSize: 12.5, color: COLORS.textSoft, flexShrink: 1, marginRight: 8 },
  metricValue: { fontSize: 12.5, fontWeight: '700', color: COLORS.primary },
  factItem: { fontSize: 12.5, color: '#334155', marginBottom: 4, paddingLeft: 4 },
  riskItem: { fontSize: 12.5, color: '#92400E', marginBottom: 4, paddingLeft: 4 },
  recItem: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  recText: { fontSize: 12.5, color: '#14532D', lineHeight: 18 },
});
