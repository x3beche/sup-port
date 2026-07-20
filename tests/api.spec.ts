import { APIRequestContext, expect, test } from '@playwright/test';

const API = process.env.API_URL ?? 'http://localhost:4000';
const TODAY = '2026-07-20';

function uniqueEmail(tag: string) {
  return `pw-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function registerUser(request: APIRequestContext, tag: string) {
  const email = uniqueEmail(tag);
  const res = await request.post(`${API}/api/auth/register`, {
    data: { email, password: 'parola12345', name: 'Playwright' },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { email, token: body.access_token as string, user: body.user };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

test.describe('Sağlık', () => {
  test('/health MongoDB bağlantısını doğrular', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', db: 'support' });
  });
});

test.describe('Auth', () => {
  test('kayıt token ve kullanıcı döner', async ({ request }) => {
    const { token, user } = await registerUser(request, 'reg');
    expect(token).toBeTruthy();
    expect(user.id).toMatch(/^[a-f0-9]{24}$/);
    expect(user).not.toHaveProperty('password_hash');
  });

  test('aynı e-posta ikinci kez kaydedilemez', async ({ request }) => {
    const { email } = await registerUser(request, 'dup');
    const res = await request.post(`${API}/api/auth/register`, {
      data: { email, password: 'parola12345', name: 'Tekrar' },
    });
    expect(res.status()).toBe(409);
  });

  test('doğru parola ile giriş, yanlışıyla 401', async ({ request }) => {
    const { email } = await registerUser(request, 'login');

    const ok = await request.post(`${API}/api/auth/login`, {
      data: { email, password: 'parola12345' },
    });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).access_token).toBeTruthy();

    const bad = await request.post(`${API}/api/auth/login`, {
      data: { email, password: 'yanlisparola' },
    });
    expect(bad.status()).toBe(401);
  });

  test('bilinmeyen e-posta da 401 döner (hesap sızdırmaz)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { email: uniqueEmail('ghost'), password: 'parola12345' },
    });
    expect(res.status()).toBe(401);
    // Identical message to the wrong-password case, otherwise the response
    // reveals which emails are registered.
    expect((await res.json()).detail).toBe('E-posta veya parola hatalı');
  });

  test('kısa parola reddedilir', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      data: { email: uniqueEmail('short'), password: 'kisa', name: 'Kısa' },
    });
    expect(res.status()).toBe(422);
  });

  test('/me tokensiz 401, tokenla kullanıcıyı döner', async ({ request }) => {
    expect((await request.get(`${API}/api/auth/me`)).status()).toBe(401);

    const { token, user } = await registerUser(request, 'me');
    const res = await request.get(`${API}/api/auth/me`, { headers: auth(token) });
    expect(res.status()).toBe(200);
    expect((await res.json()).id).toBe(user.id);
  });

  test('bozuk token 401 döner', async ({ request }) => {
    const res = await request.get(`${API}/api/auth/me`, {
      headers: auth('bu.gecerli.bir.token.degil'),
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('Tracker', () => {
  test('tüm tracker uçları oturum ister', async ({ request }) => {
    for (const path of ['/api/modules', '/api/summary', '/api/history/water']) {
      expect((await request.get(`${API}${path}`)).status()).toBe(401);
    }
    expect((await request.post(`${API}/api/entries/water/add`, { data: {} })).status()).toBe(401);
  });

  test('yeni kullanıcının günü sıfırdan başlar', async ({ request }) => {
    const { token } = await registerUser(request, 'fresh');
    const res = await request.get(`${API}/api/summary?date=${TODAY}`, { headers: auth(token) });
    expect(res.status()).toBe(200);

    const summary = await res.json();
    expect(summary.score).toBe(0);
    expect(summary.completed_count).toBe(0);
    expect(summary.module_count).toBeGreaterThan(0);
    expect(summary.modules.every((m: { value: number }) => m.value === 0)).toBe(true);
  });

  test('hedefe ulaşınca modül tamamlanır ve puan artar', async ({ request }) => {
    const { token } = await registerUser(request, 'score');
    const headers = auth(token);

    const before = await (
      await request.get(`${API}/api/summary?date=${TODAY}`, { headers })
    ).json();
    const water = before.modules.find((m: { key: string }) => m.key === 'water');

    await request.put(`${API}/api/entries/water?date=${TODAY}`, {
      headers,
      data: { value: water.target },
    });

    const after = await (await request.get(`${API}/api/summary?date=${TODAY}`, { headers })).json();
    const updated = after.modules.find((m: { key: string }) => m.key === 'water');

    expect(updated.value).toBe(water.target);
    expect(updated.completed).toBe(true);
    expect(updated.ratio).toBe(1);
    expect(after.score).toBeGreaterThan(before.score);
    expect(after.completed_count).toBe(1);
  });

  test('hedefi aşmak oranı 1.0 üstüne çıkarmaz', async ({ request }) => {
    const { token } = await registerUser(request, 'overshoot');
    const headers = auth(token);

    await request.put(`${API}/api/entries/water?date=${TODAY}`, {
      headers,
      data: { value: 999 },
    });

    const summary = await (
      await request.get(`${API}/api/summary?date=${TODAY}`, { headers })
    ).json();
    const water = summary.modules.find((m: { key: string }) => m.key === 'water');

    expect(water.value).toBe(999);
    expect(water.ratio).toBe(1);
    // One overachieving module must not carry the whole daily score.
    expect(summary.score).toBeLessThan(100);
  });

  test('sayaç eksiye düşmez', async ({ request }) => {
    const { token } = await registerUser(request, 'negative');
    const headers = auth(token);

    await request.post(`${API}/api/entries/water/add?date=${TODAY}`, {
      headers,
      data: { delta: 2 },
    });
    const res = await request.post(`${API}/api/entries/water/add?date=${TODAY}`, {
      headers,
      data: { delta: -50 },
    });

    expect(res.status()).toBe(200);
    expect((await res.json()).value).toBe(0);
  });

  test('delta verilmezse modülün adımı kullanılır', async ({ request }) => {
    const { token } = await registerUser(request, 'step');
    const headers = auth(token);

    const modules = await (await request.get(`${API}/api/modules`, { headers })).json();
    const english = modules.find((m: { key: string }) => m.key === 'english');

    const res = await request.post(`${API}/api/entries/english/add?date=${TODAY}`, {
      headers,
      data: {},
    });
    expect((await res.json()).value).toBe(english.step);
  });

  test('geçmiş boş günler dahil kesintisiz seri döner', async ({ request }) => {
    const { token } = await registerUser(request, 'history');
    const headers = auth(token);

    await request.put(`${API}/api/entries/water?date=${TODAY}`, { headers, data: { value: 5 } });

    const res = await request.get(`${API}/api/history/water?days=7&date=${TODAY}`, { headers });
    const points = await res.json();

    expect(points).toHaveLength(7);
    expect(points[6]).toMatchObject({ date: TODAY, value: 5 });
    // Days with no entry are real zeros, not gaps the chart has to guess at.
    expect(points.slice(0, 6).every((p: { value: number }) => p.value === 0)).toBe(true);
  });

  test('kullanıcılar birbirinin verisini görmez', async ({ request }) => {
    const a = await registerUser(request, 'iso-a');
    const b = await registerUser(request, 'iso-b');

    await request.put(`${API}/api/entries/water?date=${TODAY}`, {
      headers: auth(a.token),
      data: { value: 7 },
    });

    const summaryB = await (
      await request.get(`${API}/api/summary?date=${TODAY}`, { headers: auth(b.token) })
    ).json();
    const waterB = summaryB.modules.find((m: { key: string }) => m.key === 'water');

    expect(waterB.value).toBe(0);
    expect(summaryB.score).toBe(0);
  });

  test('bilinmeyen modül 404 döner', async ({ request }) => {
    const { token } = await registerUser(request, 'unknown');
    const res = await request.post(`${API}/api/entries/uydurma/add`, {
      headers: auth(token),
      data: {},
    });
    expect(res.status()).toBe(404);
  });
});

test.describe('Kişisel hedefler', () => {
  test('yeni kullanıcı varsayılan hedeflerle başlar', async ({ request }) => {
    const { token } = await registerUser(request, 'tgt-default');
    const targets = await (await request.get(`${API}/api/targets`, { headers: auth(token) })).json();

    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((t: { is_custom: boolean }) => !t.is_custom)).toBe(true);
    for (const t of targets) expect(t.target).toBe(t.default_target);
  });

  test('hedef değiştirilir ve özete yansır', async ({ request }) => {
    const { token } = await registerUser(request, 'tgt-set');
    const headers = auth(token);

    const res = await request.put(`${API}/api/targets/brush`, { headers, data: { target: 5 } });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ target: 5, default_target: 2, is_custom: true });

    const summary = await (
      await request.get(`${API}/api/summary?date=${TODAY}`, { headers })
    ).json();
    const brush = summary.modules.find((m: { key: string }) => m.key === 'brush');
    expect(brush).toMatchObject({ target: 5, default_target: 2, is_custom_target: true });
  });

  test('yükseltilen hedef tamamlanmayı geri alır ve puanı düşürür', async ({ request }) => {
    const { token } = await registerUser(request, 'tgt-recalc');
    const headers = auth(token);

    // Default brush target is 2 — hit it, then move the goalposts.
    await request.put(`${API}/api/entries/brush?date=${TODAY}`, { headers, data: { value: 2 } });
    const done = await (await request.get(`${API}/api/summary?date=${TODAY}`, { headers })).json();
    expect(done.modules.find((m: { key: string }) => m.key === 'brush').completed).toBe(true);

    await request.put(`${API}/api/targets/brush`, { headers, data: { target: 4 } });
    const after = await (await request.get(`${API}/api/summary?date=${TODAY}`, { headers })).json();
    const brush = after.modules.find((m: { key: string }) => m.key === 'brush');

    expect(brush.completed).toBe(false);
    expect(brush.ratio).toBeCloseTo(0.5, 5);
    expect(after.score).toBeLessThan(done.score);
  });

  test('hedef varsayılana sıfırlanır', async ({ request }) => {
    const { token } = await registerUser(request, 'tgt-reset');
    const headers = auth(token);

    await request.put(`${API}/api/targets/water`, { headers, data: { target: 12 } });
    const res = await request.delete(`${API}/api/targets/water`, { headers });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ target: 8, is_custom: false });

    const targets = await (await request.get(`${API}/api/targets`, { headers })).json();
    expect(targets.find((t: { key: string }) => t.key === 'water').is_custom).toBe(false);
  });

  test('geçersiz hedefler reddedilir', async ({ request }) => {
    const { token } = await registerUser(request, 'tgt-invalid');
    const headers = auth(token);

    // Zero would make the completion ratio undefined.
    for (const target of [0, -5]) {
      const res = await request.put(`${API}/api/targets/water`, { headers, data: { target } });
      expect(res.status()).toBe(422);
    }
    expect(
      (await request.put(`${API}/api/targets/uydurma`, { headers, data: { target: 3 } })).status(),
    ).toBe(404);
  });

  test('hedefler kullanıcıya özel', async ({ request }) => {
    const a = await registerUser(request, 'tgt-iso-a');
    const b = await registerUser(request, 'tgt-iso-b');

    await request.put(`${API}/api/targets/water`, { headers: auth(a.token), data: { target: 20 } });

    const targetsB = await (await request.get(`${API}/api/targets`, { headers: auth(b.token) })).json();
    expect(targetsB.find((t: { key: string }) => t.key === 'water').target).toBe(8);
  });

  test('geçmiş grafiği de kişisel hedefi kullanır', async ({ request }) => {
    const { token } = await registerUser(request, 'tgt-history');
    const headers = auth(token);

    await request.put(`${API}/api/targets/reading`, { headers, data: { target: 60 } });
    const points = await (
      await request.get(`${API}/api/history/reading?days=3&date=${TODAY}`, { headers })
    ).json();

    expect(points.every((p: { target: number }) => p.target === 60)).toBe(true);
  });

  test('tüm hedef uçları oturum ister', async ({ request }) => {
    expect((await request.get(`${API}/api/targets`)).status()).toBe(401);
    expect((await request.put(`${API}/api/targets/water`, { data: { target: 5 } })).status()).toBe(401);
    expect((await request.delete(`${API}/api/targets/water`)).status()).toBe(401);
  });
});
