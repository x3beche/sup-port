import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useBackHandler } from '../lib/backHandler';
import { onColor, tabularNums, theme } from '../theme';
import { Icon } from './Icon';

const GREEN = theme.color.success;

/**
 * İndirme + doğrulama bittiğinde çıkan "güncellendi → yeniden başlat" ekranı.
 * Kullanıcı indirme boyunca ana ekranda kalır; bu ekran güzel bir animasyonla
 * (fade + yaylı ölçek + içerik yükselme) belirir.
 */
export function UpdateSuccess({
  version,
  onRestart,
  onClose,
}: {
  version: string;
  onRestart: () => void;
  onClose: () => void;
}) {
  const fade = useRef(new Animated.Value(0)).current; // overlay
  const pop = useRef(new Animated.Value(0)).current; // yeşil daire
  const rise = useRef(new Animated.Value(0)).current; // metin + buton

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fade, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [fade, pop, rise]);

  useBackHandler(() => {
    onClose();
    return true;
  });

  const circleScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const riseY = rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Animated.View style={[styles.overlay, { opacity: fade }]} testID="update-done">
      <Animated.View style={[styles.checkCircle, { backgroundColor: GREEN, opacity: pop, transform: [{ scale: circleScale }] }]}>
        <Icon name="check" size={64} strokeWidth={2.6} color={onColor(GREEN)} />
      </Animated.View>

      <Animated.View style={{ alignItems: 'center', opacity: rise, transform: [{ translateY: riseY }] }}>
        <Text style={styles.title}>Uygulama güncellendi</Text>
        <Text style={styles.version}>v{version}</Text>
        <Text style={styles.sub}>En son sürüm için uygulamayı yeniden başlat.</Text>
        <Pressable
          onPress={onRestart}
          testID="update-restart"
          accessibilityRole="button"
          style={({ pressed }) => [styles.primaryBtn, { backgroundColor: GREEN }, pressed && styles.pressed]}
        >
          <Text style={[styles.primaryText, { color: onColor(GREEN) }]}>Yeniden başlat</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/** Web'de yeniden başlatma = sayfa yenile; native gerçek sürümde yeni APK açılır. */
export function restartApp(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.reload();
  }
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.color.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space(6),
    zIndex: 60,
  },
  checkCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.space(6),
  },
  title: { fontSize: theme.font.title + 2, fontWeight: '800', color: theme.color.text },
  version: { marginTop: 4, fontSize: theme.font.body, color: GREEN, fontWeight: '700', ...tabularNums },
  sub: {
    marginTop: theme.space(3),
    fontSize: theme.font.label,
    color: theme.color.textMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
  primaryBtn: {
    marginTop: theme.space(7),
    minHeight: 52,
    paddingHorizontal: theme.space(8),
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: theme.font.body, fontWeight: '800' },
  pressed: { opacity: 0.85 },
});
