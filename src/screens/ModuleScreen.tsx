import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../components/Icon';
import { ScoreRing } from '../components/ScoreRing';
import { StepPad } from '../components/StepPad';
import { TargetEditor } from '../components/TargetEditor';
import { useAuth } from '../context/AuthContext';
import { apiRequest, todayIso } from '../lib/api';
import { useCachedQuery } from '../lib/useCachedQuery';
import { onColor, tabularNums, theme } from '../theme';
import type { HistoryPoint, ModuleProgress } from '../types';

const HISTORY_DAYS = 7;
// Long enough to swallow a burst of taps, short enough that leaving the screen
// right after tapping still feels immediate.
const FLUSH_DELAY_MS = 300;
const WEEKDAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

const NUMBER_FORMAT = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });

// 8000 yerine 8.000: büyük hedeflerde basamak saymak gerekmesin.
function formatValue(value: number): string {
  return NUMBER_FORMAT.format(value);
}

export function ModuleScreen({
  module: initial,
  onBack,
}: {
  module: ModuleProgress;
  onBack: () => void;
}) {
  const { token } = useAuth();
  const today = todayIso();
  const [module, setModule] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      apiRequest<HistoryPoint[]>(
        `/api/history/${initial.key}?days=${HISTORY_DAYS}&date=${today}`,
        { token, signal },
      ),
    [initial.key, today, token],
  );

  const { data: history, setData: setHistory } = useCachedQuery<HistoryPoint[]>(
    token ? `history:${initial.key}:${today}` : null,
    fetcher,
  );

  const applyValue = useCallback(
    (value: number) => {
      setModule((prev) => {
        const ratio = prev.target ? Math.min(value / prev.target, 1) : 0;
        return { ...prev, value, ratio, completed: ratio >= 1 };
      });
      setHistory((current) =>
        current
          ? current.map((point) => (point.date === today ? { ...point, value } : point))
          : current,
      );
    },
    [setHistory, today],
  );

  const applyTarget = useCallback(
    (target: number, isCustom: boolean) => {
      setModule((prev) => {
        const ratio = target ? Math.min(prev.value / target, 1) : 0;
        return { ...prev, target, is_custom_target: isCustom, ratio, completed: ratio >= 1 };
      });
      // The chart's "reached" threshold is the target, so it has to move too.
      setHistory((current) =>
        current ? current.map((point) => ({ ...point, target })) : current,
      );
    },
    [setHistory],
  );

  const saveTarget = useCallback(
    async (target: number) => {
      const result = await apiRequest<{ target: number; is_custom: boolean }>(
        `/api/targets/${module.key}`,
        { method: 'PUT', body: { target }, token },
      );
      applyTarget(result.target, result.is_custom);
    },
    [applyTarget, module.key, token],
  );

  const resetTarget = useCallback(async () => {
    const result = await apiRequest<{ target: number; is_custom: boolean }>(
      `/api/targets/${module.key}`,
      { method: 'DELETE', token },
    );
    applyTarget(result.target, result.is_custom);
  }, [applyTarget, module.key, token]);

  /*
   * Taps arrive faster than the round trip. Dropping the ones that land while a
   * request is in flight silently loses data, so they accumulate here and flush
   * as one request when the user stops tapping. `shown` is the source of truth
   * for the optimistic value — reading it from state would lag behind a burst.
   */
  const shown = useRef(initial.value);
  const pendingDelta = useRef(0);
  const committed = useRef(initial.value);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const delta = pendingDelta.current;
    if (delta === 0) return;
    pendingDelta.current = 0;

    const rollbackTo = committed.current;
    setBusy(true);
    try {
      const step = usedStep.current;
      const query = step === null ? '' : `&used_step=${step}`;
      const result = await apiRequest<{ value: number }>(
        `/api/entries/${module.key}/add?date=${today}${query}`,
        // keepalive: a reload inside the debounce window used to drop the whole
        // burst; the request now outlives the page.
        { method: 'POST', body: { delta }, token, keepalive: true },
      );
      committed.current = result.value;
      // More taps landed during the request, so the screen is already ahead of
      // this response; let the next flush reconcile instead of snapping back.
      if (pendingDelta.current === 0) {
        shown.current = result.value;
        applyValue(result.value);
      }
    } catch (err) {
      pendingDelta.current = 0;
      shown.current = rollbackTo;
      applyValue(rollbackTo);
      setError((err as Error)?.message ?? 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }, [applyValue, module.key, today, token]);

  const usedStep = useRef<number | null>(null);

  const change = useCallback(
    (delta: number, step?: number) => {
      setError(null);
      if (step !== undefined) usedStep.current = step;

      const next = Math.max(0, shown.current + delta);
      // Clamping at zero means the queued delta must match what the user sees,
      // otherwise the server would drift below the displayed value.
      pendingDelta.current += next - shown.current;
      shown.current = next;
      applyValue(next);

      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => {
        flushTimer.current = null;
        void flush();
      }, FLUSH_DELAY_MS);
    },
    [applyValue, flush],
  );

  const flushNow = useCallback(async () => {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    await flush();
  }, [flush]);

  // Leaving the screen inside the debounce window used to drop the write, and
  // the home screen then refetched the stale value. Send it before navigating.
  const handleBack = useCallback(async () => {
    await flushNow();
    onBack();
  }, [flushNow, onBack]);

  // A reload or tab switch inside the window would lose it just the same.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flushNow();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [flushNow]);

  useEffect(
    () => () => {
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        void flush();
      }
    },
    [flush],
  );

  const percent = Math.round(module.ratio * 100);
  const maxValue = Math.max(module.target, ...(history ?? []).map((p) => p.value), 1);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      testID={`module-screen-${module.key}`}
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          testID="back"
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Geri"
        >
          <Icon name="chevron-left" size={22} strokeWidth={2} color={theme.color.text} />
        </Pressable>
        <Text style={styles.topTitle}>{module.title}</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.card}>
        <View style={[styles.icon, { backgroundColor: `${module.color}26` }]}>
          <Icon name={module.icon as IconName} size={26} color={module.color} />
        </View>
        <Text style={styles.description}>{module.description}</Text>

        <View style={styles.ringWrap}>
          <ScoreRing score={percent} size={150} strokeWidth={12} color={module.color} />
        </View>

        <Text
          style={[styles.value, module.completed && { color: module.color }]}
          testID="module-value"
        >
          {formatValue(module.value)}
          <Text style={styles.valueTarget}>
            {' '}
            / {formatValue(module.target)} {module.unit}
          </Text>
        </Text>

        <StepPad module={module} onChange={change} />

        {error ? (
          <Text style={styles.error} testID="module-error">
            {error}
          </Text>
        ) : null}

        <TargetEditor module={module} onSave={saveTarget} onReset={resetTarget} />
      </View>

      <Text style={styles.sectionTitle}>Son {HISTORY_DAYS} gün</Text>
      <View style={styles.card}>
        <View style={styles.chart} testID="history-chart">
          {(history ?? []).map((point) => {
            const height = Math.max(4, (point.value / maxValue) * 100);
            const reached = point.value >= point.target;
            const weekday = WEEKDAYS[new Date(`${point.date}T00:00:00`).getDay()];
            return (
              <View key={point.date} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${height}%`,
                        backgroundColor: reached ? module.color : `${module.color}A6`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{weekday}</Text>
              </View>
            );
          })}
        </View>
      </View>
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
    marginBottom: theme.space(4),
  },
  back: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
  },
  topTitle: {
    fontSize: theme.font.body + 1,
    fontWeight: '800',
    color: theme.color.text,
  },
  card: {
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.lg,
    padding: theme.space(5),
    alignItems: 'center',
      },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    marginTop: theme.space(2),
    fontSize: theme.font.label,
    color: theme.color.textMuted,
    textAlign: 'center',
  },
  ringWrap: { marginTop: theme.space(4) },
  value: {
    marginTop: theme.space(4),
    fontSize: theme.font.display,
    fontWeight: '800',
    color: theme.color.text,
    ...tabularNums,
  },
  valueTarget: {
    fontSize: theme.font.body,
    fontWeight: '600',
    color: theme.color.textMuted,
  },
  error: {
    marginTop: theme.space(3),
    fontSize: theme.font.label,
    color: theme.color.danger,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: theme.font.body + 2,
    fontWeight: '800',
    color: theme.color.text,
    marginTop: theme.space(7),
    marginBottom: theme.space(4),
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    height: 130,
  },
  barColumn: { alignItems: 'center', flex: 1 },
  barTrack: {
    height: 100,
    width: 12,
    justifyContent: 'flex-end',
    // A filled track behind every bar drowned the single bar that carries data.
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  bar: { width: '100%', borderRadius: theme.radius.pill },
  barLabel: {
    marginTop: theme.space(2),
    fontSize: theme.font.tiny,
    color: theme.color.textMuted,
    fontWeight: '600',
  },
});
