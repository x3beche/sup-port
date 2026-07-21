import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { tabularNums, theme } from '../theme';

type Props = {
  score: number;
  size?: number;
  strokeWidth?: number;
  /** Modül ekranında halkanın da modülün rengini alması için. */
  color?: string;
};

const EASE = Easing.bezier(...theme.motion.ease);

export function ScoreRing({
  score,
  size = 168,
  strokeWidth = 14,
  color = theme.color.accent,
}: Props) {
  const target = Math.max(0, Math.min(100, score));

  // The arc and the number are driven off one value so they can never disagree.
  // A listener re-renders instead of animating SVG props directly, which keeps
  // the behaviour identical on web and native.
  const progress = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const id = progress.addListener(({ value }) => setShown(value));
    const animation = Animated.timing(progress, {
      toValue: target,
      duration: theme.motion.slow,
      easing: EASE,
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      animation.stop();
      progress.removeListener(id);
    };
  }, [progress, target]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - shown / 100);
  const center = size / 2;

  // The number has to scale with the ring: a fixed hero size overflowed the
  // 64px compact ring ("17" spilled past the stroke). Capped so the large ring
  // keeps its intended size.
  const fontSize = Math.min(theme.font.hero, Math.round(size * 0.3));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={theme.color.track}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          // Start the arc at 12 o'clock instead of 3 o'clock.
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>

      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        <Text
          style={[styles.score, { fontSize, letterSpacing: fontSize > 30 ? -1 : 0 }]}
          accessibilityLabel={`Yüzde ${target}`}
          numberOfLines={1}
        >
          {Math.round(shown)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontWeight: '800',
    color: theme.color.text,
    ...tabularNums,
  },
});
