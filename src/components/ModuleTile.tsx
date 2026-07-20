import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { onColor, tabularNums, theme } from '../theme';
import type { ModuleProgress } from '../types';
import { Icon, type IconName } from './Icon';

type Props = {
  module: ModuleProgress;
  onPress: (module: ModuleProgress) => void;
  onLongPress?: (module: ModuleProgress) => void;
  active?: boolean;
};

export function ModuleTile({ module, onPress, onLongPress, active }: Props) {
  const pct = Math.round(module.ratio * 100);

  return (
    <Pressable
      onPress={() => onPress(module)}
      onLongPress={onLongPress ? () => onLongPress(module) : undefined}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`${module.title}, ${module.value} / ${module.target} ${module.unit}`}
      accessibilityHint={onLongPress ? 'Hızlı kayıt için basılı tut' : undefined}
      testID={`tile-${module.key}`}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
    >
      <View
        style={[
          styles.icon,
          { backgroundColor: `${module.color}26` },
          active && { borderWidth: 2, borderColor: module.color },
        ]}
      >
        <Icon name={module.icon as IconName} size={28} color={module.color} />
        {module.completed ? (
          <View style={[styles.badge, { backgroundColor: module.color }]}>
            <Icon name="check" size={11} strokeWidth={2.6} color={onColor(module.color)} />
          </View>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {module.title}
      </Text>

      {/* The bar alone reads as decoration; the number is what answers
          "how am I doing today" without opening the module. */}
      <Text style={styles.progress} numberOfLines={1}>
        %{pct}
      </Text>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: module.color }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    width: 72,
  },
  tilePressed: {
    opacity: 0.6,
    transform: [{ scale: 0.96 }],
  },
  icon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: -3,
    top: -3,
    width: 20,
    height: 20,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.color.card,
  },
  title: {
    marginTop: theme.space(2),
    fontSize: theme.font.caption,
    fontWeight: '600',
    color: theme.color.text,
    textAlign: 'center',
  },
  progress: {
    marginTop: 1,
    fontSize: theme.font.tiny,
    fontWeight: '600',
    color: theme.color.textMuted,
    ...tabularNums,
  },
  track: {
    marginTop: theme.space(1.5),
    width: 44,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.track,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: theme.radius.pill,
  },
});
