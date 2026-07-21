import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { useBackHandler } from '../lib/backHandler';
import { useCachedQuery } from '../lib/useCachedQuery';
import { theme } from '../theme';
import type { StoreApp } from '../types';

/** Mağazada kategori sırası; kayıtta olmayan kategori sona düşer. */
const CATEGORY_ORDER = ['Sağlık', 'Hareket', 'Zihin', 'Öğrenme', 'Finans'];

function groupByCategory(apps: StoreApp[]): Array<[string, StoreApp[]]> {
  const groups = new Map<string, StoreApp[]>();
  for (const app of apps) {
    const list = groups.get(app.category) ?? [];
    list.push(app);
    groups.set(app.category, list);
  }
  return [...groups.entries()].sort(
    (a, b) => (CATEGORY_ORDER.indexOf(a[0]) + 100) - (CATEGORY_ORDER.indexOf(b[0]) + 100),
  );
}

export function StoreScreen({
  onBack,
  onOpenApp,
}: {
  onBack: () => void;
  onOpenApp: (app: StoreApp) => void;
}) {
  const { token } = useAuth();
  useBackHandler(() => {
    onBack();
    return true;
  });

  const fetcher = useCallback(
    (signal: AbortSignal) => apiRequest<StoreApp[]>('/api/store', { token, signal }),
    [token],
  );

  const { data, loading } = useCachedQuery<StoreApp[]>(token ? 'store' : null, fetcher);

  const grouped = useMemo(() => groupByCategory(data ?? []), [data]);
  const installedCount = (data ?? []).filter((a) => a.installed).length;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      testID="store-screen"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={onBack}
          testID="store-back"
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Geri"
        >
          <Icon name="chevron-left" size={22} strokeWidth={2} color={theme.color.text} />
        </Pressable>
        <Text style={styles.topTitle}>Mağaza</Text>
        <View style={styles.back} />
      </View>

      <Text style={styles.lead}>
        Uygulamaları kur ya da kaldır. Kaldırdığın bir uygulamayı geri kurduğunda
        verilerin yerinde durur.
      </Text>

      {loading && !data ? (
        <View style={styles.loader} testID="store-loading">
          <ActivityIndicator color={theme.color.accent} />
        </View>
      ) : (
        grouped.map(([category, apps]) => (
          <View key={category} style={styles.section}>
            <Text style={styles.sectionTitle}>{category}</Text>
            {apps.map((app) => (
              <Pressable
                key={app.key}
                onPress={() => onOpenApp(app)}
                testID={`store-app-${app.key}`}
                accessibilityRole="button"
                accessibilityLabel={`${app.title}, ${
                  app.coming_soon ? 'yakında' : app.installed ? 'kurulu' : 'kurulu değil'
                }`}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View
                  style={[
                    styles.icon,
                    { backgroundColor: `${app.color}26` },
                    app.coming_soon && styles.iconSoon,
                  ]}
                >
                  <Icon name={app.icon as IconName} size={24} color={app.color} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.appTitle}>{app.title}</Text>
                  <Text style={styles.appDesc} numberOfLines={1}>
                    {app.description}
                  </Text>
                </View>
                {app.coming_soon ? (
                  <View style={styles.soonTag}>
                    <Text style={styles.soonText}>YAKINDA</Text>
                  </View>
                ) : app.installed ? (
                  <View style={styles.installedTag}>
                    <Icon name="check" size={12} strokeWidth={2.4} color={theme.color.success} />
                  </View>
                ) : (
                  <View style={[styles.getTag, { borderColor: app.color }]}>
                    <Text style={[styles.getText, { color: app.color }]}>KUR</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        ))
      )}

      <Text style={styles.footer}>{installedCount} uygulama kurulu</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space(5), paddingBottom: theme.space(10) },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.space(3),
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: theme.font.body + 1, fontWeight: '800', color: theme.color.text },
  lead: {
    fontSize: theme.font.label,
    color: theme.color.textMuted,
    marginBottom: theme.space(5),
    lineHeight: 20,
  },
  loader: { paddingVertical: theme.space(10), alignItems: 'center' },
  section: { marginBottom: theme.space(6) },
  sectionTitle: {
    fontSize: theme.font.caption,
    fontWeight: '800',
    color: theme.color.textFaint,
    letterSpacing: 0.6,
    marginBottom: theme.space(3),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.md,
    padding: theme.space(3),
    marginBottom: theme.space(2),
  },
  rowPressed: { opacity: 0.7 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, marginLeft: theme.space(3) },
  appTitle: { fontSize: theme.font.body, fontWeight: '700', color: theme.color.text },
  appDesc: { marginTop: 2, fontSize: theme.font.caption, color: theme.color.textMuted },
  installedTag: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.space(2),
  },
  getTag: {
    paddingHorizontal: theme.space(3),
    height: 32,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.space(2),
  },
  getText: { fontSize: theme.font.caption, fontWeight: '800', letterSpacing: 0.4 },
  iconSoon: { opacity: 0.55 },
  soonTag: {
    paddingHorizontal: theme.space(3),
    height: 32,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.warnBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.space(2),
  },
  soonText: {
    fontSize: theme.font.tiny,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: theme.color.warnText,
  },
  footer: {
    textAlign: 'center',
    fontSize: theme.font.caption,
    color: theme.color.textFaint,
    marginTop: theme.space(2),
  },
});
