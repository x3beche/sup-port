import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Kullanıcı "hareketi azalt" tercihini açtıysa kutlama animasyonları kapanır.
 * Jüri ilkesi: efektler abartısız ve erişilebilir olmalı. Web'de OS/tarayıcı
 * medya sorgusu, native'de AccessibilityInfo dinlenir.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.matchMedia) return;
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => mounted && setReduced(query.matches);
      update();
      query.addEventListener?.('change', update);
      return () => {
        mounted = false;
        query.removeEventListener?.('change', update);
      };
    }

    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) =>
      mounted ? setReduced(value) : undefined,
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
