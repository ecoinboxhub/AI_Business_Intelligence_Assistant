import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getApiBase, setApiBase, testConnection } from '../services/api';
import { COLORS } from '../theme';

export default function SettingsScreen() {
  const [base, setBase] = useState('');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getApiBase().then((url) => {
      setBase(url);
      setLoaded(true);
    });
  }, []);

  const check = async () => {
    setTesting(true);
    setConnected(null);
    const ok = await testConnection(base);
    setConnected(ok);
    setTesting(false);
  };

  const save = async () => {
    const trimmed = (base || '').trim().replace(/\/+$/, '');
    if (!trimmed) return;
    await setApiBase(trimmed);
    setBase(trimmed);
    setSaved(true);
    await check();
    setTimeout(() => setSaved(false), 2000);
  };

  if (!loaded) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.sub}>Backend API connection</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="server-outline" size={16} color={COLORS.amber} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>API Base URL</Text>
        <TextInput
          style={styles.input}
          value={base}
          onChangeText={(t) => { setBase(t); setConnected(null); setSaved(false); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://nexasphere-bi.onrender.com/api"
          placeholderTextColor="#94A3B8"
        />

        <View style={styles.statusRow}>
          {testing ? (
            <View style={styles.statusItem}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.statusText}>Testing...</Text>
            </View>
          ) : connected === true ? (
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: COLORS.success }]} />
              <Text style={[styles.statusText, { color: COLORS.success }]}>Connected</Text>
            </View>
          ) : connected === false ? (
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: COLORS.crimson }]} />
              <Text style={[styles.statusText, { color: COLORS.crimson }]}>Cannot connect</Text>
            </View>
          ) : null}
          {saved && (
            <View style={styles.statusItem}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
              <Text style={[styles.statusText, { color: COLORS.success }]}>Saved</Text>
            </View>
          )}
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, styles.testBtn]} onPress={check} disabled={testing}>
            <Ionicons name="refresh" size={16} color={COLORS.primary} />
            <Text style={styles.testBtnText}>Test</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={save} disabled={testing}>
            <Ionicons name="save-outline" size={16} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>Save & Connect</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.helpTitle}>How it works</Text>

        <View style={styles.helpStep}>
          <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>Backend is hosted on Fly.io</Text>
            <Text style={styles.stepCode}>https://nexasphere-bi.onrender.com/api</Text>
            <Text style={styles.stepHint}>No setup needed — the app connects automatically</Text>
          </View>
        </View>

        <View style={styles.helpStep}>
          <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>Or connect to your own backend</Text>
            <Text style={styles.stepCode}>http://YOUR_IP:5050/api</Text>
            <Text style={styles.stepHint}>Both devices must be on the same Wi-Fi network</Text>
          </View>
        </View>
      </View>

      <Text style={styles.footer}>
        NexaSphere Mobile BI v1.0{'\n'}
        All figures computed deterministically via Pandas on the backend.
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
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: COLORS.text,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    minHeight: 20,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: { fontSize: 12, fontWeight: '600', color: COLORS.textSoft },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 12,
  },
  testBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  testBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  saveBtn: { backgroundColor: COLORS.primary },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  helpTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 14 },
  helpStep: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
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
  stepTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  stepCode: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: COLORS.primary,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    lineHeight: 18,
  },
  stepHint: { fontSize: 11, color: COLORS.textSoft, marginTop: 4 },
  footer: {
    fontSize: 11,
    color: COLORS.textSoft,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 16,
  },
});
