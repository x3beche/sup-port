import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Güvenli alan (safe area) boşlukları.
 *
 * Native'de gerçek sistem çubuğu ölçüleri (react-native-safe-area-context)
 * kullanılır — Android edge-to-edge'de içerik durum çubuğunun ve gezinme
 * çubuğunun altına sızmasın diye. Web'de gerçek inset yoktur; bunun yerine
 * S23 çerçevesindeki (public/s23.html) simüle edilmiş çubuk yükseklikleriyle
 * EŞLEŞEN sabitler döner. İki taraf bu sayılarda anlaşmalı.
 */
export const WEB_STATUS_BAR_H = 32; // üst durum çubuğu (saat/ikonlar)
export const WEB_NAV_BAR_H = 48; // altta 3 tuşlu Android gezinme çubuğu

export type Insets = { top: number; bottom: number; left: number; right: number };

export function useInsets(): Insets {
  const native = useSafeAreaInsets();
  if (Platform.OS === 'web') {
    return { top: WEB_STATUS_BAR_H, bottom: WEB_NAV_BAR_H, left: 0, right: 0 };
  }
  return native;
}
