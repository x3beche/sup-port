import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';
import type { ModuleProgress } from '../types';

type Props = {
  module: ModuleProgress;
  onPress: (module: ModuleProgress) => void;
};

function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

export function ModuleTile({ module, onPress }: Props) {
  const pct = Math.round(module.ratio * 100);

  return (
    <Pressable
      onPress={() => onPress(module)}
      accessibilityRole="button"
      accessibilityLabel={`${module.title}, ${module.value} / ${module.target} ${module.unit}`}
      testID={`tile-${module.key}`}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
    >
      <View style={[styles.icon, { backgroundColor: withAlpha(module.color, '1F') }]}>
        <Text style={styles.iconGlyph}>{module.icon}</Text>
        {module.completed ? (
          <View style={[styles.badge, { backgroundColor: module.color }]}>
            <Text style={styles.badgeGlyph}>✓</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {module.title}
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
  iconGlyph: {
    fontSize: 28,
    lineHeight: 34,
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
  badgeGlyph: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
  },
  title: {
    marginTop: theme.space(2),
    fontSize: theme.font.tiny,
    fontWeight: '600',
    color: theme.color.text,
    textAlign: 'center',
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
