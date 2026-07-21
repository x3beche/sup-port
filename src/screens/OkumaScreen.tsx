import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookCover } from '../components/okuma/BookCover';
import { BookDetailSheet } from '../components/okuma/BookDetailSheet';
import { BookSearchSheet } from '../components/okuma/BookSearchSheet';
import { SessionSheet } from '../components/okuma/SessionSheet';
import { Icon } from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { apiRequest, todayIso } from '../lib/api';
import { useBackHandler } from '../lib/backHandler';
import { useCachedQuery } from '../lib/useCachedQuery';
import { onColor, tabularNums, theme } from '../theme';
import type {
  BooksResponse,
  LibraryBook,
  ModuleProgress,
  OkumaMeta,
  ReadingGoal,
  ReadingInsight,
  ReadingStats,
  SessionsResponse,
  Shelf,
} from '../types';

const SHELF_ORDER: Shelf[] = ['reading', 'to_read', 'finished'];
const SHELF_LABELS: Record<Shelf, string> = {
  reading: 'Okuyorum',
  to_read: 'Okuyacağım',
  finished: 'Bitirdim',
};
const GOAL_PRESETS = [12, 24, 52];
const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function ProgressBar({ ratio, color, height = 10 }: { ratio: number; color: string; height?: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return (
    <View style={[styles.track, { height, borderRadius: height }]}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color, borderRadius: height }]} />
    </View>
  );
}

