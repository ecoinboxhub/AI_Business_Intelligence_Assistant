import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getApiBase, testConnection } from '../services/api';
import { COLORS } from '../theme';

export default function SettingsScreen() {
  const [connected, setConnected] = useState(null);
  const [testing, setTesting] = useState(false);
  const [base, setBase] = useState('');

  useEffect(() => {
    setBase(getApiBase());
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setTesting(true);
    setConnected(null);
    const ok = await testConnection();
    setConnected(ok);
    setTesting(false);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.sub}>Backend connection</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="server-outline" size={16} color={COLORS.amber} />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="cloud-done" size={18} color={COLORS.primary} />
          <Text style={styles.cardTitle}>API Connection</Text>
        </View>

        <View style={styles.urlBox}>
          <Text style={styles.urlLabel}>Hosted Backend</Text>
          <Text style={styles.urlText} selectable>{base}</Text>
        </View>

        <View style={styles.statusRow}>
          {testing ? (
            <View style={styles.statusItem}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.statusText}>Testing connection...</Text>
            </View>
          ) : connected === true ? (
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: COLORS.success }]} />
              <Text style={[styles.statusText, { color: COLORS.success }]}>Connected and healthy</Text>
            </View>
          ) : connected === false ? (
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: COLORS.crimson }]} />
              <Text style={[styles.statusText, { color: COLORS.crimson }]}>Server may be sleeping</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity style={styles.testBtn} onPress={checkConnection} disabled={testing} activeOpacity={0.7}>
          <Ionicons name="refresh" size={16} color={COLORS.primary} />
          <Text style={styles.testBtnText}>{testing ? 'Testing...' : 'Test Connection'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="information-circle" size={18} color={COLORS.sky} />
          <Text style={styles.cardTitle}>How it works</Text>
        </View>

        <View style={styles.helpStep}>
          <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>Hosted on Render</Text>
            <Text style={styles.stepHint}>The backend runs on Render.com's free tier</Text>
          </View>
        </View>

        <View style={styles.helpStep}>
          <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>Cold start</Text>
            <Text style={styles.stepHint}>First request after idle may take 30-60 seconds</Text>
          </View>
        </View>

        <View style={styles.helpStep}>
          <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>Deterministic analytics</Text>
            <Text style={styles.stepHint}>All numbers computed via Pandas — no AI hallucination</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="key" size={18} color={COLORS.emerald} />
          <Text style={styles.cardTitle}>AI Narrative</Text>
        </View>
        <Text style={styles.stepHint}>
          AI-powered narrative insights are generated when the GEMINI_API_KEY is configured on the server.
          Without it, only deterministic metrics and charts are shown.
        </Text>
      </View>

      <Text style={styles.footer}>
        NexaSphere Mobile BI v1.0{'\n'}
        Zero-hallucination business intelligence
      </Text>
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
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  urlBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  urlLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textSoft, marginBottom: 4 },
  urlText: { fontSize: 12, fontFamily: 'monospace', color: COLORS.primary, lineHeight: 18 },
  statusRow: { minHeight: 24, marginBottom: 10 },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '600', color: COLORS.textSoft },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 12,
  },
  testBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  helpStep: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  stepTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  stepHint: { fontSize: 11, color: COLORS.textSoft, lineHeight: 16 },
  footer: {
    fontSize: 11,
    color: COLORS.textSoft,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 16,
  },
});
