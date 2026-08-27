import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, StyleSheet, Text, View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen from './src/screens/DashboardScreen';
import AssistantScreen from './src/screens/AssistantScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { fetchCatalog, getApiBase } from './src/services/api';
import { COLORS } from './src/theme';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Dashboard: 'grid',
  Assistant: 'chatbubbles',
  Reports: 'stats-chart',
  Settings: 'settings',
};

function SplashScreen({ onReady }) {
  const [status, setStatus] = useState('Connecting to server...');

  useEffect(() => {
    (async () => {
      try {
        const base = getApiBase();
        const host = base.replace(/^https?:\/\//, '').replace(/\/api$/, '');
        setStatus(`Connecting to ${host}...`);
        await fetchCatalog();
        setStatus('Connected');
      } catch {
        setStatus('Server waking up...');
        await new Promise((r) => setTimeout(r, 2000));
        try {
          await fetchCatalog();
          setStatus('Connected');
        } catch {
          setStatus('Offline — will retry when you open a tab');
        }
      }
      setTimeout(() => onReady(), 500);
    })();
  }, []);

  return (
    <View style={splashStyles.container}>
      <View style={splashStyles.logoWrap}>
        <View style={splashStyles.logo}>
          <Text style={splashStyles.logoN}>N</Text>
        </View>
        <Text style={splashStyles.brand}>NexaSphere</Text>
        <Text style={splashStyles.tagline}>Business Intelligence</Text>
      </View>
      <ActivityIndicator size="small" color={COLORS.sky} style={{ marginTop: 32 }} />
      <Text style={splashStyles.status}>{status}</Text>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: { alignItems: 'center' },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    elevation: 8,
  },
  logoN: {
    fontSize: 44,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  brand: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  status: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 12,
  },
});

export default function App() {
  const [ready, setReady] = useState(false);
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    if (!ready) return;
    fetchCatalog().then(setCatalog).catch(() => {});
  }, [ready]);

  if (!ready) {
    return (
      <>
        <StatusBar style="light" />
        <SplashScreen onReady={() => setReady(true)} />
      </>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: COLORS.emerald,
          tabBarInactiveTintColor: '#64748B',
          tabBarStyle: {
            backgroundColor: COLORS.ink,
            borderTopColor: COLORS.surface2,
            height: 60,
            paddingBottom: 6,
            paddingTop: 4,
          },
          tabBarIcon: ({ color }) => (
            <Ionicons name={TAB_ICONS[route.name]} size={20} color={color} />
          ),
          tabBarLabel: ({ color }) => (
            <Text style={{ color, fontSize: 10, fontWeight: '600', marginTop: 1 }}>
              {route.name}
            </Text>
          ),
        })}
      >
        <Tab.Screen name="Dashboard">
          {() => <DashboardScreen />}
        </Tab.Screen>
        <Tab.Screen name="Assistant">
          {() => <AssistantScreen catalog={catalog} />}
        </Tab.Screen>
        <Tab.Screen name="Reports">
          {() => <ReportsScreen />}
        </Tab.Screen>
        <Tab.Screen name="Settings">
          {() => <SettingsScreen />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
