import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../lib/useReducedMotion';

const COLORS = ['#22C3C3', '#3DD68C', '#F5A623', '#9B86FF', '#EE8570', '#00C2F0'];

type Piece = {
  left: number; // yüzde
  size: number;
  color: string;
  delay: number;
  drift: number; // yatay sürüklenme (px)
  duration: number;
  spin: number; // toplam dönüş (derece)
};

// Sabit bir çekirdekten üretilir: her pencere yeniden hesaplanmasın, ama
// parçalar tekdüze görünmesin. Math.random modül yükünde bir kez çalışır.
function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    size: 6 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 180,
    drift: (Math.random() - 0.5) * 80,
    duration: 900 + Math.random() * 700,
    spin: (Math.random() - 0.5) * 540,
  }));
}

type Props = {
  /** Her artışta yeni bir seri patlatır. 0 iken hiçbir şey çizilmez. */
  trigger: number;
  count?: number;
  onDone?: () => void;
};

/**
 * Hafif, kütüphanesiz konfeti. Kutlama kısa (jüri ilkesi: abartısız). Kullanıcı
 * "hareketi azalt" tercihini açtıysa hiç çizilmez.
 */
export function Confetti({ trigger, count = 16, onDone }: Props) {
  const reduced = useReducedMotion();
  const pieces = useMemo(() => makePieces(count), [count]);
  const progress = useRef(pieces.map(() => new Animated.Value(0))).current;
  const [height, setHeight] = useState(600);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    if (reduced) {
      // Erişilebilir yol: animasyon yok, sadece kısa bir işaret ver ve bitir.
      onDone?.();
      return;
    }

    setVisible(true);
    const animations = pieces.map((piece, i) =>
      Animated.timing(progress[i], {
        toValue: 1,
        duration: piece.duration,
        delay: piece.delay,
        easing: Easing.in(Easing.quad), // yerçekimi gibi hızlanarak düşsün
        useNativeDriver: true,
      }),
    );
    progress.forEach((value) => value.setValue(0));
    const group = Animated.parallel(animations);
    group.start(({ finished }) => {
      if (finished) {
        setVisible(false);
        onDone?.();
      }
    });
    return () => group.stop();
    // Yalnızca trigger değişince yeniden patlar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, reduced]);

  if (!visible || reduced) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setHeight(e.nativeEvent.layout.height || height)}
    >
      {pieces.map((piece, i) => {
        const translateY = progress[i].interpolate({
          inputRange: [0, 1],
          outputRange: [-24, height + 24],
        });
        const translateX = progress[i].interpolate({
          inputRange: [0, 1],
          outputRange: [0, piece.drift],
        });
        const rotate = progress[i].interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${piece.spin}deg`],
        });
        // Sonlara doğru sönümlensin ki aniden kaybolmasın.
        const opacity = progress[i].interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [1, 1, 0],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.piece,
              {
                left: `${piece.left}%`,
                width: piece.size,
                height: piece.size * 1.4,
                backgroundColor: piece.color,
                opacity,
                transform: [{ translateY }, { translateX }, { rotate }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    top: 0,
    borderRadius: 2,
  },
});
