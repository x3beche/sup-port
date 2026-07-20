import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../theme';

export type TransitionDirection = 'forward' | 'backward' | 'fade';

// React Native Web drives transforms through CSS, so the native driver is both
// unavailable and unnecessary there.
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const EASE = Easing.bezier(...theme.motion.ease);

type Props = {
  children: React.ReactNode;
  direction?: TransitionDirection;
  style?: ViewStyle;
  testID?: string;
};

/**
 * Ekran geçişi: sönümlenerek gelen, hafifçe kayan ve ölçeklenen bir giriş.
 * Yön ileri/geri olduğunda kayma yönü tersine döner, böylece geri gitmek
 * geri gitmek gibi hissettirir.
 */
export function ScreenTransition({ children, direction = 'fade', style, testID }: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: theme.motion.normal,
      easing: EASE,
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, direction]);

  const offset =
    direction === 'fade'
      ? 0
      : direction === 'forward'
        ? theme.motion.slide
        : -theme.motion.slide;

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [offset, 0],
  });

  // A barely-there scale reads as depth without looking like a zoom.
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [direction === 'fade' ? 0.985 : 0.995, 1],
  });

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.fill,
        style,
        { opacity: progress, transform: [{ translateX }, { scale }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Izgara öğeleri için sırayla yukarı süzülerek gelen giriş. */
export function StaggeredItem({
  index,
  children,
  style,
}: {
  index: number;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: theme.motion.normal,
      // Cap the delay so a long grid never leaves the last tile lagging.
      delay: Math.min(index * theme.motion.stagger, 350),
      easing: EASE,
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, index]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
