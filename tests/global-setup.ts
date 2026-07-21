import type { FullConfig } from '@playwright/test';

/**
 * Güvenlik kilidi: test paketi yüzlerce sahte kullanıcı/kayıt oluşturur. Bu
 * paketi PRODUCTION veritabanına bağlı bir backend'e karşı çalıştırmak üretimi
 * kirletir (bir kez ~177 sahte kullanıcı oluştu). Bu setup, hedef backend'in
 * canlı "support" DB'sine bağlı olup olmadığını /health'ten kontrol eder ve
 * öyleyse testleri hiç başlatmadan durdurur.
 *
 * CI kendi DB'sini (support_ci) kullandığı için etkilenmez. Bilerek gerekiyorsa
 * ALLOW_PROD_DB=1 ile atlanabilir.
 */
const API = process.env.API_URL ?? 'http://localhost:4000';
const PROD_DB = 'support';

export default async function globalSetup(_config: FullConfig): Promise<void> {
  if (process.env.ALLOW_PROD_DB === '1') return;
  try {
    const res = await fetch(`${API}/health`);
    const body = (await res.json()) as { db?: string };
    if (body?.db === PROD_DB) {
      throw new Error(
        `\n\n⛔ Test paketi PRODUCTION veritabanına ("${PROD_DB}") bağlı bir ` +
          `backend'e (${API}) yönlendirilmiş.\n` +
          `Testler çok sayıda sahte kullanıcı oluşturur; üretimi kirletmemek için ` +
          `durduruldu.\n` +
          `Çözüm: yerel/test DB'ye yönlendir (ör. API_URL=http://localhost:4100 ile ` +
          `ayrı bir backend) ya da bilerek istiyorsan ALLOW_PROD_DB=1 ver.\n`,
      );
    }
  } catch (err) {
    // /health'e ulaşılamıyorsa (backend kapalı) engelleme — testler kendi
    // bağlantı hatalarını verir. Yalnızca prod DB tespitinde dur.
    if (err instanceof Error && err.message.includes('PRODUCTION')) throw err;
  }
}
