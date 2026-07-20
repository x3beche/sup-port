import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tabularNums, theme } from '../theme';
import type { WeekDay } from '../types';

const WEEKDAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const CHART_HEIGHT = 88;

type Mode = 'score' | 'completed';

function weekdayLabel(iso: string): string {
  const day = new Date(`${iso}T00:00:00`).getDay();
  return WEEKDAYS[day] ?? '';
}

export function WeeklyChart({ days }: { days: WeekDay[] }) {
  // Long-press flips the same series between percent and modules-completed
  // instead of adding a second card for it.
  const [mode, setMode] = useState<Mode>('score');

  const { average, best } = useMemo(() => {
    if (!days.length) return { average: 0, best: 0 };
    const total = days.reduce((sum, d) => sum + d.score, 0);
    return {
      average: Math.round(total / days.length),
      best: Math.max(...days.map((d) => d.score)),
    };
  }, [days]);

  const maxCount = Math.max(1, ...days.map((d) => d.module_count));

  return (
    <Pressable
      onLongPress={() => setMode((m) => (m === 'score' ? 'completed' : 'score'))}
      delayLongPress={350}
      testID="weekly-chart"
      accessibilityRole="button"
      accessibilityLabel={`Haftalık özet, ortalama yüzde ${average}. Görünümü değiştirmek için basılı tut.`}
      style={styles.card}
    >
      <View style={styles.head}>
        <Text style={styles.title}>Bu hafta</Text>
        <Text style={styles.average} testID="weekly-average">
          <Text style={styles.averageValue}>
            {mode === 'score' ? `%${average}` : `%${best}`}
          </Text>{' '}
          {mode === 'score' ? 'ortalama' : 'en iyi gün'}
        </Text>
      </View>

      <View style={styles.chart} testID="weekly-bars">
        {days.map((day) => {
          const ratio =
            mode === 'score' ? day.score / 100 : day.completed_count / maxCount;
          const height = Math.max(3, ratio * CHART_HEIGHT);
          return (
            <View key={day.date} style={styles.column}>
              <View style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    {
                      height,
                      backgroundColor: day.is_today
                        ? theme.color.accent
                        : `${theme.color.accent}59`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.label, day.is_today && styles.labelToday]}>
                {weekdayLabel(day.date)}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.hint}>
        {mode === 'score' ? 'Günlük puan' : 'Tamamlanan modül'} · görünüm için basılı tut
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.lg,
    padding: theme.space(5),
    marginTop: theme.space(4),
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: theme.space(4),
  },
  title: {
    fontSize: theme.font.heading,
    fontWeight: '700',
    color: theme.color.text,
  },
  average: {
    fontSize: theme.font.caption,
    color: theme.color.textMuted,
  },
  averageValue: {
    fontSize: theme.font.body,
    fontWeight: '700',
    color: theme.color.text,
    ...tabularNums,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  column: { flex: 1, alignItems: 'center' },
  // A filled track behind every bar drowns the data, so the slot stays empty.
  barSlot: { height: CHART_HEIGHT, justifyContent: 'flex-end' },
  bar: {
    width: 14,
    borderRadius: theme.radius.pill,
  },
  label: {
    marginTop: theme.space(2),
    fontSize: theme.font.tiny,
    fontWeight: '600',
    color: theme.color.textMuted,
  },
  labelToday: { color: theme.color.text, fontWeight: '700' },
  hint: {
    marginTop: theme.space(4),
    fontSize: theme.font.tiny,
    color: theme.color.textFaint,
  },
});
