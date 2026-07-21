/**
 * api.ts ile AuthContext arasındaki ince köprü.
 *
 * apiRequest bir 401 aldığında burada kayıtlı `refresh` fonksiyonunu çağırıp
 * yeni bir access token alır ve isteği bir kez yeniden dener — böylece kısa
 * ömürlü access token'lar ekran koduna hiç dokunmadan şeffafça yenilenir.
 *
 * Eşzamanlı 401'ler TEK bir yenileme isteğinde birleşir (single-flight): aksi
 * halde her istek ayrı bir /refresh tetikler, refresh token rotation'ı yüzünden
 * biri hariç hepsi "reuse" sayılıp tüm oturum iptal edilirdi.
 */

type RefreshFn = () => Promise<string | null>;

let refreshFn: RefreshFn | null = null;
let onInvalid: (() => void) | null = null;
let inflight: Promise<string | null> | null = null;

export function configureAuthBridge(opts: { refresh: RefreshFn; onInvalid: () => void }): void {
  refreshFn = opts.refresh;
  onInvalid = opts.onInvalid;
}

export function clearAuthBridge(): void {
  refreshFn = null;
  onInvalid = null;
  inflight = null;
}

export function canRefresh(): boolean {
  return refreshFn !== null;
}

export function refreshAccessToken(): Promise<string | null> {
  const fn = refreshFn;
  if (!fn) return Promise.resolve(null);
  // Tek uçuş: aynı anda gelen tüm çağrılar aynı yenilemeyi bekler.
  if (!inflight) {
    inflight = fn().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export function notifySessionInvalid(): void {
  onInvalid?.();
}
