import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, SafeAreaView, StyleSheet, View } from 'react-native';
import { ScreenTransition } from './src/components/ScreenTransition';
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
  // Remembering how we got here is what lets "back" slide the other way.
  const [goingBack, setGoingBack] = useState(false);

  const openDetail = useCallback((module: ModuleProgress) => {
    setGoingBack(false);
    setOpenModule(module);
  }, []);

  const closeDetail = useCallback(() => {
    setGoingBack(true);
    setOpenModule(null);
  }, []);

  if (initialising) {
    return (
      <View style={styles.loader} testID="app-loading">
        <ActivityIndicator color={theme.color.accent} />
      </View>
    );
  }

  if (!token) {
    return (
      <ScreenTransition key="auth" direction="fade">
        <AuthScreen />
      </ScreenTransition>
    );
  }

  if (openModule) {
    return (
      // Keying on the module makes each open re-run the entrance animation.
      <ScreenTransition key={`module-${openModule.key}`} direction="forward">
        <ModuleScreen module={openModule} onBack={closeDetail} />
      </ScreenTransition>
    );
  }

  return (
    <ScreenTransition key="home" direction={goingBack ? 'backward' : 'fade'}>
      <HomeScreen onOpenModule={openDetail} />
    </ScreenTransition>
  );
}

export default function App() {
  // Expo'nun ürettiği HTML lang="en" geliyor; ekran okuyucu Türkçe metni
  // İngilizce ses motoruyla okuyordu (WCAG 3.1.1).
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = 'tr';
    }
  }, []);

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
