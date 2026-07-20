import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { onColor, tabularNums, theme } from '../theme';
import type { ModuleProgress } from '../types';

/*
 * Düğme etiketinde binlik ayracı kullanılmıyor: "−2.500" altı karakterle 360px'de
 * altı düğmelik satıra sığmayıp kesiliyordu. Ondalık ayracı Türkçe virgül.
 */
function stepLabel(step: number): string {
  return String(step).replace('.', ',');
}

type Props = {
  module: ModuleProgress;
  onChange: (delta: number, step: number) => void;
  /** Ana ekrandaki hızlı panelde daha alçak düğmeler kullanılır. */
  compact?: boolean;
};

/**
 * Tek satır: solda azaltma (büyükten küçüğe), sağda artırma (küçükten büyüğe).
 * Kullanıcının en çok dokunduğu kademe en geniş alanı alır — 8000 adımı 500'er
 * girmek 16 dokunuştu, artık hem kendi ölçeğine uygun kademe var hem de o
 * kademe parmağın gittiği yerde.
 */
export function StepPad({ module, onChange, compact }: Props) {
  const options = module.steps?.length ? module.steps : [module.step];
  const favorite = options.includes(module.favorite_step) ? module.favorite_step : options[0];
  const textOnColor = onColor(module.color);

  // Mirrored around the centre: the largest decrement sits furthest left, the
  // largest increment furthest right, so the row reads as one scale.
  const cells = [
    ...[...options].reverse().map((step) => ({ step, sign: -1 as const })),
    ...options.map((step) => ({ step, sign: 1 as const })),
  ];
  const dense = cells.length > 4;

  return (
    <View style={styles.row} testID="step-pad">
      {cells.map(({ step, sign }) => {
        const positive = sign === 1;
        const isFavorite = step === favorite;
        const disabled = !positive && module.value <= 0;

        return (
          <Pressable
            key={`${sign}-${step}`}
            onPress={() => onChange(sign * step, step)}
            disabled={disabled}
            testID={`${positive ? 'increment' : 'decrement'}-${step}`}
            accessibilityRole="button"
            accessibilityLabel={`${module.title} ${positive ? 'artır' : 'azalt'} ${step} ${module.unit}`}
            style={({ pressed }) => [
              styles.button,
              compact && styles.buttonCompact,
              // Weighting by usage is what puts the common step under the thumb.
              { flex: isFavorite ? 1.35 : 1 },
              positive
                ? { backgroundColor: isFavorite ? module.color : `${module.color}2E` }
                : styles.negative,
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <Text
              style={[
                styles.label,
                dense && styles.labelDense,
                positive && isFavorite ? { color: textOnColor } : { color: theme.color.text },
              ]}
              numberOfLines={1}
            >
              {positive ? '+' : '−'}
              {stepLabel(step)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: theme.space(1),
    marginTop: theme.space(5),
  },
  button: {
    // 44px is the smallest comfortable touch target.
    minHeight: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space(0.5),
  },
  buttonCompact: { minHeight: 44 },
  negative: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.35 },
  label: {
    fontSize: theme.font.body,
    fontWeight: '700',
    ...tabularNums,
  },
  labelDense: { fontSize: 10, letterSpacing: -0.2 },
});
