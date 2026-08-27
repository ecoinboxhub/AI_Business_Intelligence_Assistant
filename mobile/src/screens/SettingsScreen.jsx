import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getApiBase, setApiBase } from '../services/api';
import { COLORS } from '../theme';

export default function SettingsScreen({ onSaved }) {
  const [base, setBase] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getApiBase().then(setBase);
  }, []);

  const save = async () => {
    await setApiBase(base);
    setSaved(true);
    if (onSaved) onSaved();
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.sub}>Backend API connection</Text>

      <Text style={styles.label}>API Base URL</Text>
      <TextInput
        style={styles.input}
        value={base}
        onChangeText={setBase}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="http://localhost:5050/api"
      />
      <Text style={styles.hint}>
        Run the backend first:{'\n'}
        cd backend && python -m uvicorn app.main:app --port 5050{'\n\n'}
        Then enter your machine&apos;s IP on the same WiFi:{'\n'}
        Example: http://192.168.1.100:5050/api{'\n\n'}
        The app will remember this URL for next time.
      </Text>

      <TouchableOpacity style={styles.saveBtn} onPress={save}>
        <Text style={styles.saveText}>
          {saved ? '✓ Saved' : 'Save connection'}
        </Text>
        <Ionicons name={saved ? 'checkmark-circle' : 'save'} size={16} color="#FFFFFF" />
      </TouchableOpacity>

      <Text style={styles.footer}>
        NexaSphere Mobile BI v1.0 · All figures computed deterministically via Pandas on the backend.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 18 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  sub: { fontSize: 12.5, color: COLORS.textSoft, marginBottom: 22 },
  label: { fontSize: 12.5, fontWeight: '700', color: COLORS.text, marginBottom: 7 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10,
    paddingHorizontal: 13, height: 46, fontSize: 13,
  },
  hint: { fontSize: 11.5, color: COLORS.textSoft, lineHeight: 17, marginTop: 9 },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 13,
    alignItems: 'center', marginTop: 18, flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  footer: { fontSize: 11, color: COLORS.textSoft, textAlign: 'center', marginTop: 30, lineHeight: 16 },
});
