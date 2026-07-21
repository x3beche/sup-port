import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { tabularNums, theme } from '../theme';
import { AnimatedPercent } from './AnimatedPercent';
import { Icon } from './Icon';
import { VerticalRoll } from './VerticalRoll';

type Stage = 'downloading' | 'verifying' | 'done';

const GREEN = theme.color.success;
const WHITE = theme.color.text;

// Doğrulama alt adımları — sırayla dikey geçer (SHA-256 → Sertifika → İmza).
const VERIFY_STEPS = ['SHA-256', 'Sertifika', 'İmza'] as const;
const VERIFY_MS = 520;

/** Doğrulama adımı ikonu: beyaz çizim, kalkanın içindeki tik YEŞİL. Dönmez. */
function VerifyIcon({ step }: { step: number }) {
  const s = {
    stroke: WHITE,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      {step === 0 ? (
        // SHA-256 → hash (#)
        <Path d="M8.5 4 L6.5 20 M15.5 4 L13.5 20 M4.5 9 H19 M4 15 H18.5" {...s} />
      ) : step === 1 ? (
        // Sertifika → madalya/rozet
        <>
          <Circle cx="12" cy="9" r="5" {...s} />
          <Path d="M9 13 L8 21 L12 18.5 L16 21 L15 13" {...s} />
        </>
      ) : (
        // İmza → kalkan (beyaz) + YEŞİL tik
        <>
          <Path d="M12 3 L19 6 V11 C19 15.8 15.7 19.4 12 21 C8.3 19.4 5 15.8 5 11 V6 Z" {...s} />
          <Path
            d="M9 11.6 L11 13.6 L15 9.3"
            stroke={GREEN}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      )}
    </Svg>
  );
}

/**
 * Menü butonu, indirme sırasında ayrı popup açmadan KENDİSİ yatayda genişleyip
 * yükleme rozetine dönüşür (yükseklik sabit). Yalnızca ilerleme ÇUBUĞU yeşil;
 * metin/ikonlar beyaz. Doğrulamada SHA-256 → Sertifika → İmza(kalkan) sırayla
 * dikey geçer; kalkanın tiki yeşil, ikon dönmez. Basınca indirme iptal olur.
 */
export function UpdatePill({
  stage,
  progress,
  speed,
  onCancel,
}: {
  stage: Stage;
  progress: number;
  /** İndirme hızı metni (ör. "2,4 MB/s") — koyu silik gri gösterilir. */
  speed?: string | null;
  onCancel: () => void;
}) {
  const width = useRef(new Animated.Value(38)).current;
  const fill = useRef(new Animated.Value(0)).current;
  const [verifyStep, setVerifyStep] = useState(0);

  useEffect(() => {
    Animated.spring(width, { toValue: 162, friction: 7, tension: 80, useNativeDriver: false }).start();
  }, [width]);

  useEffect(() => {
    Animated.timing(fill, {
      toValue: stage === 'downloading' ? Math.max(0, Math.min(1, progress)) : 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fill, progress, stage]);

  // Doğrulama alt adımlarını sırayla ilerlet.
  useEffect(() => {
    if (stage !== 'verifying') {
      setVerifyStep(0);
      return;
    }
    setVerifyStep(0);
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(i + 1, VERIFY_STEPS.length - 1);
      setVerifyStep(i);
    }, VERIFY_MS);
    return () => clearInterval(id);
  }, [stage]);

  return (
    <Pressable
      onPress={onCancel}
      testID="update-pill"
      accessibilityRole="button"
      accessibilityLabel="İndirmeyi iptal et"
    >
      <Animated.View style={[styles.pill, { width }]}>
        <View style={styles.contentRow}>
          {stage === 'downloading' ? (
            <>
              <View style={styles.leftGroup}>
                <Icon name="download" size={16} strokeWidth={2} color={WHITE} />
                {speed ? <Text style={styles.speed} numberOfLines={1}>{speed}</Text> : null}
              </View>
              {/* Yüzde çubukla senkron akıcı sayar (dikey kaydırma yok). */}
              <AnimatedPercent value={fill} style={styles.text} />
            </>
          ) : (
            <VerticalRoll trigger={stage === 'verifying' ? verifyStep : 'done'} distance={12} duration={260}>
              <View style={styles.stepRow}>
                {stage === 'verifying' ? (
                  <VerifyIcon step={verifyStep} />
                ) : (
                  <Icon name="check" size={16} strokeWidth={2.4} color={GREEN} />
                )}
                <Text style={styles.text}>
                  {stage === 'verifying' ? VERIFY_STEPS[verifyStep] : 'Tamam'}
                </Text>
              </View>
            </VerticalRoll>
          )}
        </View>
        <View style={styles.barTrack}>
          <Animated.View
            style={[styles.barFill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
          />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.color.card,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(1.5),
    justifyContent: 'center',
    overflow: 'hidden',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 18,
    overflow: 'hidden',
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2) },
  leftGroup: { flexDirection: 'row', alignItems: 'center', gap: theme.space(1.5) },
  // Koyu, silik gri — indirme hızı (ör. "2,4 MB/s").
  speed: { fontSize: theme.font.tiny, fontWeight: '600', color: '#6E6E74', ...tabularNums },
  text: { fontSize: theme.font.label, fontWeight: '800', color: WHITE, ...tabularNums },
  barTrack: {
    marginTop: 3,
    height: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.track,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: theme.radius.pill, backgroundColor: GREEN },
});
