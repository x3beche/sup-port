import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BrushTimer } from '../components/BrushTimer';
import { Confetti } from '../components/Confetti';
import { Icon, type IconName } from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { apiRequest, todayIso } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useCachedQuery } from '../lib/useCachedQuery';
import { onColor, tabularNums, theme } from '../theme';
import type { BrushSlot, BrushStatus, ModuleProgress } from '../types';

const WEEKDAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
// Sabahtan öğleden sonraya geçiş: bu saatten sonra "başla" akşam yuvasına gider.
const EVENING_FROM_HOUR = 15;

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00`).getTime();
  const b = new Date(`${toIso}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Son 7 günün her biri için tamamlanma sayısı (0/1/2) — nokta şeridi için. */
type DayDot = { date: string; value: number };

export function BrushScreen({
  module,
  onBack,
}: {
  module: ModuleProgress;
  onBack: () => void;
}) {
  const { token } = useAuth();
  const today = todayIso();
  const color = module.color;

  const statusFetcher = useCallback(
    (signal: AbortSignal) =>
      apiRequest<BrushStatus>(`/api/brush/status?date=${today}`, { token, signal }),
    [today, token],
  );
  const { data: status, setData: setStatus, refresh } = useCachedQuery<BrushStatus>(
    token ? `brush:${today}` : null,
    statusFetcher,
  );

  // 7 günlük geçmiş: entries üzerinden brush değeri (0/1/2).
  const historyFetcher = useCallback(
    (signal: AbortSignal) =>
      apiRequest<Array<{ date: string; value: number }>>(
        `/api/history/brush?days=7&date=${today}`,
        { token, signal },
      ),
    [today, token],
  );
  const { data: history, refresh: refreshHistory } = useCachedQuery<DayDot[]>(
    token ? `brush-hist:${today}` : null,
    historyFetcher,
  );

  const [error, setError] = useState<string | null>(null);
  const [timerOpen, setTimerOpen] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [milestone, setMilestone] = useState<number | null>(null);
  const busy = useRef(false);

  const applyStatus = useCallback(
    (next: BrushStatus) => {
      setStatus(() => next);
      if (next.milestone) {
        setMilestone(next.milestone);
        haptics.milestone();
        setConfetti((c) => c + 1);
      } else if (next.just_completed) {
        haptics.success();
        setConfetti((c) => c + 1);
      }
    },
    [setStatus],
  );

  const setSlot = useCallback(
    async (slot: BrushSlot, done: boolean) => {
      if (busy.current || !token) return;
      busy.current = true;
      setError(null);
      if (done) haptics.slot();
      try {
        const next = await apiRequest<BrushStatus>(`/api/brush/slot?date=${today}`, {
          method: 'PUT',
          body: { slot, done },
          token,
        });
        applyStatus(next);
        // Entries de değişti; geçmiş şeridini tazele.
        void refreshHistory();
      } catch (err) {
        setError((err as Error)?.message ?? 'Kaydedilemedi');
        void refresh();
      } finally {
        busy.current = false;
      }
    },
    [applyStatus, refresh, refreshHistory, today, token],
  );

  const toggleSlot = useCallback(
    (slot: BrushSlot) => {
      if (!status) return;
      setSlot(slot, !status[slot]);
    },
    [setSlot, status],
  );

  // Sayaç bitince işaretlenecek yuva: açık olan, gün saatine göre tercihli.
  const finishTimer = useCallback(() => {
    setTimerOpen(false);
    if (!status) return;
    let slot: BrushSlot | null = null;
    if (!status.morning && !status.evening) {
      slot = new Date().getHours() < EVENING_FROM_HOUR ? 'morning' : 'evening';
    } else if (!status.morning) {
      slot = 'morning';
    } else if (!status.evening) {
      slot = 'evening';
    }
    if (slot) setSlot(slot, true);
  }, [setSlot, status]);

  const streak = status?.streak ?? 0;
  const best = status?.best_streak ?? 0;
  const next = status?.next_milestone ?? null;
  const remainingToMilestone = next ? next - streak : null;

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        testID="brush-screen"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable onPress={onBack} testID="back" style={styles.back} accessibilityRole="button" accessibilityLabel="Geri">
            <Icon name="chevron-left" size={22} strokeWidth={2} color={theme.color.text} />
          </Pressable>
          <Text style={styles.topTitle}>{module.title}</Text>
          <View style={styles.back} />
        </View>

        {/* Seri kartı */}
        <View style={styles.card}>
          <View style={styles.streakRow}>
            <View style={[styles.flameWrap, { backgroundColor: streak > 0 ? `${color}26` : theme.color.track }]}>
              <Icon name="flame" size={30} color={streak > 0 ? color : theme.color.textFaint} />
            </View>
            <View style={styles.streakText}>
              <Text style={styles.streakNumber} testID="brush-streak">
                {streak}
                <Text style={styles.streakUnit}> gün seri</Text>
              </Text>
              <Text style={styles.streakSub}>
                {streak === 0
                  ? 'Bugün fırçala, seriyi başlat'
                  : remainingToMilestone
                    ? `Sonraki hedefe ${remainingToMilestone} gün · en iyi ${best}`
                    : `En iyi ${best} gün`}
              </Text>
            </View>
          </View>
        </View>

        {/* Yuvalar */}
        <Text style={styles.sectionTitle}>Bugün</Text>
        <View style={styles.slots}>
          <SlotButton
            label="Sabah"
            icon="droplet"
            emoji="☀️"
            color={color}
            done={!!status?.morning}
            onPress={() => toggleSlot('morning')}
            testID="brush-slot-morning"
          />
          <SlotButton
            label="Akşam"
            icon="moon"
            emoji="🌙"
            color={color}
            done={!!status?.evening}
            onPress={() => toggleSlot('evening')}
            testID="brush-slot-evening"
          />
        </View>

        {status?.complete ? (
          <View style={[styles.doneBanner, { backgroundColor: `${color}1F` }]} testID="brush-complete-banner">
            <Icon name="check" size={18} strokeWidth={2.4} color={color} />
            <Text style={[styles.doneText, { color }]}>Bugün tamamlandı — harikasın!</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => setTimerOpen(true)}
          testID="brush-start"
          accessibilityRole="button"
          style={({ pressed }) => [styles.startButton, { backgroundColor: color }, pressed && styles.pressed]}
        >
          <Icon name="brush" size={20} color={onColor(color)} />
          <Text style={[styles.startText, { color: onColor(color) }]}>Fırçalamaya başla · 2 dk</Text>
        </Pressable>

        {error ? (
          <Text style={styles.error} testID="brush-error">
            {error}
          </Text>
        ) : null}

        {/* Son 7 gün */}
        <Text style={styles.sectionTitle}>Son 7 gün</Text>
        <View style={styles.card}>
          <View style={styles.dotsRow} testID="brush-history">
            {(history ?? []).map((point) => {
              const weekday = WEEKDAYS[new Date(`${point.date}T00:00:00`).getDay()];
              const full = point.value >= 2;
              const half = point.value === 1;
              return (
                <View key={point.date} style={styles.dotColumn}>
                  <View
                    style={[
                      styles.dot,
                      { borderColor: full || half ? color : theme.color.border },
                      full && { backgroundColor: color },
                      half && { backgroundColor: `${color}66` },
                    ]}
                  >
                    {full ? <Icon name="check" size={14} strokeWidth={2.6} color={onColor(color)} /> : null}
                  </View>
                  <Text style={styles.dotLabel}>{weekday}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Kutlama konfetisi — hem seri kilometre taşı hem günü tamamlama. */}
      <Confetti trigger={confetti} onDone={() => setMilestone(null)} />
      {milestone ? (
        <View style={styles.milestoneToast} pointerEvents="none" testID="brush-milestone">
          <Text style={styles.milestoneText}>🔥 {milestone} günlük seri!</Text>
        </View>
      ) : null}

      {timerOpen ? <BrushTimer color={color} onComplete={finishTimer} onCancel={() => setTimerOpen(false)} /> : null}
    </View>
  );
}

function SlotButton({
  label,
  emoji,
  icon,
  color,
  done,
  onPress,
  testID,
}: {
  label: string;
  emoji: string;
  icon: IconName;
  color: string;
  done: boolean;
  onPress: () => void;
  testID: string;
}) {
  // İşaretlenince onay ikonunun hafif "pop"u — abartısız (jüri ilkesi).
  const pop = useRef(new Animated.Value(done ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(pop, {
      toValue: done ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 140,
    }).start();
  }, [done, pop]);
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ checked: done }}
      accessibilityLabel={`${label} fırçalama ${done ? 'yapıldı' : 'yapılmadı'}`}
      style={({ pressed }) => [
        styles.slot,
        done ? { backgroundColor: color, borderColor: color } : { borderColor: theme.color.border },
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.slotEmoji}>{emoji}</Text>
      <Text style={[styles.slotLabel, done && { color: onColor(color) }]}>{label}</Text>
      <Animated.View style={[styles.slotCheck, { opacity: pop, transform: [{ scale }] }]}>
        {done ? (
          <Icon name="check" size={20} strokeWidth={2.6} color={onColor(color)} />
        ) : (
          <View style={styles.slotEmptyRing} />
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space(5), paddingBottom: theme.space(10) },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.space(4),
  },
  back: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
  },
  topTitle: { fontSize: theme.font.body + 1, fontWeight: '800', color: theme.color.text },
  card: {
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.lg,
    padding: theme.space(5),
  },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space(4) },
  flameWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakText: { flex: 1 },
  streakNumber: {
    fontSize: theme.font.display,
    fontWeight: '800',
    color: theme.color.text,
    ...tabularNums,
  },
  streakUnit: { fontSize: theme.font.body, fontWeight: '600', color: theme.color.textMuted },
  streakSub: { marginTop: 2, fontSize: theme.font.label, color: theme.color.textMuted },
  sectionTitle: {
    fontSize: theme.font.body + 2,
    fontWeight: '800',
    color: theme.color.text,
    marginTop: theme.space(7),
    marginBottom: theme.space(4),
  },
  slots: { flexDirection: 'row', gap: theme.space(3) },
  slot: {
    flex: 1,
    minHeight: 132,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    backgroundColor: theme.color.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(2),
    paddingVertical: theme.space(4),
  },
  slotEmoji: { fontSize: 30 },
  slotLabel: { fontSize: theme.font.heading, fontWeight: '800', color: theme.color.text },
  slotCheck: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  slotEmptyRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: theme.color.border,
  },
  doneBanner: {
    marginTop: theme.space(4),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(2),
    borderRadius: theme.radius.md,
    paddingVertical: theme.space(3),
  },
  doneText: { fontSize: theme.font.body, fontWeight: '800' },
  startButton: {
    marginTop: theme.space(5),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(2),
    minHeight: 54,
    borderRadius: theme.radius.md,
  },
  startText: { fontSize: theme.font.body, fontWeight: '800' },
  pressed: { opacity: 0.85 },
  error: {
    marginTop: theme.space(3),
    fontSize: theme.font.label,
    color: theme.color.danger,
    fontWeight: '600',
    textAlign: 'center',
  },
  dotsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dotColumn: { alignItems: 'center', flex: 1, gap: theme.space(2) },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotLabel: { fontSize: theme.font.tiny, color: theme.color.textMuted, fontWeight: '600' },
  milestoneToast: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    backgroundColor: theme.color.cardRaised,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space(5),
    paddingVertical: theme.space(3),
    zIndex: 25,
  },
  milestoneText: { fontSize: theme.font.heading, fontWeight: '800', color: theme.color.text },
});
