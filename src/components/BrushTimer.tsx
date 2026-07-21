import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { haptics } from '../lib/haptics';
import { onColor, tabularNums, theme } from '../theme';

const TOTAL_SECONDS = 120; // diş hekimi önerisi 2 dakika
const ZONE_SECONDS = 30; // 4 bölge × 30 sn

// Ağzın dört çeyreği; sıra üst→alt, sağ→sol dolaşır. `cell` 2×2 ızgaradaki yeri.
const ZONES = [
  { label: 'Sağ üst', hint: 'üst sağ dişler', cell: 1 },
  { label: 'Sol üst', hint: 'üst sol dişler', cell: 0 },
  { label: 'Sol alt', hint: 'alt sol dişler', cell: 2 },
  { label: 'Sağ alt', hint: 'alt sağ dişler', cell: 3 },
] as const;

function mmss(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

type Props = {
  color: string;
  /** Fırçalama bitti (2 dk doldu ya da "Bitir"): yuvayı işaretle. */
  onComplete: () => void;
  /** Vazgeçildi: hiçbir şey işaretleme. */
  onCancel: () => void;
};

/**
 * 2 dakikalık rehberli fırçalama sayacı. Dairesel geri sayım, 30 sn'de bir bölge
 * değişimi + hafif titreşim, 2×2 ağız şeması aktif çeyreği vurgular. Süre
 * fonksiyoneldir; hareket-azaltma yalnızca kutlama efektlerini (Confetti) kapatır.
 */
export function BrushTimer({ color, onComplete, onCancel }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const lastTick = useRef<number | null>(null);
  const zoneRef = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (!running) {
        lastTick.current = null;
        return;
      }
      const now = Date.now();
      const prev = lastTick.current ?? now;
      lastTick.current = now;
      const delta = Math.min(1, (now - prev) / 1000); // sekme arka plandayken sıçramasın

      setElapsed((current) => {
        const next = Math.min(TOTAL_SECONDS, current + delta);
        const zone = Math.min(ZONES.length - 1, Math.floor(next / ZONE_SECONDS));
        if (zone !== zoneRef.current) {
          zoneRef.current = zone;
          haptics.tick();
        }
        if (next >= TOTAL_SECONDS && !done.current) {
          done.current = true;
          haptics.success();
          // Render sonrası tamamla ki setState döngüsü içinde parent güncellenmesin.
          setTimeout(onComplete, 0);
        }
        return next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [running, onComplete]);

  const finishEarly = useCallback(() => {
    if (done.current) return;
    done.current = true;
    haptics.slot();
    onComplete();
  }, [onComplete]);

  const remaining = TOTAL_SECONDS - elapsed;
  const zone = Math.min(ZONES.length - 1, Math.floor(elapsed / ZONE_SECONDS));
  const ratio = elapsed / TOTAL_SECONDS;

  const size = 200;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const dashOffset = circumference * (1 - ratio);
  const textOnColor = onColor(color);

  return (
    <View style={styles.overlay} testID="brush-timer">
      <View style={styles.sheet}>
        <Text style={styles.title}>2 dakika fırçala</Text>
        <Text style={styles.subtitle}>Her çeyreğe 30 saniye</Text>

        <View style={styles.ringWrap}>
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
              transform={`rotate(-90 ${center} ${center})`}
            />
          </Svg>
          <View style={[StyleSheet.absoluteFill, styles.ringCenter]} pointerEvents="none">
            <Text style={styles.time} testID="brush-timer-remaining">
              {mmss(remaining)}
            </Text>
            <Text style={[styles.zoneLabel, { color }]}>{ZONES[zone].label}</Text>
          </View>
        </View>

        <Text style={styles.hint}>Şimdi: {ZONES[zone].hint}</Text>

        {/* 2×2 ağız şeması — aktif çeyrek vurgulanır, geçilenler işaretli. */}
        <View style={styles.mouth}>
          {[0, 1, 2, 3].map((cell) => {
            const zoneForCell = ZONES.findIndex((z) => z.cell === cell);
            const active = zoneForCell === zone;
            const passed = zoneForCell < zone;
            return (
              <View
                key={cell}
                style={[
                  styles.quadrant,
                  passed && { backgroundColor: `${color}33`, borderColor: color },
                  active && { backgroundColor: color, borderColor: color },
                ]}
              >
                <Text
                  style={[
                    styles.quadrantText,
                    active && { color: textOnColor },
                    passed && { color },
                  ]}
                >
                  {ZONES[zoneForCell].label}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={() => setRunning((r) => !r)}
            testID="brush-timer-toggle"
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>{running ? 'Duraklat' : 'Devam'}</Text>
          </Pressable>
          <Pressable
            onPress={finishEarly}
            testID="brush-timer-finish"
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, { backgroundColor: color }, pressed && styles.pressed]}
          >
            <Text style={[styles.primaryText, { color: textOnColor }]}>Bitir</Text>
          </Pressable>
        </View>

        <Pressable onPress={onCancel} testID="brush-timer-cancel" accessibilityRole="button" style={styles.cancel}>
          <Text style={styles.cancelText}>Vazgeç</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space(5),
    zIndex: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.lg,
    padding: theme.space(6),
    alignItems: 'center',
  },
  title: {
    fontSize: theme.font.title,
    fontWeight: '800',
    color: theme.color.text,
  },
  subtitle: {
    marginTop: theme.space(1),
    fontSize: theme.font.label,
    color: theme.color.textMuted,
  },
  ringWrap: {
    marginTop: theme.space(5),
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  time: {
    fontSize: theme.font.display,
    fontWeight: '800',
    color: theme.color.text,
    ...tabularNums,
  },
  zoneLabel: {
    marginTop: 2,
    fontSize: theme.font.body,
    fontWeight: '700',
  },
  hint: {
    marginTop: theme.space(4),
    fontSize: theme.font.label,
    color: theme.color.textMuted,
  },
  mouth: {
    marginTop: theme.space(5),
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.space(2),
    width: 200,
  },
  quadrant: {
    width: 94,
    height: 52,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quadrantText: {
    fontSize: theme.font.caption,
    fontWeight: '700',
    color: theme.color.textMuted,
  },
  controls: {
    marginTop: theme.space(6),
    flexDirection: 'row',
    gap: theme.space(3),
    alignSelf: 'stretch',
  },
  secondary: {
    flex: 1,
    minHeight: 50,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: theme.font.body,
    fontWeight: '700',
    color: theme.color.text,
  },
  primary: {
    flex: 1,
    minHeight: 50,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: theme.font.body,
    fontWeight: '800',
  },
  pressed: { opacity: 0.8 },
  cancel: {
    marginTop: theme.space(3),
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: theme.font.label,
    fontWeight: '700',
    color: theme.color.textMuted,
  },
});
