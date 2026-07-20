import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ModuleScreen } from './src/screens/ModuleScreen';
import { theme } from './src/theme';
import type { ModuleProgress } from './src/types';

/**
 * Two screens deep is all the shell needs today, so this stays a plain state
 * switch instead of pulling in a navigator. Swap for expo-router when the
 * modules need deep links or their own nested stacks.
 */
function Shell() {
  const { token, initialising } = useAuth();
  const [openModule, setOpenModule] = useState<ModuleProgress | null>(null);

  if (initialising) {
    return (
      <View style={styles.loader} testID="app-loading">
        <ActivityIndicator color={theme.color.accent} />
      </View>
    );
  }

  if (!token) return <AuthScreen />;

  if (openModule) {
    return <ModuleScreen module={openModule} onBack={() => setOpenModule(null)} />;
  }

  return <HomeScreen onOpenModule={setOpenModule} />;
}

export default function App() {
  return (
    <AuthProvider>
      <SafeAreaView style={styles.safeArea}>
        <Shell />
        <StatusBar style="light" />
      </SafeAreaView>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.bg,
  },
});
