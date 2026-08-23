import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen from './src/screens/DashboardScreen';
import AssistantScreen from './src/screens/AssistantScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { fetchCatalog } from './src/services/api';
import { COLORS } from './src/theme';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Dashboard: 'grid',
  Assistant: 'chatbubbles',
  Reports: 'stats-chart',
  Settings: 'settings',
};

export default function App() {
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    fetchCatalog().then(setCatalog).catch(() => {});
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: COLORS.emerald,
          tabBarInactiveTintColor: '#94A3B8',
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderTopColor: COLORS.surface2,
            height: 62,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={TAB_ICONS[route.name]} size={18}
                      color={color} focused={focused} />
          ),
          tabBarLabel: ({ color }) => (
            <Text style={{ color, fontSize: 10.5, fontWeight: '600' }}>{route.name}</Text>
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
