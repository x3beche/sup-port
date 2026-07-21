import React, { useEffect, useState } from 'react';
import { Animated, StyleProp, Text, TextStyle } from 'react-native';

/**
 * İlerleme çubuğunun animated değerine bağlı, akıcı YUKARI SAYAN yüzde. Odometer
 * gibi dikey kaydırma yerine standart bir sayaç: sayı, çubukla birebir senkron
 * ve kesintisiz artar (adım adım "zıplamaz"). Çubuk zaten JS driver'la (width
 * interpolasyonu) animasyonlandığı için dinleyici her karede güncel değeri verir.
 */
export function AnimatedPercent({
  value,
  prefix = '%',
  style,
}: {
  value: Animated.Value;
  prefix?: string;
  style?: StyleProp<TextStyle>;
}) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const id = value.addListener(({ value: v }) => {
      const next = Math.round(Math.max(0, Math.min(1, v)) * 100);
      setPct((prev) => (prev === next ? prev : next));
    });
    return () => value.removeListener(id);
  }, [value]);

  return (
    <Text style={style} accessibilityLabel={`${pct} yüzde`}>
      {prefix}
      {pct}
    </Text>
  );
}