export function OkumaScreen({ module, onBack }: { module: ModuleProgress; onBack: () => void }) {
  const { token } = useAuth();
  const today = todayIso();
  const color = module.color;

  const { data: meta } = useCachedQuery<OkumaMeta>(
    token ? 'okuma-meta' : null,
    (signal) => apiRequest<OkumaMeta>('/api/okuma/meta', { token, signal }),
  );
  const { data: goal, refresh: refreshGoal } = useCachedQuery<ReadingGoal>(
    token ? 'okuma-goal' : null,
    (signal) => apiRequest<ReadingGoal>('/api/okuma/goal', { token, signal }),
  );
  const { data: booksData, refresh: refreshBooks } = useCachedQuery<BooksResponse>(
    token ? 'okuma-books' : null,
    (signal) => apiRequest<BooksResponse>('/api/okuma/books', { token, signal }),
  );
  const { data: sessions, refresh: refreshSessions } = useCachedQuery<SessionsResponse>(
    token ? `okuma-sess:${today}` : null,
    (signal) => apiRequest<SessionsResponse>(`/api/okuma/sessions?date=${today}`, { token, signal }),
  );
  const { data: stats, refresh: refreshStats } = useCachedQuery<ReadingStats>(
    token ? 'okuma-stats' : null,
    (signal) => apiRequest<ReadingStats>(`/api/okuma/stats?date=${today}`, { token, signal }),
  );
  const { data: insight, setData: setInsight, refresh: refreshInsight } = useCachedQuery<ReadingInsight>(
    token ? 'okuma-insight' : null,
    (signal) => apiRequest<ReadingInsight>(`/api/okuma/insight?date=${today}`, { token, signal }),
  );

  const [overlay, setOverlay] = useState<null | 'search' | 'session' | 'goal'>(null);
  const [selected, setSelected] = useState<LibraryBook | null>(null);
  const [activeShelf, setActiveShelf] = useState<Shelf>('reading');
  const [aiLoading, setAiLoading] = useState(false);
  const [goalDraft, setGoalDraft] = useState<number>(0);
  const [savingGoal, setSavingGoal] = useState(false);

  const books = booksData?.books ?? [];
  const shelfBooks = useMemo(() => books.filter((b) => b.shelf === activeShelf), [books, activeShelf]);
  const readingBooks = useMemo(() => books.filter((b) => b.shelf === 'reading'), [books]);
  const counts = booksData?.counts ?? { reading: 0, to_read: 0, finished: 0 };

  const refreshAfterBook = useCallback(() => {
    void refreshBooks();
    void refreshGoal();
    void refreshStats();
    void refreshInsight();
  }, [refreshBooks, refreshGoal, refreshInsight, refreshStats]);

  const refreshAfterSession = useCallback(() => {
    void refreshSessions();
    void refreshStats();
    void refreshInsight();
  }, [refreshInsight, refreshSessions, refreshStats]);

  const getAi = useCallback(async () => {
    setAiLoading(true);
    try {
      const fresh = await apiRequest<ReadingInsight>(`/api/okuma/insight?llm=true&date=${today}`, { token });
      setInsight(() => fresh);
    } finally {
      setAiLoading(false);
    }
  }, [setInsight, today, token]);

  const openGoalEditor = useCallback(() => {
    setGoalDraft(goal?.target_books ?? meta?.default_target_books ?? 12);
    setOverlay('goal');
  }, [goal?.target_books, meta?.default_target_books]);

  const saveGoal = useCallback(async () => {
    setSavingGoal(true);
    try {
      await apiRequest('/api/okuma/goal', { method: 'PUT', token, body: { target_books: goalDraft } });
      await refreshGoal();
      void refreshInsight();
      setOverlay(null);
    } finally {
      setSavingGoal(false);
    }
  }, [goalDraft, refreshGoal, refreshInsight, token]);

  useBackHandler(() => {
    if (selected) {
      setSelected(null);
      return true;
    }
    if (overlay) {
      setOverlay(null);
      return true;
    }
    onBack();
    return true;
  });

  const todayMin = sessions?.total_min ?? 0;
  const todayRatio = module.target ? Math.min(todayMin / module.target, 1) : 0;
  const monthlyMax = Math.max(1, ...(stats?.monthly ?? []).map((m) => m.minutes));

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} testID="okuma-screen" showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={onBack} testID="back" style={styles.back} accessibilityRole="button" accessibilityLabel="Geri">
            <Icon name="chevron-left" size={22} strokeWidth={2} color={theme.color.text} />
          </Pressable>
          <Text style={styles.topTitle}>{module.title}</Text>
          <View style={styles.back} />
        </View>

        {/* Yıllık hedef (challenge) — ilerleme çubuğu merkezde */}
        <View style={styles.card} testID="okuma-goal">
          <View style={styles.goalHead}>
            <View>
              <Text style={styles.goalYear}>{goal?.year ?? new Date().getFullYear()} okuma hedefi</Text>
              <Text style={styles.goalCount}>
                <Text style={{ color }}>{goal?.completed_books ?? 0}</Text>
                <Text style={styles.goalTarget}> / {goal?.target_books ?? 12} kitap</Text>
              </Text>
            </View>
            <Pressable onPress={openGoalEditor} testID="goal-edit" accessibilityRole="button" style={[styles.smallBtn, { backgroundColor: `${color}26` }]}>
              <Text style={[styles.smallBtnText, { color }]}>Düzenle</Text>
            </Pressable>
          </View>
          <ProgressBar ratio={goal?.ratio ?? 0} color={color} />
          <Text style={styles.goalNote}>
            {goal && goal.completed_books >= goal.target_books
              ? 'Hedefini tamamladın! 🎉'
              : `Hedefe ${Math.max((goal?.target_books ?? 12) - (goal?.completed_books ?? 0), 0)} kitap kaldı.`}
          </Text>
        </View>

        {/* Bugün okuma */}
        <View style={[styles.card, styles.todayCard]} testID="okuma-today">
          <View style={styles.todayLeft}>
            <Text style={styles.todayValue}>
              {todayMin} <Text style={styles.todayUnit}>/ {module.target} dk</Text>
            </Text>
            <Text style={styles.todaySub}>bugün okudun{sessions && sessions.total_pages > 0 ? ` · ${sessions.total_pages} sayfa` : ''}</Text>
            <View style={styles.todayBar}>
              <ProgressBar ratio={todayRatio} color={color} height={6} />
            </View>
          </View>
          <Pressable onPress={() => setOverlay('session')} testID="open-session" accessibilityRole="button" style={[styles.logBtn, { backgroundColor: color }]}>
            <Icon name="plus" size={18} strokeWidth={2.4} color={onColor(color)} />
            <Text style={[styles.logBtnText, { color: onColor(color) }]}>Kaydet</Text>
          </Pressable>
        </View>

        {/* İçgörü / öneri */}
        {insight ? (
          <View style={styles.card} testID="okuma-insight">
            <Text style={styles.insightHead}>{insight.summary ?? insight.headline}</Text>
            {insight.notes?.map((n, i) => (
              <Text key={i} style={styles.insightNote}>• {n}</Text>
            ))}
            {!insight.summary ? (
              <Pressable onPress={getAi} disabled={aiLoading} testID="insight-ai" accessibilityRole="button" style={[styles.aiBtn, { borderColor: color }]}>
                <Text style={[styles.aiBtnText, { color }]}>{aiLoading ? 'Hazırlanıyor…' : 'Yapay zekâ ile kişisel özet'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Raflar */}
        <Text style={styles.sectionTitle}>Kütüphanem</Text>
        <View style={styles.tabs}>
          {SHELF_ORDER.map((s) => {
            const active = activeShelf === s;
            return (
              <Pressable
                key={s}
                onPress={() => setActiveShelf(s)}
                testID={`shelf-${s}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.tab, active && { borderBottomColor: color }]}
              >
                <Text style={[styles.tabText, active && { color: theme.color.text }]}>
                  {SHELF_LABELS[s]} {counts[s] > 0 ? `(${counts[s]})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {shelfBooks.length === 0 ? (
          <Pressable onPress={() => setOverlay('search')} style={styles.emptyShelf} testID="empty-shelf" accessibilityRole="button">
            <Icon name="book" size={28} color={theme.color.textMuted} />
            <Text style={styles.emptyTitle}>Bu raf boş</Text>
            <Text style={styles.emptyText}>Kitap ekleyerek kütüphaneni oluşturmaya başla.</Text>
          </Pressable>
        ) : (
          <View style={styles.grid}>
            {shelfBooks.map((b) => (
              <Pressable key={b.book_key} onPress={() => setSelected(b)} testID={`book-${b.book_key}`} accessibilityRole="button" style={styles.gridItem}>
                <BookCover url={b.cover_url} title={b.title} color={color} width={92} />
                <Text style={styles.gridTitle} numberOfLines={2}>{b.title}</Text>
                <Text style={styles.gridAuthor} numberOfLines={1}>{b.authors[0] ?? ''}</Text>
                {b.shelf === 'finished' && b.rating ? (
                  <View style={styles.gridStars}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Icon key={n} name={n <= (b.rating ?? 0) ? 'star-filled' : 'star'} size={11} color={n <= (b.rating ?? 0) ? color : theme.color.textFaint} />
                    ))}
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}

        {/* İstatistik */}
        {stats && (stats.finished_count > 0 || stats.total_minutes > 0) ? (
          <>
            <Text style={styles.sectionTitle}>İstatistik</Text>
            <View style={styles.card}>
              <View style={styles.statRow}>
                <Stat value={stats.finished_count} label="bitirilen" color={color} />
                <Stat value={stats.total_pages} label="sayfa" color={color} />
                <Stat value={stats.total_minutes} label="dakika" color={color} />
                <Stat value={stats.streak} label="gün seri" color={color} />
              </View>

              {stats.monthly.some((m) => m.minutes > 0) ? (
                <>
                  <Text style={styles.statSub}>Aylık ritim (dk)</Text>
                  <View style={styles.monthChart}>
                    {stats.monthly.map((m) => {
                      const h = Math.max(4, (m.minutes / monthlyMax) * 60);
                      const mi = parseInt(m.month.slice(5), 10) - 1;
                      return (
                        <View key={m.month} style={styles.monthCol}>
                          <View style={styles.monthTrack}>
                            <View style={[styles.monthBar, { height: h, backgroundColor: m.minutes > 0 ? color : theme.color.border }]} />
                          </View>
                          <Text style={styles.monthLabel}>{MONTH_SHORT[mi] ?? ''}</Text>
                        </View>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {stats.top_authors.length ? (
                <Text style={styles.topAuthor}>
                  En çok okuduğun yazar: <Text style={{ color, fontWeight: '800' }}>{stats.top_authors[0].name}</Text>
                  {stats.avg_rating ? `  ·  ort. puan ${stats.avg_rating}★` : ''}
                </Text>
              ) : null}
            </View>
          </>
        ) : null}

        {/* Kitap ekle */}
        <Pressable onPress={() => setOverlay('search')} testID="open-search" accessibilityRole="button" style={[styles.addBar, { backgroundColor: color }]}>
          <Icon name="plus" size={20} strokeWidth={2.2} color={onColor(color)} />
          <Text style={[styles.addBarText, { color: onColor(color) }]}>Kitap ekle · ara ya da barkod tara</Text>
        </Pressable>

        {meta ? (
          <Text style={styles.attribution}>{meta.cover_attribution}</Text>
        ) : null}
      </ScrollView>

      {overlay === 'search' ? (
        <BookSearchSheet color={color} token={token} onClose={() => setOverlay(null)} onAdded={refreshAfterBook} />
      ) : null}
      {overlay === 'session' ? (
        <SessionSheet color={color} token={token} readingBooks={readingBooks} onClose={() => setOverlay(null)} onSaved={refreshAfterSession} />
      ) : null}
      {selected ? (
        <BookDetailSheet
          book={selected}
          color={color}
          token={token}
          onClose={() => setSelected(null)}
          onChanged={refreshAfterBook}
        />
      ) : null}

      {overlay === 'goal' ? (
        <Pressable style={styles.goalBackdrop} testID="goal-editor" onPress={() => setOverlay(null)} accessibilityRole="button" accessibilityLabel="Kapat">
          <Pressable style={styles.goalModal} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.goalModalTitle}>Yıllık hedef</Text>
            <Text style={styles.goalModalSub}>Ulaşılabilir bir hedef, motivasyonu korur. İstediğin zaman değiştirebilirsin.</Text>
            <View style={styles.stepper}>
              <Pressable onPress={() => setGoalDraft((v) => Math.max(1, v - 1))} accessibilityRole="button" style={styles.stepBtn}>
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
              <Text style={styles.stepValue}>{goalDraft}</Text>
              <Pressable onPress={() => setGoalDraft((v) => Math.min(1000, v + 1))} accessibilityRole="button" style={styles.stepBtn}>
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>
            <View style={styles.presets}>
              {GOAL_PRESETS.map((p) => (
                <Pressable key={p} onPress={() => setGoalDraft(p)} accessibilityRole="button" style={[styles.preset, goalDraft === p ? { backgroundColor: color, borderColor: color } : { borderColor: theme.color.border }]}>
                  <Text style={[styles.presetText, goalDraft === p && { color: onColor(color) }]}>{p}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={saveGoal} disabled={savingGoal} testID="goal-save" accessibilityRole="button" style={[styles.goalSave, { backgroundColor: color }]}>
              <Text style={[styles.goalSaveText, { color: onColor(color) }]}>{savingGoal ? 'Kaydediliyor…' : 'Kaydet'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space(5), paddingBottom: theme.space(10) },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.space(4) },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.pill },
  topTitle: { fontSize: theme.font.body + 1, fontWeight: '800', color: theme.color.text },
  card: { backgroundColor: theme.color.card, borderRadius: theme.radius.lg, padding: theme.space(5), marginBottom: theme.space(3) },
  track: { backgroundColor: theme.color.track, overflow: 'hidden', width: '100%' },
  fill: { height: '100%' },
  goalHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: theme.space(4) },
  goalYear: { fontSize: theme.font.label, color: theme.color.textMuted, fontWeight: '600' },
  goalCount: { marginTop: theme.space(1), fontSize: theme.font.display, fontWeight: '800', ...tabularNums },
  goalTarget: { fontSize: theme.font.heading, fontWeight: '700', color: theme.color.textMuted },
  goalNote: { marginTop: theme.space(3), fontSize: theme.font.caption, color: theme.color.textMuted },
  smallBtn: { minHeight: 34, paddingHorizontal: theme.space(3), borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { fontSize: theme.font.label, fontWeight: '700' },
  todayCard: { flexDirection: 'row', alignItems: 'center', gap: theme.space(4) },
  todayLeft: { flex: 1 },
  todayValue: { fontSize: theme.font.title, fontWeight: '800', color: theme.color.text, ...tabularNums },
  todayUnit: { fontSize: theme.font.body, fontWeight: '600', color: theme.color.textMuted },
  todaySub: { marginTop: 2, fontSize: theme.font.caption, color: theme.color.textMuted },
  todayBar: { marginTop: theme.space(3) },
  logBtn: { flexDirection: 'row', alignItems: 'center', gap: theme.space(1), minHeight: 44, paddingHorizontal: theme.space(4), borderRadius: theme.radius.md },
  logBtnText: { fontSize: theme.font.label, fontWeight: '800' },
  insightHead: { fontSize: theme.font.body, color: theme.color.text, lineHeight: 22, fontWeight: '600' },
  insightNote: { marginTop: theme.space(2), fontSize: theme.font.caption, color: theme.color.textMuted, lineHeight: 18 },
  aiBtn: { marginTop: theme.space(4), minHeight: 44, borderRadius: theme.radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  aiBtnText: { fontSize: theme.font.label, fontWeight: '800' },
  sectionTitle: { fontSize: theme.font.body + 2, fontWeight: '800', color: theme.color.text, marginTop: theme.space(5), marginBottom: theme.space(3) },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.color.border, marginBottom: theme.space(4) },
  tab: { flex: 1, alignItems: 'center', paddingVertical: theme.space(3), borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.textMuted },
  emptyShelf: { backgroundColor: theme.color.card, borderRadius: theme.radius.lg, padding: theme.space(7), alignItems: 'center', gap: theme.space(2) },
  emptyTitle: { fontSize: theme.font.body, fontWeight: '700', color: theme.color.text, marginTop: theme.space(2) },
  emptyText: { fontSize: theme.font.label, color: theme.color.textMuted, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(4) },
  gridItem: { width: 92 },
  gridTitle: { marginTop: theme.space(2), fontSize: theme.font.caption, fontWeight: '700', color: theme.color.text, lineHeight: 15 },
  gridAuthor: { marginTop: 1, fontSize: theme.font.tiny, color: theme.color.textMuted },
  gridStars: { flexDirection: 'row', gap: 1, marginTop: 2 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: theme.font.title, fontWeight: '800', ...tabularNums },
  statLabel: { marginTop: 2, fontSize: theme.font.tiny, color: theme.color.textMuted },
  statSub: { marginTop: theme.space(5), marginBottom: theme.space(2), fontSize: theme.font.caption, color: theme.color.textMuted, fontWeight: '600' },
  monthChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 78 },
  monthCol: { alignItems: 'center', flex: 1 },
  monthTrack: { height: 60, justifyContent: 'flex-end' },
  monthBar: { width: 14, borderRadius: theme.radius.pill },
  monthLabel: { marginTop: theme.space(2), fontSize: theme.font.tiny, color: theme.color.textMuted },
  topAuthor: { marginTop: theme.space(4), fontSize: theme.font.label, color: theme.color.textMuted },
  addBar: { marginTop: theme.space(4), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.space(2), minHeight: 54, borderRadius: theme.radius.md },
  addBarText: { fontSize: theme.font.body, fontWeight: '800' },
  attribution: { marginTop: theme.space(5), fontSize: theme.font.tiny, color: theme.color.textFaint, textAlign: 'center' },
  goalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: theme.space(6), zIndex: 60 },
  goalModal: { width: '100%', maxWidth: 340, backgroundColor: theme.color.cardRaised, borderRadius: theme.radius.lg, padding: theme.space(5) },
  goalModalTitle: { fontSize: theme.font.heading, fontWeight: '800', color: theme.color.text },
  goalModalSub: { marginTop: theme.space(2), fontSize: theme.font.caption, color: theme.color.textMuted, lineHeight: 18 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.space(5), marginTop: theme.space(5) },
  stepBtn: { width: 52, height: 52, borderRadius: theme.radius.md, backgroundColor: theme.color.card, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 26, fontWeight: '700', color: theme.color.text },
  stepValue: { fontSize: theme.font.hero, fontWeight: '800', color: theme.color.text, minWidth: 90, textAlign: 'center', ...tabularNums },
  presets: { flexDirection: 'row', justifyContent: 'center', gap: theme.space(2), marginTop: theme.space(4) },
  preset: { paddingHorizontal: theme.space(4), minHeight: 40, justifyContent: 'center', borderRadius: theme.radius.pill, borderWidth: 1 },
  presetText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.text },
  goalSave: { marginTop: theme.space(5), minHeight: 50, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  goalSaveText: { fontSize: theme.font.body, fontWeight: '800' },
});
