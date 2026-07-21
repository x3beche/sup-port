import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ScreenTransition } from './src/components/ScreenTransition';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { useInsets } from './src/lib/insets';
import { hideScrollbars } from './src/lib/webChrome';
import { AuthScreen } from './src/screens/AuthScreen';
import { BrushScreen } from './src/screens/BrushScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ModuleScreen } from './src/screens/ModuleScreen';
import { SporScreen } from './src/screens/SporScreen';
import { StoreDetailScreen } from './src/screens/StoreDetailScreen';
import { StoreScreen } from './src/screens/StoreScreen';
import { theme } from './src/theme';
import type { ModuleProgress, StoreApp } from './src/types';

type Route =
  | { name: 'home' }
  | { name: 'module'; module: ModuleProgress }
  | { name: 'store' }
  | { name: 'storeDetail'; app: StoreApp };

/**
 * A small route stack instead of a navigator: the app is only ever a couple of
 * screens deep. Swap for expo-router when modules need deep links or their own
 * nested stacks.
 */
function Shell() {
  const { token, initialising } = useAuth();
  const [route, setRoute] = useState<Route>({ name: 'home' });
  // Direction drives the slide: forward on push, backward on pop.
  const [goingBack, setGoingBack] = useState(false);
  // Bumped when the store changes an install, so Home remounts and refetches.
  const [homeVersion, setHomeVersion] = useState(0);

  const push = useCallback((next: Route) => {
    setGoingBack(false);
    setRoute(next);
  }, []);

  const goHome = useCallback((changed = false) => {
    setGoingBack(true);
    if (changed) setHomeVersion((v) => v + 1);
    setRoute({ name: 'home' });
  }, []);

  const goStore = useCallback(() => {
    setGoingBack(true);
    setRoute({ name: 'store' });
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

  if (route.name === 'module') {
    // Bazı modüller jenerik sayaç yerine kendi zengin ekranını kullanır (diş
    // fırçalama: yuvalar/seri/2 dk sayaç; spor: kütüphane/BMI/hedef). Diğerleri
    // ortak ModuleScreen'de.
    const Screen =
      route.module.key === 'brush'
        ? BrushScreen
        : route.module.key === 'workout'
          ? SporScreen
          : ModuleScreen;
    return (
      <ScreenTransition key={`module-${route.module.key}`} direction="forward">
        <Screen module={route.module} onBack={() => goHome()} />
      </ScreenTransition>
    );
  }

  if (route.name === 'store') {
    return (
      <ScreenTransition key="store" direction={goingBack ? 'backward' : 'forward'}>
        <StoreScreen
          onBack={() => goHome()}
          onOpenApp={(app) => push({ name: 'storeDetail', app })}
        />
      </ScreenTransition>
    );
  }

  if (route.name === 'storeDetail') {
    return (
      <ScreenTransition key={`store-${route.app.key}`} direction="forward">
        <StoreDetailScreen
          app={route.app}
          onBack={goStore}
          // An install/uninstall must reach Home so the grid reflects it.
          onChanged={() => setHomeVersion((v) => v + 1)}
        />
      </ScreenTransition>
    );
  }

  return (
    <ScreenTransition key={`home-${homeVersion}`} direction={goingBack ? 'backward' : 'fade'}>
      <HomeScreen
        onOpenModule={(module) => push({ name: 'module', module })}
        onOpenStore={goStore}
      />
    </ScreenTransition>
  );
}

/**
 * İçeriği güvenli alanın içine yerleştirir: üstte durum çubuğu, altta gezinme
 * çubuğu boşluğu. Android edge-to-edge'de bunlar olmadan içerik sistem
 * çubuklarının altına sızıp "kullanılamaz alan" oluşturuyordu.
 */
function SafeAreaShell() {
  const insets = useInsets();
  return (
    <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Shell />
      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  // Expo'nun ürettiği HTML lang="en" geliyor; ekran okuyucu Türkçe metni
  // İngilizce ses motoruyla okuyordu (WCAG 3.1.1).
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = 'tr';
    }
    hideScrollbars();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SafeAreaShell />
      </AuthProvider>
    </SafeAreaProvider>
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
