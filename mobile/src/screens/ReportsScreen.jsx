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
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCatalog().then((c) => { setCatalog(c); if (c.length) select(c[0].id); }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = async (id) => {
    setSelected(id);
    setResult(null);
    setError('');
    try {
      setResult(await fetchAnalysis(id));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Performance Reports</Text>
      <Text style={styles.sub}>All nine business dimensions</Text>
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="warning" size={14} color={COLORS.crimson} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {catalog.map((c) => (
          <TouchableOpacity key={c.id}
                            style={[styles.tabChip, selected === c.id && styles.tabChipActive]}
                            onPress={() => select(c.id)}>
            <Text style={[styles.tabText, selected === c.id && styles.tabTextActive]} numberOfLines={1}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {!result ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 30 }} />
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{result.label}</Text>
            <ChartView chart={result.chart} height={200} />
          </View>

          {(result.metrics || []).length > 0 && (
            <View style={styles.card}>
              {(result.metrics || []).map((m, i) => (
                <View key={i} style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{m.label}</Text>
                  <Text style={styles.metricValue}>{m.value}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.card}>
            <Text style={[styles.sectionLabel, { color: '#0369A1' }]}>OBSERVED FACTS</Text>
            {(result.findings || []).map((f, i) => (
              <Text key={i} style={styles.factItem}>• {f}</Text>
            ))}
            <Text style={[styles.sectionLabel, { color: COLORS.success }]}>RECOMMENDATIONS</Text>
            {(result.recommendations || []).map((r, i) => (
              <View key={i} style={styles.recItem}>
                <Text style={styles.recText}>{r}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  sub: { fontSize: 12.5, color: COLORS.textSoft, marginBottom: 12 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  error: { color: COLORS.crimson, fontSize: 12.5, flexShrink: 1 },
  tabChip: {
    backgroundColor: '#E0F2FE', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8,
    marginRight: 8, maxWidth: 220,
  },
  tabChipActive: { backgroundColor: COLORS.primary },
  tabText: { color: '#0369A1', fontSize: 11.5 },
  tabTextActive: { color: '#fff' },
  card: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 14, elevation: 2,
  },
  cardTitle: { fontSize: 13.5, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  metricRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  metricLabel: { fontSize: 12.5, color: COLORS.textSoft, flexShrink: 1, marginRight: 8 },
  metricValue: { fontSize: 12.5, fontWeight: '700', color: COLORS.primary },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginTop: 6, marginBottom: 6 },
  factItem: { fontSize: 12.5, color: '#334155', marginBottom: 4 },
  recItem: {
    backgroundColor: '#F0FDF4', borderLeftWidth: 3, borderLeftColor: COLORS.success,
    borderRadius: 6, padding: 8, marginTop: 6,
  },
  recText: { fontSize: 12.5, color: '#14532D' },
});
