import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { theme } from '../theme';

type Props = {
  score: number;
  size?: number;
  strokeWidth?: number;
  caption?: string;
};

export function ScoreRing({ score, size = 168, strokeWidth = 14, caption }: Props) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#00C2A8" />
            <Stop offset="1" stopColor={theme.color.accent} />
          </LinearGradient>
        </Defs>
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
          stroke="url(#scoreGradient)"
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
        <Text style={styles.score} accessibilityLabel={`Günlük puan ${clamped}`}>
          {clamped}
        </Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
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
    fontSize: 46,
    fontWeight: '800',
    color: theme.color.text,
    letterSpacing: -1,
  },
  caption: {
    marginTop: 2,
    fontSize: theme.font.tiny,
    fontWeight: '600',
    color: theme.color.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
