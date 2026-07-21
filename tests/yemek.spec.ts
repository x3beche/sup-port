import { APIRequestContext, expect, test } from '@playwright/test';

// Beslenme (yemek) modülü API testleri. Deterministik olması için ayrı bir test
// backend'ine karşı çalıştırılır (OFF_API_ENABLED=false → ağsız; OpenRouter
// anahtarı yok → foto-tahmin 503). PROD "support" DB'sine ASLA koşma
// (global-setup engeller). Örn: API_URL=http://127.0.0.1:4171 npx playwright test tests/yemek.spec.ts
const API = process.env.API_URL ?? 'http://localhost:4000';
const TODAY = '2026-07-21';

function uniqueEmail(tag: string) {
  return `pw-yemek-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function registerUser(request: APIRequestContext, tag: string) {
  const res = await request.post(`${API}/api/auth/register`, {
    data: { email: uniqueEmail(tag), password: 'parola12345', name: 'Yemek' },
  });
  expect(res.status()).toBe(201);
  return { token: (await res.json()).access_token as string };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

test.describe('Yemek — meta ve oturum', () => {
  test('meta öğün türleri, aktivite ve güvenlik metni döner', async ({ request }) => {
    const { token } = await registerUser(request, 'meta');
    const meta = await (await request.get(`${API}/api/yemek/meta`, { headers: auth(token) })).json();
    expect(meta.meal_types.map((m: { key: string }) => m.key)).toEqual([
      'kahvalti',
      'ogle',
      'aksam',
      'atistirma',
    ]);
    expect(meta.activity_levels.length).toBe(5);
    expect(meta.meal_target).toBe(3);
    expect(meta.disclaimer.length).toBeGreaterThan(20);
    expect(meta.eating_disorder_note.length).toBeGreaterThan(20);
    expect(meta.floor_kcal).toMatchObject({ kadin: 1200, erkek: 1500 });
    expect(typeof meta.llm_available).toBe('boolean');
  });

  test('tüm yemek uçları oturum ister', async ({ request }) => {
    for (const path of ['/api/yemek/meta', '/api/yemek/profile', '/api/yemek/meals', '/api/yemek/summary']) {
      expect((await request.get(`${API}${path}`)).status()).toBe(401);
    }
    expect((await request.get(`${API}/api/yemek/foods/search?q=x`)).status()).toBe(401);
  });
});

test.describe('Yemek — besin arama ve barkod', () => {
  test('yerel arama Türkçe duyarsız eşleşir', async ({ request }) => {
    const { token } = await registerUser(request, 'search');
    const res = await request.get(`${API}/api/yemek/foods/search?q=mercimek`, { headers: auth(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.foods[0].name).toContain('Mercimek');
    expect(body.foods[0].per).toBe('100g');
    expect(typeof body.foods[0].kcal).toBe('number');
  });

  test('barkod yerel tabloda bulunur', async ({ request }) => {
    const { token } = await registerUser(request, 'barcode');
    const res = await request.get(`${API}/api/yemek/foods/barcode/8699999000024`, { headers: auth(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.food.barcode).toBe('8699999000024');
    expect(body.food.source).toBe('local');
  });

  test('bilinmeyen barkod 404, rakam olmayan 422', async ({ request }) => {
    const { token } = await registerUser(request, 'barcode2');
    // OFF kapalı olduğu test ortamında yerelde yoksa 404.
    expect(
      (await request.get(`${API}/api/yemek/foods/barcode/1111111111116`, { headers: auth(token) })).status(),
    ).toBe(404);
    expect(
      (await request.get(`${API}/api/yemek/foods/barcode/abc`, { headers: auth(token) })).status(),
    ).toBe(422);
  });
});

test.describe('Yemek — profil ve hedef (BMR/TDEE)', () => {
  test('boş profilde hedef hesaplanamaz, eksikleri bildirir', async ({ request }) => {
    const { token } = await registerUser(request, 'profile');
    const p = await (await request.get(`${API}/api/yemek/profile`, { headers: auth(token) })).json();
    expect(p.age).toBeNull();
    expect(p.has_body_metrics).toBe(false);

    const sum = await (await request.get(`${API}/api/yemek/summary`, { headers: auth(token) })).json();
    expect(sum.target.has_data).toBe(false);
    expect(sum.target.missing).toContain('age');
  });

  test('Mifflin-St Jeor: erkek 85kg/180cm/30y/orta/ver → 2336 kcal', async ({ request }) => {
    const { token } = await registerUser(request, 'targets');
    const headers = auth(token);
    await request.put(`${API}/api/yemek/profile`, {
      headers,
      data: { age: 30, sex: 'erkek', height_cm: 180, activity_level: 'orta', goal: 'ver', weight_kg: 85 },
    });
    const sum = await (await request.get(`${API}/api/yemek/summary?date=${TODAY}`, { headers })).json();
    // BMR = 10*85 + 6.25*180 - 5*30 + 5 = 1830 ; TDEE = 1830*1.55 = 2836.5 ; -500 = 2336.5
    // (round() bankacı yuvarlaması yapar: 2836.5→2836, 2336.5→2336)
    expect(sum.target.has_data).toBe(true);
    expect(sum.target.bmr).toBe(1830);
    expect(sum.target.maintenance_kcal).toBe(2836);
    expect(sum.target.target_kcal).toBe(2336);
    expect(sum.target.floor_applied).toBe(false);
    // Kilo verirken protein 1.8 g/kg → 153 g
    expect(sum.target.protein_g).toBe(153);
  });

  test('güvenli alt sınır (kadın 1200) uygulanır ve uyarı verir', async ({ request }) => {
    const { token } = await registerUser(request, 'floor');
    const headers = auth(token);
    // Küçük/yaşlı/sedanter + agresif hedef → hesaplanan taban altı olur.
    await request.put(`${API}/api/yemek/profile`, {
      headers,
      data: { age: 70, sex: 'kadin', height_cm: 150, activity_level: 'sedanter', goal: 'ver', weight_kg: 50 },
    });
    const sum = await (await request.get(`${API}/api/yemek/summary`, { headers })).json();
    expect(sum.target.floor_applied).toBe(true);
    expect(sum.target.target_kcal).toBe(1200);
    expect(sum.target.warning).toBeTruthy();
  });

  test('profil kısmi güncellenir ve spor profiliyle paylaşılır', async ({ request }) => {
    const { token } = await registerUser(request, 'shared');
    const headers = auth(token);
    await request.put(`${API}/api/yemek/profile`, { headers, data: { age: 25, height_cm: 170, sex: 'kadin' } });
    // Paylaşılan alanlar spor profiline yazılmalı (tekrar sorma).
    const sporProfile = await (await request.get(`${API}/api/spor/profile`, { headers })).json();
    expect(sporProfile.height_cm).toBe(170);
    expect(sporProfile.sex).toBe('kadin');
    // Yaş beslenmeye özel; spor profilinde olmaz.
    expect(sporProfile).not.toHaveProperty('age');
  });
});

test.describe('Yemek — öğün kaydı ve puan', () => {
  test('öğün eklenir, toplamlar ve öğün sayısı doğru', async ({ request }) => {
    const { token } = await registerUser(request, 'add');
    const headers = auth(token);
    const day = await (
      await request.post(`${API}/api/yemek/meals?date=${TODAY}`, {
        headers,
        data: {
          meal_type: 'kahvalti',
          items: [
            { name: 'Haşlanmış yumurta', qty_g: 100, kcal: 155, protein_g: 13, carb_g: 1.1, fat_g: 11, source: 'local' },
            { name: 'Ekmek', qty_g: 60, kcal: 148, protein_g: 7.8, carb_g: 24.6, fat_g: 2, source: 'local' },
          ],
        },
      })
    ).json();
    expect(day.meal_count).toBe(1);
    expect(day.totals.kcal).toBe(303);
    expect(day.meals[0].meal_type).toBe('kahvalti');
    expect(day.meals[0].items).toHaveLength(2);
    expect(day.meals[0].subtotal.protein_g).toBeCloseTo(20.8, 1);
  });

  test('farklı öğün türleri günlük öğün sayacına (puan) yansır', async ({ request }) => {
    const { token } = await registerUser(request, 'score');
    const headers = auth(token);
    for (const mt of ['kahvalti', 'ogle', 'aksam']) {
      await request.post(`${API}/api/yemek/meals?date=${TODAY}`, {
        headers,
        data: { meal_type: mt, items: [{ name: 'Yemek', qty_g: 200, kcal: 300, source: 'manual' }] },
      });
    }
    const summary = await (await request.get(`${API}/api/summary?date=${TODAY}`, { headers })).json();
    const meal = summary.modules.find((m: { key: string }) => m.key === 'meal');
    // 3 farklı öğün türü → değer 3 → hedef 3 → tamamlandı.
    expect(meal.value).toBe(3);
    expect(meal.completed).toBe(true);
  });

  test('öğe düzenlenir ve silinir; öğün sayısı yeniden hesaplanır', async ({ request }) => {
    const { token } = await registerUser(request, 'crud');
    const headers = auth(token);
    const day = await (
      await request.post(`${API}/api/yemek/meals?date=${TODAY}`, {
        headers,
        data: { meal_type: 'ogle', items: [{ name: 'Pilav', qty_g: 180, kcal: 234, source: 'local' }] },
      })
    ).json();
    const id = day.meals[0].items[0].id;

    const patched = await (
      await request.patch(`${API}/api/yemek/meals/${id}`, { headers, data: { qty_g: 90, kcal: 117 } })
    ).json();
    expect(patched.qty_g).toBe(90);
    expect(patched.kcal).toBe(117);

    const afterDel = await (await request.delete(`${API}/api/yemek/meals/${id}`, { headers })).json();
    expect(afterDel.meal_count).toBe(0);

    const summary = await (await request.get(`${API}/api/summary?date=${TODAY}`, { headers })).json();
    expect(summary.modules.find((m: { key: string }) => m.key === 'meal').value).toBe(0);
  });

  test('bilinmeyen/yabancı öğe düzenleme-silme 404', async ({ request }) => {
    const { token } = await registerUser(request, 'crud404');
    const headers = auth(token);
    expect(
      (await request.patch(`${API}/api/yemek/meals/aaaaaaaaaaaaaaaaaaaaaaaa`, { headers, data: { kcal: 1 } })).status(),
    ).toBe(404);
    expect((await request.delete(`${API}/api/yemek/meals/notanid`, { headers })).status()).toBe(404);
  });

  test('kullanıcılar birbirinin öğünlerini görmez', async ({ request }) => {
    const a = await registerUser(request, 'iso-a');
    const b = await registerUser(request, 'iso-b');
    await request.post(`${API}/api/yemek/meals?date=${TODAY}`, {
      headers: auth(a.token),
      data: { meal_type: 'aksam', items: [{ name: 'X', qty_g: 100, kcal: 500, source: 'manual' }] },
    });
    const dayB = await (await request.get(`${API}/api/yemek/meals?date=${TODAY}`, { headers: auth(b.token) })).json();
    expect(dayB.meal_count).toBe(0);
    expect(dayB.totals.kcal).toBe(0);
  });

  test('geçersiz öğün türü ve boş öğe listesi reddedilir', async ({ request }) => {
    const { token } = await registerUser(request, 'invalid');
    const headers = auth(token);
    expect(
      (await request.post(`${API}/api/yemek/meals`, { headers, data: { meal_type: 'brunch', items: [{ name: 'x', qty_g: 1, kcal: 1 }] } })).status(),
    ).toBe(422);
    expect(
      (await request.post(`${API}/api/yemek/meals`, { headers, data: { meal_type: 'ogle', items: [] } })).status(),
    ).toBe(422);
  });
});

test.describe('Yemek — foto-tahmin (gizlilik/KVKK)', () => {
  const IMG = 'aGVsbG8gd29ybGQgdGhpcyBpcyBhIGZha2UgaW1hZ2U='; // geçerli base64

  test('onay olmadan işlenmez (400)', async ({ request }) => {
    const { token } = await registerUser(request, 'consent');
    const res = await request.post(`${API}/api/yemek/meals/estimate`, {
      headers: auth(token),
      data: { consent: false, image_base64: IMG },
    });
    expect(res.status()).toBe(400);
  });

  test('geçersiz base64 reddedilir (400)', async ({ request }) => {
    const { token } = await registerUser(request, 'badimg');
    const res = await request.post(`${API}/api/yemek/meals/estimate`, {
      headers: auth(token),
      data: { consent: true, image_base64: '###not-base64###' },
    });
    expect(res.status()).toBe(400);
  });

  test('LLM yapılandırılmamışsa 503 (arama/barkod/elle yönlendirir)', async ({ request }) => {
    const { token } = await registerUser(request, 'nollm');
    const res = await request.post(`${API}/api/yemek/meals/estimate`, {
      headers: auth(token),
      data: { consent: true, image_base64: IMG },
    });
    // Test backend'inde OpenRouter anahtarı yok → servis kullanılamıyor.
    expect(res.status()).toBe(503);
  });
});
