import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ModuleTile } from '../components/ModuleTile';
import { StaggeredItem } from '../components/ScreenTransition';
import { ScoreRing } from '../components/ScoreRing';
import { useAuth } from '../context/AuthContext';
import { apiRequest, todayIso } from '../lib/api';
import { useCachedQuery } from '../lib/useCachedQuery';
import { theme } from '../theme';
import type { DailySummary, ModuleProgress } from '../types';

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
};

function scoreCaption(score: number): string {
  if (score >= 90) return 'mükemmel';
  if (score >= 70) return 'çok iyi';
  if (score >= 40) return 'devam et';
  if (score > 0) return 'başlangıç';
  return 'hadi başla';
}

export function HomeScreen({ onOpenModule }: { onOpenModule: (m: ModuleProgress) => void }) {
  const { user, token, logout } = useAuth();
  const today = todayIso();

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      apiRequest<DailySummary>(`/api/summary?date=${today}`, { token, signal }),
    [token, today],
  );

  const { data, loading, refreshing, error, fromCache, refresh } = useCachedQuery<DailySummary>(
    token ? `summary:${today}` : null,
    fetcher,
  );

  const prettyDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('tr-TR', DATE_FORMAT).format(new Date(`${today}T00:00:00`));
    } catch {
      return today;
    }
  }, [today]);

  if (loading && !data) {
    return (
      <View style={styles.loader} testID="home-loading">
        <ActivityIndicator color={theme.color.accent} />
      </View>
    );
  }

  const modules = data?.modules ?? [];

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      testID="home-screen"
      refreshControl={
        <RefreshControl refreshing={refreshing && !fromCache} onRefresh={refresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.flexShrink}>
          <Text style={styles.greeting} numberOfLines={1}>
            Merhaba, {user?.name ?? ''}
          </Text>
          <Text style={styles.date}>{prettyDate}</Text>
        </View>
        <Pressable onPress={logout} testID="logout" style={styles.logout} accessibilityRole="button">
          <Text style={styles.logoutText}>Çıkış</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.banner} testID="home-error">
          <Text style={styles.bannerText}>
            {fromCache || data ? `Çevrimdışı veriler gösteriliyor — ${error}` : error}
          </Text>
        </View>
      ) : null}

      <View style={styles.scoreCard} testID="score-card">
        <Text style={styles.sectionEyebrow}>GÜNÜN ÖZETİ</Text>
        <ScoreRing score={data?.score ?? 0} caption={scoreCaption(data?.score ?? 0)} />

        <View style={styles.statRow}>
          <Stat value={`${data?.completed_count ?? 0}/${data?.module_count ?? 0}`} label="Tamamlanan" />
          <View style={styles.statDivider} />
          <Stat value={`${data?.score ?? 0}%`} label="Günlük puan" />
        </View>
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Uygulamalar</Text>
        <Text style={styles.sectionCount}>{modules.length}</Text>
      </View>

      <View style={styles.grid} testID="module-grid">
        {modules.map((module, index) => (
          <StaggeredItem key={module.key} index={index}>
            <ModuleTile module={module} onPress={onOpenModule} />
          </StaggeredItem>
        ))}
      </View>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.color.bg },
  flexShrink: { flexShrink: 1 },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.bg,
  },
  content: {
    padding: theme.space(5),
    paddingBottom: theme.space(10),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.space(5),
  },
  greeting: {
    fontSize: theme.font.title,
    fontWeight: '800',
    color: theme.color.text,
    letterSpacing: -0.4,
  },
  date: {
    marginTop: 2,
    fontSize: theme.font.label,
    color: theme.color.textMuted,
    textTransform: 'capitalize',
  },
  logout: {
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2),
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.card,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  logoutText: {
    fontSize: theme.font.tiny,
    fontWeight: '700',
    color: theme.color.textMuted,
  },
  banner: {
    backgroundColor: theme.color.warnBg,
    borderRadius: theme.radius.sm,
    padding: theme.space(3),
    marginBottom: theme.space(4),
  },
  bannerText: {
    fontSize: theme.font.tiny,
    color: theme.color.warnText,
    fontWeight: '600',
  },
  scoreCard: {
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.space(6),
    paddingHorizontal: theme.space(5),
    alignItems: 'center',
    ...theme.shadow.card,
  },
  sectionEyebrow: {
    fontSize: theme.font.tiny,
    fontWeight: '800',
    color: theme.color.textFaint,
    letterSpacing: 1,
    marginBottom: theme.space(4),
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.space(5),
    alignSelf: 'stretch',
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.color.border,
  },
  statValue: {
    fontSize: theme.font.body + 2,
    fontWeight: '800',
    color: theme.color.text,
  },
  statLabel: {
    marginTop: 2,
    fontSize: theme.font.tiny,
    color: theme.color.textMuted,
    fontWeight: '600',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.space(7),
    marginBottom: theme.space(4),
  },
  sectionTitle: {
    fontSize: theme.font.body + 2,
    fontWeight: '800',
    color: theme.color.text,
  },
  sectionCount: {
    fontSize: theme.font.label,
    fontWeight: '700',
    color: theme.color.textFaint,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: theme.space(6),
  },
});
