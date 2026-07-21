import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

/**
 * "Saat ayarı" hissi veren dikey kaydırma: `trigger` değiştiğinde eski içerik
 * yukarı kayıp solar, yeni içerik alttan yukarı kayarak belirir (odometer/clock).
 * Aynı anda ikisi de görünür olduğu için gerçek bir dikey geçiş izlenimi verir.
 */
export function VerticalRoll({
  trigger,
  children,
  distance = 16,
  duration = 300,
}: {
  trigger: string | number;
  children: React.ReactNode;
  distance?: number;
  duration?: number;
}) {
  const anim = useRef(new Animated.Value(1)).current;
  const [current, setCurrent] = useState<React.ReactNode>(children);
  const [previous, setPrevious] = useState<React.ReactNode>(null);
  const prevTrigger = useRef(trigger);
  const latest = useRef<React.ReactNode>(children);
  latest.current = children;

  useEffect(() => {
    if (prevTrigger.current === trigger) {
      // Aynı adımda içerik güncellendiyse (ör. yüzde) sessizce yenile.
      setCurrent(children);
      return;
    }
    prevTrigger.current = trigger;
    setPrevious(current);
    setCurrent(latest.current);
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setPrevious(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const inY = anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  const outY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] });

  return (
    <View>
      {previous != null ? (
        <Animated.View
          style={[styles.abs, { opacity: Animated.subtract(1, anim), transform: [{ translateY: outY }] }]}
          pointerEvents="none"
        >
          {previous}
        </Animated.View>
      ) : null}
      <Animated.View style={{ opacity: anim, transform: [{ translateY: inY }] }}>{current}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, right: 0, top: 0 },
});
