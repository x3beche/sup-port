import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Yumuşak (animasyonlu) dairesel ilerleme halkası. `progress` (0–1) her
 * değiştiğinde offset yeni değere doğru animate edilir → akıcı dolum. `spinning`
 * (doğrulama adımı) kısa bir yayı sürekli döndürür.
 */
export function CircularProgress({
  progress,
  size = 38,
  strokeWidth = 3.5,
  color = theme.color.success,
  spinning = false,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  spinning?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Hedef dolum oranı: doğrulamada sabit kısa bir yay (dönen), indirmede ilerleme.
  const target = spinning ? 0.28 : Math.max(0, Math.min(1, progress));
  const anim = useRef(new Animated.Value(target)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: target,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, target]);
  const dashoffset = anim.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });

  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!spinning) return;
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 850, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin, spinning]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={spinning ? { transform: [{ rotate }] } : undefined}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={center} cy={center} r={radius} stroke={theme.color.track} strokeWidth={strokeWidth} fill="none" />
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${center} ${center})`}
          />
        </Svg>
      </View>
    </Animated.View>
  );
}
