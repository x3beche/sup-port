import { Platform, Vibration } from 'react-native';

/**
 * Hafif dokunsal geri bildirim. expo-haptics yerine React Native'in yerleşik
 * Vibration'ı kullanılıyor: native derleme zinciri değişmesin diye (DraggableGrid
 * ile aynı gerekçe). İzin yoksa/desteklenmezse sessizce yok sayılır — hiçbir
 * durumda uygulamayı kırmaz.
 *
 * Titreşim bir "şeker"dir, işlevsel değil: çağıran taraf hareket-azaltma
 * tercihini zaten kontrol eder, ama web'de de gürültü yapmaması için burada da
 * platform kapısı var.
 */
function buzz(pattern: number | number[]): void {
  // Web'de Vibration çoğu tarayıcıda no-op/uyarı; masaüstünde hiç yok. Native'e sakla.
  if (Platform.OS === 'web') return;
  try {
    Vibration.vibrate(pattern);
  } catch {
    // yoksay
  }
}

/** Bölge değişimi / yuva işaretleme gibi küçük onaylar. */
export const haptics = {
  tick: () => buzz(12),
  slot: () => buzz(22),
  /** Günü tamamlama. */
  success: () => buzz([0, 30, 60, 30]),
  /** Kilometre taşı — biraz daha belirgin ama yine kısa. */
  milestone: () => buzz([0, 40, 80, 40, 80, 60]),
};
