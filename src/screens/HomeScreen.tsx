import React, { useCallback, useMemo, useState } from 'react';
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
import { StepPad } from '../components/StepPad';
import { WeeklyChart } from '../components/WeeklyChart';
import { useAuth } from '../context/AuthContext';
import { apiRequest, todayIso } from '../lib/api';
import { useCachedQuery } from '../lib/useCachedQuery';
import { tabularNums, theme } from '../theme';
import type { DailySummary, ModuleProgress, WeekDay } from '../types';

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
};

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

  const weekFetcher = useCallback(
    (signal: AbortSignal) =>
      apiRequest<WeekDay[]>(`/api/summary/week?days=7&date=${today}`, { token, signal }),
    [token, today],
  );

  const { data: week, refresh: refreshWeek } = useCachedQuery<WeekDay[]>(
    token ? `week:${today}` : null,
    weekFetcher,
  );

  const [quickAdd, setQuickAdd] = useState<ModuleProgress | null>(null);

  const openQuickAdd = useCallback((module: ModuleProgress) => {
    setQuickAdd((current) => (current?.key === module.key ? null : module));
  }, []);

  const quickChange = useCallback(
    async (delta: number, step: number) => {
      if (!quickAdd) return;

      // Optimistic so the pad feels the same as inside the module.
      setQuickAdd((prev) => {
        if (!prev) return prev;
        const value = Math.max(0, prev.value + delta);
        const ratio = prev.target ? Math.min(value / prev.target, 1) : 0;
        return { ...prev, value, ratio, completed: ratio >= 1 };
      });

      try {
        await apiRequest(
          `/api/entries/${quickAdd.key}/add?date=${today}&used_step=${step}`,
          { method: 'POST', body: { delta }, token },
        );
      } finally {
        // The score, the grid and the week all move with a single entry.
        await Promise.all([refresh(), refreshWeek()]);
      }
    },
    [quickAdd, refresh, refreshWeek, today, token],
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
        <View style={styles.banner} testID="home-error" accessibilityRole="alert">
          <Text style={styles.bannerText}>
            {fromCache || data ? `Çevrimdışı veriler gösteriliyor — ${error}` : error}
          </Text>
        </View>
      ) : null}

      {/* The ring already states the score; a second copy underneath only
          competed with it, so the card carries one number and one fact. */}
      <View style={styles.scoreCard} testID="score-card">
        <ScoreRing score={data?.score ?? 0} />
        <Text style={styles.scoreStat}>
          <Text style={styles.scoreStatValue}>
            {data?.completed_count ?? 0}/{data?.module_count ?? 0}
          </Text>{' '}
          tamamlandı
        </Text>
      </View>

      {week?.length ? <WeeklyChart days={week} /> : null}

      <Text style={styles.sectionTitle}>Uygulamalar</Text>

      <View style={styles.grid} testID="module-grid">
        {modules.map((module, index) => (
          <StaggeredItem key={module.key} index={index}>
            <ModuleTile
              module={module}
              onPress={onOpenModule}
              onLongPress={openQuickAdd}
              active={quickAdd?.key === module.key}
            />
          </StaggeredItem>
        ))}
      </View>

      {/* Long-press keeps the common case — log today's value — on the home
          screen instead of costing a round trip into the module and back. */}
      {quickAdd ? (
        <View style={styles.quickAdd} testID="quick-add">
          <View style={styles.quickHead}>
            <Text style={styles.quickTitle}>{quickAdd.title}</Text>
            <Pressable
              onPress={() => setQuickAdd(null)}
              testID="quick-add-close"
              accessibilityRole="button"
              accessibilityLabel="Hızlı kaydı kapat"
              style={styles.quickClose}
            >
              <Text style={styles.quickCloseText}>Kapat</Text>
            </Pressable>
          </View>
          <Text style={styles.quickValue} testID="quick-add-value">
            {quickAdd.value} / {quickAdd.target} {quickAdd.unit}
          </Text>
          <StepPad module={quickAdd} onChange={quickChange} compact />
        </View>
      ) : null}
    </ScrollView>
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
    fontWeight: '700',
    color: theme.color.text,
    letterSpacing: -0.4,
  },
  date: {
    marginTop: 2,
    fontSize: theme.font.label,
    color: theme.color.textMuted,
  },
  logout: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.space(4),
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.card,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  logoutText: {
    fontSize: theme.font.caption,
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
    fontSize: theme.font.caption,
    color: theme.color.warnText,
    fontWeight: '600',
  },
  scoreCard: {
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.space(6),
    paddingHorizontal: theme.space(5),
    alignItems: 'center',
  },
  scoreStat: {
    marginTop: theme.space(4),
    fontSize: theme.font.label,
    color: theme.color.textMuted,
  },
  scoreStatValue: {
    fontSize: theme.font.heading,
    fontWeight: '700',
    color: theme.color.text,
    ...tabularNums,
  },
  sectionTitle: {
    fontSize: theme.font.heading,
    fontWeight: '700',
    color: theme.color.text,
    marginTop: theme.space(7),
    marginBottom: theme.space(4),
  },
  quickAdd: {
    marginTop: theme.space(6),
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.lg,
    padding: theme.space(5),
  },
  quickHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickTitle: {
    fontSize: theme.font.heading,
    fontWeight: '700',
    color: theme.color.text,
  },
  quickClose: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.space(3),
  },
  quickCloseText: {
    fontSize: theme.font.label,
    fontWeight: '700',
    color: theme.color.accent,
  },
  quickValue: {
    marginTop: theme.space(1),
    fontSize: theme.font.label,
    color: theme.color.textMuted,
    ...tabularNums,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: theme.space(6),
  },
});
