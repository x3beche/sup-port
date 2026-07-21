import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Oturum token'ları için güvenli depolama.
 *
 * Native'de (iOS Keychain / Android Keystore) şifreli tutulur; root'lu bir
 * cihazda veya yedekten düz metin olarak çıkarılamaz. Web'de tarayıcıda böyle
 * bir kasa yok, bu yüzden AsyncStorage'a (localStorage) düşülür — web'de token
 * koruması JS ortamının XSS güvenliği kadardır. Uygulamanın asıl hedefi Android
 * olduğundan kazanç oradadır.
 *
 * NOT: SecureStore anahtarları yalnızca [A-Za-z0-9._-] içerebilir (iki nokta
 * kullanılamaz), bu yüzden anahtarlar bilinçli olarak iki-noktasız seçildi.
 */

const isWeb = Platform.OS === 'web';
const WEB_PREFIX = 'support.secure.';

export async function getSecret(key: string): Promise<string | null> {
  try {
    if (isWeb) return await AsyncStorage.getItem(WEB_PREFIX + key);
    return await SecureStore.getItemAsync(key);
  } catch {
    // Okunamayan/bozuk bir değer oturumu kilitlememeli; yok say.
    return null;
  }
}

export async function setSecret(key: string, value: string): Promise<void> {
  try {
    if (isWeb) {
      await AsyncStorage.setItem(WEB_PREFIX + key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Depolama hatası girişi bozmamalı (token yine de bellekte geçerli kalır).
  }
}

export async function deleteSecret(key: string): Promise<void> {
  try {
    if (isWeb) {
      await AsyncStorage.removeItem(WEB_PREFIX + key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Zaten erişilemez durumdaysa yapılacak bir şey yok.
  }
}
