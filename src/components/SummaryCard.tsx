import React, { useCallback, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { tabularNums, theme } from '../theme';
import { ScoreRing } from './ScoreRing';

/** Sürüklemenin boyut değiştirmesi için aşılması gereken dikey mesafe. */
const RESIZE_THRESHOLD = 24;

type Props = {
  score: number;
  completed: number;
  total: number;
  compact: boolean;
  onCompactChange: (compact: boolean) => void;
};

/**
 * Günlük özet kartı iki boyutta: büyük halka ya da tek satırlık kompakt hâl.
 * Tutamacı yukarı sürüklemek küçültür, aşağı sürüklemek büyütür — dokunmak da
 * aynı işi yapar, çünkü sürükleme her girdi yönteminde erişilebilir değil.
 */
export function SummaryCard({ score, completed, total, compact, onCompactChange }: Props) {
  const compactRef = useRef(compact);
  compactRef.current = compact;

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dy) > 4,
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dy < -RESIZE_THRESHOLD && !compactRef.current) onCompactChange(true);
        if (gesture.dy > RESIZE_THRESHOLD && compactRef.current) onCompactChange(false);
      },
    }),
  ).current;

  const toggle = useCallback(() => onCompactChange(!compactRef.current), [onCompactChange]);

  return (
    <View style={styles.card} testID="score-card">
      {compact ? (
        <View style={styles.compactRow}>
          <ScoreRing score={score} size={64} strokeWidth={7} />
          <View style={styles.compactText}>
            <Text style={styles.compactTitle}>Günlük puan</Text>
            <Text style={styles.compactStat}>
              <Text style={styles.compactStatValue}>
                {completed}/{total}
              </Text>{' '}
              tamamlandı
            </Text>
          </View>
        </View>
      ) : (
        <>
          <ScoreRing score={score} />
          <Text style={styles.stat}>
            <Text style={styles.statValue}>
              {completed}/{total}
            </Text>{' '}
            tamamlandı
          </Text>
        </>
      )}

      <Pressable
        {...responder.panHandlers}
        onPress={toggle}
        testID="summary-resize"
        accessibilityRole="button"
        accessibilityLabel={compact ? 'Özeti büyüt' : 'Özeti küçült'}
        accessibilityHint="Sürükleyerek de boyutlandırabilirsin"
        style={styles.handleArea}
      >
        <View style={styles.handle} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.lg,
    paddingTop: theme.space(6),
    paddingHorizontal: theme.space(5),
    alignItems: 'center',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: theme.space(4),
  },
  compactText: { flexShrink: 1 },
  compactTitle: {
    fontSize: theme.font.heading,
    fontWeight: '700',
    color: theme.color.text,
  },
  compactStat: {
    marginTop: 2,
    fontSize: theme.font.label,
    color: theme.color.textMuted,
  },
  compactStatValue: {
    fontWeight: '700',
    color: theme.color.text,
    ...tabularNums,
  },
  stat: {
    marginTop: theme.space(4),
    fontSize: theme.font.label,
    color: theme.color.textMuted,
  },
  statValue: {
    fontSize: theme.font.heading,
    fontWeight: '700',
    color: theme.color.text,
    ...tabularNums,
  },
  handleArea: {
    alignSelf: 'stretch',
    // 44px keeps the grab area comfortable even though the bar itself is thin.
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.border,
  },
});
