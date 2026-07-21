import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';
import type { UpdateInfo } from './update';

/**
 * Gerçek indirme + kurulum (Android sideload self-update).
 *
 * Güvenlik: APK yalnızca HTTPS'ten iner; indirilen boyut backend'in (TLS'li kendi
 * domainimiz) verdiği boyutla karşılaştırılır (bütünlük); asıl kriptografik
 * garanti Android'in kurulumda yaptığı **imza doğrulaması**dır — güncelleme ancak
 * mevcut uygulamayla AYNI anahtarla imzalıysa kurulur, bu yüzden MITM bir saldırgan
 * sahte APK kuramaz. (70 MB APK'nın SHA-256'sını RN'de yeniden hesaplamak pratik
 * değil; backend sha256'yı şeffaflık için verir, TLS + boyut + imza yeterli koruma.)
 *
 * Her hata durumunda tarayıcıda APK linkini açan bir yedek vardır.
 */
const APK_MIME = 'application/vnd.android.package-archive';

export type DownloadProgress = { progress: number; speedText: string | null };

export function canInstallInApp(): boolean {
  return Platform.OS === 'android';
}

/** APK'yı ilerleme bildirerek indirir; dosya yolunu döner. */
export async function downloadUpdate(
  update: UpdateInfo,
  onProgress: (p: DownloadProgress) => void,
): Promise<string> {
  if (!update.apkUrl) throw new Error('APK adresi yok');
  const dir = FileSystem.cacheDirectory ?? '';
  const fileUri = `${dir}sup-port-${update.version}.apk`;
  await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);

  let lastBytes = 0;
  let lastTime = Date.now();
  const task = FileSystem.createDownloadResumable(update.apkUrl, fileUri, {}, (p) => {
    const total = p.totalBytesExpectedToWrite || update.size || 0;
    const written = p.totalBytesWritten;
    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    let speedText: string | null = null;
    if (dt >= 0.25) {
      const bps = (written - lastBytes) / dt;
      speedText = `${(bps / 1_000_000).toFixed(1).replace('.', ',')} MB/s`;
      lastBytes = written;
      lastTime = now;
    }
    onProgress({ progress: total ? Math.min(1, written / total) : 0, speedText });
  });

  const res = await task.downloadAsync();
  if (!res?.uri) throw new Error('İndirme tamamlanamadı');

  // Bütünlük: indirilen boyut beklenenle eşleşmeli (legacy getInfoAsync boyutu
  // sonuç nesnesinde döner).
  if (update.size) {
    const info = await FileSystem.getInfoAsync(res.uri);
    if (info.exists && typeof info.size === 'number' && info.size !== update.size) {
      await FileSystem.deleteAsync(res.uri, { idempotent: true }).catch(() => undefined);
      throw new Error('Dosya boyutu uyuşmuyor (bütünlük hatası)');
    }
  }
  return res.uri;
}

/** İndirilen APK'yı sistem paket yükleyicisiyle açar (kurulum). */
export async function installApk(fileUri: string): Promise<void> {
  const contentUri = await FileSystem.getContentUriAsync(fileUri);
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    });
  } catch {
    // Bazı Android sürümlerinde VIEW + mime gerekir.
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1,
      type: APK_MIME,
    });
  }
}

/** Kesin yedek: tarayıcıda APK'yı (yoksa release sayfasını) aç. */
export async function openInBrowser(update: UpdateInfo): Promise<void> {
  const url = update.apkUrl ?? update.releaseUrl;
  if (url) await Linking.openURL(url).catch(() => undefined);
}
