import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { tabularNums, theme } from '../theme';
import { AnimatedPercent } from './AnimatedPercent';
import { Icon, type IconName } from './Icon';
import { VerticalRoll } from './VerticalRoll';

type Stage = 'downloading' | 'verifying' | 'done';

const GREEN = theme.color.success;

const STAGE_META: Record<Stage, { icon: IconName; label: string }> = {
  downloading: { icon: 'download', label: 'İndiriliyor' },
  verifying: { icon: 'shield', label: 'Güvenlik doğrulaması' },
  done: { icon: 'check', label: 'Tamamlandı' },
};

/**
 * İndirme sırasında ana ekranda yüzen yeşil ilerleme kartı. Aşama (indir →
 * güvenlik doğrulaması → tamam) ve yüzde dikey kayarak (saat/odometer hissi)
 * değişir; alttaki çubuk yeşil ve akıcı dolar. Salt görüntü — iptal butondan.
 */
export function UpdateProgress({ stage, progress }: { stage: Stage; progress: number }) {
  const barW = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    Animated.timing(barW, {
      toValue: stage === 'downloading' ? Math.max(0, Math.min(1, progress)) : 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [barW, progress, stage]);

  const meta = STAGE_META[stage];

  return (
    <View style={styles.card} testID="update-progress">
      <View style={styles.row}>
        <VerticalRoll trigger={stage}>
          <View style={styles.left}>
            <Icon name={meta.icon} size={16} strokeWidth={2} color={GREEN} />
            <Text style={styles.label}>{meta.label}</Text>
          </View>
        </VerticalRoll>
        {/* Yüzde artık çubukla senkron akıcı sayar (dikey kaydırma yok). */}
        {stage === 'downloading' ? (
          <AnimatedPercent value={barW} style={styles.pct} />
        ) : (
          <Text style={styles.pct}>{stage === 'done' ? '✓' : ''}</Text>
        )}
      </View>
      <View style={styles.barTrack}>
        <Animated.View
          style={[styles.barFill, { width: barW.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 240,
    maxWidth: 320,
    backgroundColor: theme.color.successBg,
    borderWidth: 1,
    borderColor: `${GREEN}55`,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.space(2),
    height: 20,
    overflow: 'hidden',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2) },
  label: { fontSize: theme.font.label, fontWeight: '700', color: GREEN },
  pct: { fontSize: theme.font.label, fontWeight: '800', color: GREEN, ...tabularNums },
  barTrack: {
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.track,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: theme.radius.pill, backgroundColor: GREEN },
});
