import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScoreRing } from '../components/ScoreRing';
import { useAuth } from '../context/AuthContext';
import { apiRequest, todayIso } from '../lib/api';
import { useCachedQuery } from '../lib/useCachedQuery';
import { theme } from '../theme';
import type { HistoryPoint, ModuleProgress } from '../types';

const HISTORY_DAYS = 7;
const WEEKDAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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
      const ratio = module.target ? Math.min(value / module.target, 1) : 0;
      setModule((prev) => ({ ...prev, value, ratio, completed: ratio >= 1 }));
      setHistory((current) =>
        current
          ? current.map((point) => (point.date === today ? { ...point, value } : point))
          : current,
      );
    },
    [module.target, setHistory, today],
  );

  const change = useCallback(
    async (delta: number) => {
      if (busy) return;
      setBusy(true);
      setError(null);

      const previous = module.value;
      // Optimistic: the counter must feel instant even on a slow connection.
      applyValue(Math.max(0, previous + delta));

      try {
        const result = await apiRequest<{ value: number }>(
          `/api/entries/${module.key}/add?date=${today}`,
          { method: 'POST', body: { delta }, token },
        );
        applyValue(result.value);
      } catch (err) {
        applyValue(previous);
        setError((err as Error)?.message ?? 'Kaydedilemedi');
      } finally {
        setBusy(false);
      }
    },
    [applyValue, busy, module.key, module.value, today, token],
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
        <Pressable onPress={onBack} testID="back" style={styles.back} accessibilityRole="button">
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.topTitle}>{module.title}</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.card}>
        <View style={[styles.icon, { backgroundColor: `${module.color}1F` }]}>
          <Text style={styles.iconGlyph}>{module.icon}</Text>
        </View>
        <Text style={styles.description}>{module.description}</Text>

        <View style={styles.ringWrap}>
          <ScoreRing score={percent} size={150} strokeWidth={12} caption={`% ${percent}`} />
        </View>

        <Text style={styles.value} testID="module-value">
          {formatValue(module.value)}
          <Text style={styles.valueTarget}>
            {' '}
            / {formatValue(module.target)} {module.unit}
          </Text>
        </Text>

        {module.completed ? (
          <View style={styles.doneChip}>
            <Text style={styles.doneText}>Bugünlük tamam ✓</Text>
          </View>
        ) : null}

        <View style={styles.buttons}>
          <StepButton
            label={`− ${formatValue(module.step)}`}
            onPress={() => change(-module.step)}
            disabled={busy || module.value <= 0}
            testID="decrement"
          />
          <StepButton
            label={`+ ${formatValue(module.step)}`}
            onPress={() => change(module.step)}
            disabled={busy}
            primary
            color={module.color}
            testID="increment"
          />
        </View>

        {busy ? <ActivityIndicator style={styles.busy} color={module.color} /> : null}
        {error ? (
          <Text style={styles.error} testID="module-error">
            {error}
          </Text>
        ) : null}
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
                        backgroundColor: reached ? module.color : `${module.color}55`,
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

function StepButton({
  label,
  onPress,
  disabled,
  primary,
  color,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  color?: string;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.stepButton,
        primary ? { backgroundColor: color ?? theme.color.accent } : styles.stepGhost,
        pressed && { opacity: 0.8 },
        disabled && styles.stepDisabled,
      ]}
    >
      <Text style={[styles.stepLabel, primary ? styles.stepLabelPrimary : styles.stepLabelGhost]}>
        {label}
      </Text>
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
  backGlyph: {
    fontSize: 30,
    lineHeight: 34,
    color: theme.color.text,
    fontWeight: '700',
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
    ...theme.shadow.card,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: 26, lineHeight: 32 },
  description: {
    marginTop: theme.space(2),
    fontSize: theme.font.label,
    color: theme.color.textMuted,
    textAlign: 'center',
  },
  ringWrap: { marginTop: theme.space(4) },
  value: {
    marginTop: theme.space(4),
    fontSize: 24,
    fontWeight: '800',
    color: theme.color.text,
  },
  valueTarget: {
    fontSize: theme.font.body,
    fontWeight: '600',
    color: theme.color.textMuted,
  },
  doneChip: {
    marginTop: theme.space(3),
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(1.5),
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.successBg,
  },
  doneText: {
    fontSize: theme.font.tiny,
    fontWeight: '700',
    color: theme.color.success,
  },
  buttons: {
    flexDirection: 'row',
    gap: theme.space(3),
    marginTop: theme.space(5),
    alignSelf: 'stretch',
  },
  stepButton: {
    flex: 1,
    paddingVertical: theme.space(4),
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepGhost: {
    backgroundColor: theme.color.bg,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  stepDisabled: { opacity: 0.45 },
  stepLabel: { fontSize: theme.font.body, fontWeight: '800' },
  stepLabelPrimary: { color: theme.color.onAccent },
  stepLabelGhost: { color: theme.color.text },
  busy: { marginTop: theme.space(3) },
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
    width: 18,
    justifyContent: 'flex-end',
    backgroundColor: theme.color.track,
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
