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
      setThread((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const suggestions = (catalog || []).slice(0, 6);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>AI Assistant</Text>
            <Text style={styles.sub}>Structured answers · Pandas-computed numbers</Text>
          </View>
          <View style={styles.headerBadge}>
            <Ionicons name="sparkles" size={16} color={COLORS.sky} />
          </View>
        </View>

        {suggestions.length > 0 && thread.length === 0 && (
          <View style={styles.suggestionSection}>
            <Text style={styles.suggestionLabel}>Quick questions</Text>
            <View style={styles.chipWrap}>
              {suggestions.map((c) => (
                <TouchableOpacity key={c.id} style={styles.chip} onPress={() => ask(c.label)}>
                  <Text style={styles.chipText}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="cloud-offline" size={16} color={COLORS.crimson} />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>Request Failed</Text>
              <Text style={styles.error}>{error}</Text>
            </View>
          </View>
        ) : null}

        {thread.map((t, i) =>
          t.role === 'user' ? (
            <View key={i} style={styles.userBubble}>
              <Text style={styles.userText}>{t.text}</Text>
            </View>
          ) : (
            <View key={i} style={styles.aiCard}>
              {(t.res.metrics || []).length > 0 && (
                <View style={styles.metricsRow}>
                  {(t.res.metrics || []).map((m, mi) => (
                    <View key={mi} style={styles.metricChip}>
                      <Text style={styles.metricLabel}>{m.label}</Text>
                      <Text style={styles.metricValue}>{m.value}</Text>
                    </View>
                  ))}
                </View>
              )}

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
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionLabel, { color: '#0369A1' }]}>OBSERVED FACTS</Text>
                  {(t.res.findings || []).map((f, fi) => (
                    <Text key={fi} style={styles.factItem}>• {f}</Text>
                  ))}
                </View>
              )}

              {(t.res.risks || []).length > 0 && (
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionLabel, { color: COLORS.warn }]}>RISKS</Text>
                  {(t.res.risks || []).map((r, ri) => (
                    <Text key={ri} style={styles.riskItem}>⚠ {r}</Text>
                  ))}
                </View>
              )}

              {(t.res.recommendations || []).length > 0 && (
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionLabel, { color: COLORS.success }]}>RECOMMENDATIONS</Text>
                  {(t.res.recommendations || []).map((r, ri) => (
                    <View key={ri} style={styles.recItem}>
                      <Text style={styles.recText}>{r}</Text>
                    </View>
                  ))}
                </View>
              )}

              {(t.res.follow_up_questions || []).length > 0 && (
                <View style={styles.followUpSection}>
                  <Text style={styles.followUpLabel}>Follow-up questions</Text>
                  {(t.res.follow_up_questions || []).slice(0, 3).map((fq, fqi) => (
                    <TouchableOpacity key={fqi} style={styles.followUpChip} onPress={() => ask(fq)}>
                      <Ionicons name="arrow-forward-circle" size={14} color={COLORS.primary} />
                      <Text style={styles.followUpText} numberOfLines={1}>{fq}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )
        )}

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>Analyzing...</Text>
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Ask a business question..."
          placeholderTextColor="#94A3B8"
          value={question}
          onChangeText={setQuestion}
          onSubmitEditing={() => ask()}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.askBtn, (!question.trim() || loading) && { opacity: 0.5 }]}
          onPress={() => ask()}
          disabled={loading || !question.trim()}
        >
          <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 8 },
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
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionSection: { marginBottom: 12 },
  suggestionLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSoft, marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipText: { color: COLORS.primary, fontSize: 12, fontWeight: '500' },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 4,
    maxWidth: '85%',
  },
  userText: { color: '#fff', fontSize: 13.5 },
  aiCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginTop: 8,
  },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  metricChip: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricLabel: { fontSize: 10, color: COLORS.textSoft },
  metricValue: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginTop: 1 },
  answer: { fontSize: 13.5, lineHeight: 21, color: COLORS.text, marginBottom: 8 },
  sectionBlock: { marginTop: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 6 },
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
  followUpSection: { marginTop: 12 },
  followUpLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSoft, marginBottom: 6 },
  followUpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  followUpText: { fontSize: 12, color: COLORS.primary, flex: 1 },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingLeft: 4,
  },
  loadingText: { fontSize: 13, color: COLORS.textSoft },
  inputBar: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: COLORS.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 14,
    color: COLORS.text,
  },
  askBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
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
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.crimson,
  },
  errorTitle: { fontSize: 12, fontWeight: '700', color: COLORS.crimson, marginBottom: 2 },
  error: { color: COLORS.crimson, fontSize: 12, flexShrink: 1 },
  chartCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    marginTop: 6,
  },
  chartTitle: { fontSize: 11, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
});
