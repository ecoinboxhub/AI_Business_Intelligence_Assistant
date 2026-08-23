import React, { useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { askQuestion } from '../services/api';
import ChartView from '../components/ChartView';
import { COLORS } from '../theme';

export default function AssistantScreen({ catalog }) {
  const [question, setQuestion] = useState('');
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ask = async (q) => {
    const text = (q || question).trim();
    if (!text || loading) return;
    setLoading(true);
    setError('');
    setQuestion('');
    setThread((prev) => [...prev, { role: 'user', text }]);
    try {
      const res = await askQuestion(text);
      setThread((prev) => [...prev, { role: 'ai', res }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>AI Assistant</Text>
      <Text style={styles.sub}>Structured answers · Pandas-computed numbers</Text>

      <View style={styles.chipWrap}>
        {catalog.slice(0, 6).map((c) => (
          <TouchableOpacity key={c.id} style={styles.chip} onPress={() => ask(c.label)}>
            <Text style={styles.chipText}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="warning" size={14} color={COLORS.crimson} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      {thread.map((t, i) =>
        t.role === 'user' ? (
          <View key={i} style={styles.userBubble}>
            <Text style={styles.userText}>{t.text}</Text>
          </View>
        ) : (
          <View key={i} style={styles.aiCard}>
            <View style={styles.metricsRow}>
              {(t.res.metrics || []).map((m, mi) => (
                <View key={mi} style={styles.metricChip}>
                  <Text style={styles.metricLabel}>{m.label}</Text>
                  <Text style={styles.metricValue}>{m.value}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.answer}>{t.res.answer}</Text>

            {t.res.chart?.data?.length > 0 && (
              <View style={styles.chartCard}>
                {t.res.chart_title ? (
                  <Text style={styles.chartTitle} numberOfLines={1}>{t.res.chart_title}</Text>
                ) : null}
                <ChartView chart={t.res.chart} height={180} />
              </View>
            )}

            {(t.res.findings || []).length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: '#0369A1' }]}>OBSERVED FACTS</Text>
                {(t.res.findings || []).map((f, fi) => (
                  <Text key={fi} style={styles.factItem}>• {f}</Text>
                ))}
              </>
            )}

            {(t.res.recommendations || []).map((r, ri) => (
              <View key={ri} style={styles.recItem}>
                <Text style={styles.recText}>{r}</Text>
              </View>
            ))}

            {(t.res.follow_up_questions || []).length > 0 && (
              <View style={{ marginTop: 10 }}>
                {(t.res.follow_up_questions || []).slice(0, 3).map((fq, fqi) => (
                  <TouchableOpacity key={fqi} style={styles.chip} onPress={() => ask(fq)}>
                    <Text style={styles.chipText}>{fq}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )
      )}

      {loading && <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 18 }} />}

      <View style={styles.askRow}>
        <TextInput
          style={styles.input}
          placeholder="Ask a business question…"
          value={question}
          onChangeText={setQuestion}
          onSubmitEditing={() => ask()}
        />
        <TouchableOpacity style={[styles.askBtn, loading && { opacity: 0.5 }]} onPress={() => ask()}>
          <Ionicons name="sparkles" size={19} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  sub: { fontSize: 12.5, color: COLORS.textSoft, marginBottom: 14 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { backgroundColor: '#E0F2FE', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, marginBottom: 6, marginRight: 4 },
  chipText: { color: '#0369A1', fontSize: 11.5 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: COLORS.primary, borderRadius: 16, borderBottomRightRadius: 4, paddingHorizontal: 13, paddingVertical: 9, marginVertical: 5, maxWidth: '85%' },
  userText: { color: '#fff', fontSize: 13.5 },
  aiCard: { backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginTop: 8 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  metricChip: { backgroundColor: '#EFF4FF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginRight: 4, marginBottom: 4 },
  metricLabel: { fontSize: 10, color: COLORS.textSoft },
  metricValue: { fontSize: 11.5, fontWeight: '700', color: COLORS.primary },
  answer: { fontSize: 13.5, lineHeight: 20, color: COLORS.text, marginBottom: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginTop: 8, marginBottom: 4 },
  factItem: { fontSize: 12.5, color: '#334155', marginBottom: 4, paddingLeft: 4 },
  recItem: { backgroundColor: '#F0FDF4', borderLeftWidth: 3, borderLeftColor: COLORS.success, borderRadius: 6, padding: 8, marginTop: 6 },
  recText: { fontSize: 12.5, color: '#14532D' },
  askRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  input: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 13, height: 46, fontSize: 13.5 },
  askBtn: { width: 46, height: 46, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 8 },
  error: { color: COLORS.crimson, fontSize: 12.5, flexShrink: 1 },
  chartCard: { backgroundColor: COLORS.bg, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, padding: 10, marginTop: 4 },
  chartTitle: { fontSize: 11.5, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
});
