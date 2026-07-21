import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { useBackHandler } from '../lib/backHandler';
import { onColor, theme } from '../theme';
import type { StoreApp } from '../types';

type Props = {
  app: StoreApp;
  onBack: () => void;
  /** Kurulum durumu değişince ana ekranın ve mağazanın tazelenmesi için. */
  onChanged: (app: StoreApp) => void;
};

export function StoreDetailScreen({ app: initial, onBack, onChanged }: Props) {
  const { token } = useAuth();
  useBackHandler(() => {
    onBack();
    return true;
  });
  const [app, setApp] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);

    const installing = !app.installed;
    try {
      const result = await apiRequest<StoreApp>(`/api/store/${app.key}/install`, {
        method: installing ? 'POST' : 'DELETE',
        token,
      });
      setApp(result);
      onChanged(result);
    } catch (err) {
      setError((err as Error)?.message ?? 'İşlem tamamlanamadı');
    } finally {
      setBusy(false);
    }
  }, [app.installed, app.key, busy, onChanged, token]);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      testID={`store-detail-${app.key}`}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={onBack}
          testID="detail-back"
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Geri"
        >
          <Icon name="chevron-left" size={22} strokeWidth={2} color={theme.color.text} />
        </Pressable>
      </View>

      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: `${app.color}26` }]}>
          <Icon name={app.icon as IconName} size={40} color={app.color} />
        </View>
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{app.title}</Text>
            {app.coming_soon ? (
              <View style={styles.soonBadge}>
                <Text style={styles.soonBadgeText}>YAKINDA</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.category}>{app.category}</Text>
        </View>
      </View>

      {app.coming_soon ? (
        <View
          testID="detail-soon"
          accessibilityRole="text"
          accessibilityLabel={`${app.title} yakında geliyor`}
          style={[styles.button, styles.buttonSoon]}
        >
          <Text style={[styles.buttonText, styles.buttonSoonText]}>Yakında</Text>
        </View>
      ) : (
        <Pressable
          onPress={toggle}
          disabled={busy}
          testID="detail-toggle"
          accessibilityRole="button"
          accessibilityLabel={app.installed ? `${app.title} uygulamasını kaldır` : `${app.title} uygulamasını kur`}
          style={({ pressed }) => [
            styles.button,
            app.installed ? styles.buttonInstalled : { backgroundColor: app.color },
            pressed && styles.pressed,
            busy && styles.busy,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={app.installed ? theme.color.text : onColor(app.color)} />
          ) : (
            <Text
              style={[
                styles.buttonText,
                { color: app.installed ? theme.color.text : onColor(app.color) },
              ]}
            >
              {app.installed ? 'Kaldır' : 'Kur'}
            </Text>
          )}
        </Pressable>
      )}

      {error ? (
        <Text style={styles.error} testID="detail-error" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Text style={styles.sectionTitle}>Hakkında</Text>
      <Text style={styles.about}>{app.about}</Text>

      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Günlük hedef</Text>
          <Text style={styles.metaValue}>
            {app.target} {app.unit}
          </Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Durum</Text>
          <Text style={styles.metaValue}>
            {app.coming_soon ? 'Yakında' : app.installed ? 'Kurulu' : 'Kurulu değil'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space(5), paddingBottom: theme.space(10) },
  topBar: { flexDirection: 'row', marginBottom: theme.space(2) },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.space(6) },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { marginLeft: theme.space(4), flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  title: { fontSize: theme.font.title, fontWeight: '800', color: theme.color.text },
  category: { marginTop: 2, fontSize: theme.font.label, color: theme.color.textMuted },
  soonBadge: {
    marginLeft: theme.space(2),
    paddingHorizontal: theme.space(2),
    height: 22,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.warnBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soonBadgeText: {
    fontSize: theme.font.tiny,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: theme.color.warnText,
  },
  button: {
    height: 50,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.space(6),
  },
  buttonInstalled: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  buttonSoon: {
    backgroundColor: theme.color.warnBg,
  },
  buttonSoonText: {
    color: theme.color.warnText,
  },
  pressed: { opacity: 0.85 },
  busy: { opacity: 0.75 },
  buttonText: { fontSize: theme.font.body, fontWeight: '800' },
  error: {
    fontSize: theme.font.label,
    color: theme.color.danger,
    fontWeight: '600',
    marginTop: -theme.space(3),
    marginBottom: theme.space(4),
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: theme.font.caption,
    fontWeight: '800',
    color: theme.color.textFaint,
    letterSpacing: 0.6,
    marginBottom: theme.space(2),
  },
  about: {
    fontSize: theme.font.body,
    color: theme.color.textMuted,
    lineHeight: 23,
    marginBottom: theme.space(6),
  },
  meta: {
    flexDirection: 'row',
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.md,
    padding: theme.space(4),
    alignItems: 'center',
  },
  metaItem: { flex: 1, alignItems: 'center' },
  metaDivider: { width: 1, height: 32, backgroundColor: theme.color.border },
  metaLabel: { fontSize: theme.font.tiny, color: theme.color.textMuted, fontWeight: '600' },
  metaValue: {
    marginTop: 4,
    fontSize: theme.font.body,
    fontWeight: '700',
    color: theme.color.text,
  },
});
