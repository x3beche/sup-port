import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { API_BASE } from './api';

/**
 * Android self-update kontrolü.
 *
 * Uygulama GitHub'a değil KENDİ backend'imize (`/api/app/latest`) sorar — dağıtım
 * kontrolü bizde kalır. Dönen apk_url büyük dosyayı GitHub CDN'den indirir.
 * iOS sideload edemez, atlanır; web'de de kontrol çalışır (test/görünürlük için).
 */
export const CURRENT_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';

/**
 * DEMO bayrağı: true iken gerçek sürüm olmasa da akış "güncelleme var" gibi
 * simüle edilir (indirme SAHTE). GERÇEK kullanım için false — o zaman kontrol
 * backend'e (/api/app/latest) sorar ve yalnızca GERÇEK yeni sürümde ikon çıkar.
 */
const DEMO_FORCE_UPDATE = false;
const DEMO_UPDATE: UpdateInfo = {
  version: '1.1.0',
  apkUrl: null,
  releaseUrl: null,
  notes: 'Demo güncellemesi',
  sha256: null,
  size: null,
};

export type UpdateInfo = {
  version: string;
  apkUrl: string | null;
  releaseUrl: string | null;
  notes: string;
  /** APK'nın beklenen SHA-256'sı (backend'den, HTTPS) — bütünlük doğrulaması. */
  sha256: string | null;
  /** APK boyutu (bayt) — indirme hızı/yüzde ve boyut kontrolü için. */
  size: number | null;
};

export function parseVersion(v: string): number[] {
  return String(v)
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

/** latest, current'tan yeni mi (semver, sayısal karşılaştırma). */
export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

export async function checkForUpdate(signal?: AbortSignal): Promise<UpdateInfo | null> {
  if (Platform.OS === 'ios') return null;
  // DEMO: akışı elle denemek için gerçek kontrolü atla.
  if (DEMO_FORCE_UPDATE) return DEMO_UPDATE;
  try {
    const res = await fetch(`${API_BASE}/api/app/latest`, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      version?: string;
      apk_url?: string | null;
      release_url?: string | null;
      notes?: string;
      sha256?: string | null;
      size?: number | null;
    };
    const version = String(data.version ?? '');
    if (!version || !isNewer(version, CURRENT_VERSION)) return null;
    return {
      version,
      apkUrl: data.apk_url ?? null,
      releaseUrl: data.release_url ?? null,
      notes: data.notes ?? '',
      sha256: data.sha256 ?? null,
      size: typeof data.size === 'number' ? data.size : null,
    };
  } catch {
    return null;
  }
}
