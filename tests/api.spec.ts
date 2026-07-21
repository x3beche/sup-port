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

    const body = await res.json();
    // The database name is environment-specific (CI uses its own), so assert the
    // connection is live rather than pinning the name.
    expect(body.status).toBe('ok');
    expect(typeof body.db).toBe('string');
    expect(body.db.length).toBeGreaterThan(0);
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

test.describe('Oturum iptali', () => {
  test('çıkış token’ı sunucu tarafında geçersiz kılar', async ({ request }) => {
    const { token } = await registerUser(request, 'revoke');
    const headers = auth(token);

    expect((await request.get(`${API}/api/auth/me`, { headers })).status()).toBe(200);
    expect((await request.post(`${API}/api/auth/logout`, { headers })).status()).toBe(204);

    // A signed JWT stays cryptographically valid; the denylist is what ends it.
    expect((await request.get(`${API}/api/auth/me`, { headers })).status()).toBe(401);
    expect(
      (await request.post(`${API}/api/entries/water/add?date=${TODAY}`, { headers, data: { delta: 5 } })).status(),
    ).toBe(401);
  });

  test('bir oturumun iptali diğer oturumu etkilemez', async ({ request }) => {
    const { email } = await registerUser(request, 'twosessions');
    const second = await request.post(`${API}/api/auth/login`, {
      data: { email, password: 'parola12345' },
    });
    const other = (await second.json()).access_token as string;

    const first = await request.post(`${API}/api/auth/login`, {
      data: { email, password: 'parola12345' },
    });
    const toRevoke = (await first.json()).access_token as string;

    expect((await request.post(`${API}/api/auth/logout`, { headers: auth(toRevoke) })).status()).toBe(204);
    expect((await request.get(`${API}/api/auth/me`, { headers: auth(toRevoke) })).status()).toBe(401);
    // Signing out on the phone must not sign the user out on the tablet.
    expect((await request.get(`${API}/api/auth/me`, { headers: auth(other) })).status()).toBe(200);
  });

  test('çıkış ucu oturum ister', async ({ request }) => {
    expect((await request.post(`${API}/api/auth/logout`)).status()).toBe(401);
  });
});

test.describe('Haftalık özet', () => {
  test('istenen gün sayısı kadar kesintisiz seri döner', async ({ request }) => {
    const { token } = await registerUser(request, 'week');
    const headers = auth(token);

    const res = await request.get(`${API}/api/summary/week?days=7&date=${TODAY}`, { headers });
    expect(res.status()).toBe(200);

    const days = await res.json();
    expect(days).toHaveLength(7);
    expect(days[6]).toMatchObject({ date: TODAY, is_today: true });
    expect(days.slice(0, 6).every((d: { is_today: boolean }) => !d.is_today)).toBe(true);
    expect(days.every((d: { score: number }) => d.score === 0)).toBe(true);
  });

  test('girilen değer o günün puanına yansır', async ({ request }) => {
    const { token } = await registerUser(request, 'weekscore');
    const headers = auth(token);

    await request.put(`${API}/api/entries/water?date=${TODAY}`, { headers, data: { value: 8 } });
    const days = await (
      await request.get(`${API}/api/summary/week?days=7&date=${TODAY}`, { headers })
    ).json();

    expect(days[6].score).toBeGreaterThan(0);
    expect(days[6].completed_count).toBe(1);
  });

  test('haftalık özet oturum ister', async ({ request }) => {
    expect((await request.get(`${API}/api/summary/week`)).status()).toBe(401);
  });
});

test.describe('Kademe kullanımı', () => {
  test('modüller kendi kademe setini sunar', async ({ request }) => {
    const { token } = await registerUser(request, 'stepsets');
    const summary = await (
      await request.get(`${API}/api/summary?date=${TODAY}`, { headers: auth(token) })
    ).json();

    const steps = summary.modules.find((m: { key: string }) => m.key === 'steps');
    const brush = summary.modules.find((m: { key: string }) => m.key === 'brush');
    expect(steps.steps).toEqual([500, 1000, 2500]);
    expect(brush.steps).toEqual([1]);
    expect(steps.favorite_step).toBe(steps.step);
  });

  test('en çok kullanılan kademe favori olur', async ({ request }) => {
    const { token } = await registerUser(request, 'favstep');
    const headers = auth(token);

    for (let i = 0; i < 4; i++) {
      await request.post(`${API}/api/entries/steps/add?date=${TODAY}&used_step=1000`, {
        headers,
        data: { delta: 1000 },
      });
    }
    await request.post(`${API}/api/entries/steps/add?date=${TODAY}&used_step=500`, {
      headers,
      data: { delta: 500 },
    });

    const summary = await (
      await request.get(`${API}/api/summary?date=${TODAY}`, { headers })
    ).json();
    expect(summary.modules.find((m: { key: string }) => m.key === 'steps').favorite_step).toBe(1000);
  });

  test('ondalıklı kademe de sayılır', async ({ request }) => {
    const { token } = await registerUser(request, 'halfstep');
    const headers = auth(token);

    for (let i = 0; i < 2; i++) {
      await request.post(`${API}/api/entries/sleep/add?date=${TODAY}&used_step=0.5`, {
        headers,
        data: { delta: 0.5 },
      });
    }

    const summary = await (
      await request.get(`${API}/api/summary?date=${TODAY}`, { headers })
    ).json();
    // Written as "0_5" and read back as "0_5"; an int/float mismatch silently
    // broke this once.
    expect(summary.modules.find((m: { key: string }) => m.key === 'sleep').favorite_step).toBe(0.5);
  });
});

test.describe('Mağaza', () => {
  test('yeni kullanıcıda aktif modüller kurulu, "yakında" kurulamaz', async ({ request }) => {
    const { token } = await registerUser(request, 'store');
    const apps = await (await request.get(`${API}/api/store`, { headers: auth(token) })).json();
    // Aktif (coming_soon olmayan) modüller yeni kullanıcıda kuruludur; "yakında"
    // modülleri kurulamaz (kurulu değil).
    const active = apps.filter((a: { coming_soon?: boolean }) => !a.coming_soon);
    const soon = apps.filter((a: { coming_soon?: boolean }) => a.coming_soon);
    expect(active.length).toBeGreaterThanOrEqual(9);
    expect(active.every((a: { installed: boolean }) => a.installed)).toBe(true);
    expect(soon.every((a: { installed: boolean }) => !a.installed)).toBe(true);
    for (const a of apps) {
      expect(a.about.length).toBeGreaterThan(20);
      expect(a.category).toBeTruthy();
    }
  });

  test('kaldırma özetten ve sıradan çıkarır', async ({ request }) => {
    const { token } = await registerUser(request, 'store-remove');
    const headers = auth(token);

    const removed = await (
      await request.delete(`${API}/api/store/meditation/install`, { headers })
    ).json();
    expect(removed).toMatchObject({ key: 'meditation', installed: false });

    const summary = await (await request.get(`${API}/api/summary?date=${TODAY}`, { headers })).json();
    expect(summary.modules.some((m: { key: string }) => m.key === 'meditation')).toBe(false);
    // 9 varsayılan modülden biri (meditation) kaldırıldı.
    expect(summary.module_count).toBe(8);

    const order = await (await request.get(`${API}/api/order`, { headers })).json();
    expect(order).not.toContain('meditation');
  });

  test('kaldırılan modülün verisi ve hedefi geri kurulunca durur', async ({ request }) => {
    const { token } = await registerUser(request, 'store-keep');
    const headers = auth(token);

    await request.put(`${API}/api/entries/reading?date=${TODAY}`, { headers, data: { value: 25 } });
    await request.put(`${API}/api/targets/reading`, { headers, data: { target: 45 } });

    await request.delete(`${API}/api/store/reading/install`, { headers });
    const reinstalled = await (
      await request.post(`${API}/api/store/reading/install`, { headers })
    ).json();
    expect(reinstalled.installed).toBe(true);

    const summary = await (await request.get(`${API}/api/summary?date=${TODAY}`, { headers })).json();
    const reading = summary.modules.find((m: { key: string }) => m.key === 'reading');
    // Entries and targets are never deleted, only hidden.
    expect(reading.value).toBe(25);
    expect(reading.target).toBe(45);
  });

  test('kurma idempotent, bilinmeyen 404, uçlar oturum ister', async ({ request }) => {
    const { token } = await registerUser(request, 'store-edge');
    const headers = auth(token);

    // Installing an already-installed app is a no-op, not an error.
    expect((await request.post(`${API}/api/store/water/install`, { headers })).status()).toBe(200);
    expect((await request.post(`${API}/api/store/uydurma/install`, { headers })).status()).toBe(404);
    expect((await request.get(`${API}/api/store`)).status()).toBe(401);
    expect((await request.post(`${API}/api/store/water/install`)).status()).toBe(401);
  });

  test('kurulum kullanıcıya özel', async ({ request }) => {
    const a = await registerUser(request, 'store-iso-a');
    const b = await registerUser(request, 'store-iso-b');

    await request.delete(`${API}/api/store/steps/install`, { headers: auth(a.token) });

    const appsB = await (await request.get(`${API}/api/store`, { headers: auth(b.token) })).json();
    expect(appsB.find((x: { key: string }) => x.key === 'steps').installed).toBe(true);
  });
});

test.describe('Modül sırası', () => {
  test('varsayılan sıra kayıt sırasıdır', async ({ request }) => {
    const { token } = await registerUser(request, 'order');
    const order = await (await request.get(`${API}/api/order`, { headers: auth(token) })).json();
    expect(order).toEqual(['water', 'meal', 'brush', 'english', 'workout', 'steps', 'sleep', 'reading', 'meditation']);
  });

  test('kaydedilen sıra özete yansır', async ({ request }) => {
    const { token } = await registerUser(request, 'ordersave');
    const headers = auth(token);
    const wanted = ['sleep', 'water', 'steps', 'english', 'brush', 'meal', 'reading', 'meditation', 'workout'];

    expect((await request.put(`${API}/api/order`, { headers, data: { order: wanted } })).status()).toBe(200);

    const summary = await (await request.get(`${API}/api/summary?date=${TODAY}`, { headers })).json();
    expect(summary.modules.map((m: { key: string }) => m.key)).toEqual(wanted);
  });

  test('eksik anahtarlar sona eklenir', async ({ request }) => {
    const { token } = await registerUser(request, 'orderpartial');
    const headers = auth(token);

    const result = await (
      await request.put(`${API}/api/order`, { headers, data: { order: ['steps', 'water'] } })
    ).json();

    // A new module must not disappear just because an old order predates it.
    expect(result.slice(0, 2)).toEqual(['steps', 'water']);
    expect(result).toHaveLength(9);
    expect(new Set(result).size).toBe(9);
  });

  test('bilinmeyen ve tekrar eden anahtarlar reddedilir', async ({ request }) => {
    const { token } = await registerUser(request, 'orderbad');
    const headers = auth(token);

    expect((await request.put(`${API}/api/order`, { headers, data: { order: ['uydurma'] } })).status()).toBe(400);
    expect(
      (await request.put(`${API}/api/order`, { headers, data: { order: ['water', 'water'] } })).status(),
    ).toBe(400);
    expect((await request.put(`${API}/api/order`, { headers, data: { order: [] } })).status()).toBe(422);
  });

  test('sıra uçları oturum ister', async ({ request }) => {
    expect((await request.get(`${API}/api/order`)).status()).toBe(401);
    expect((await request.put(`${API}/api/order`, { data: { order: ['water'] } })).status()).toBe(401);
  });

  test('sıra kullanıcıya özel', async ({ request }) => {
    const a = await registerUser(request, 'order-iso-a');
    const b = await registerUser(request, 'order-iso-b');

    await request.put(`${API}/api/order`, {
      headers: auth(a.token),
      data: { order: ['meditation', 'water', 'meal', 'brush', 'english', 'steps', 'sleep', 'reading'] },
    });

    const orderB = await (await request.get(`${API}/api/order`, { headers: auth(b.token) })).json();
    expect(orderB[0]).toBe('water');
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

test.describe('Diş fırçalama', () => {
  // Three consecutive local days; each test uses a fresh user so streaks isolate.
  const D3 = '2026-05-13';
  const D2 = '2026-05-14';
  const D1 = '2026-05-15';

  async function setSlot(
    request: APIRequestContext,
    token: string,
    date: string,
    slot: 'morning' | 'evening',
    done = true,
  ) {
    return request.put(`${API}/api/brush/slot?date=${date}`, {
      headers: auth(token),
      data: { slot, done },
    });
  }

  async function completeDay(request: APIRequestContext, token: string, date: string) {
    await setSlot(request, token, date, 'morning');
    return setSlot(request, token, date, 'evening');
  }

  test('brush uçları oturum ister', async ({ request }) => {
    expect((await request.get(`${API}/api/brush/status`)).status()).toBe(401);
    expect(
      (await request.put(`${API}/api/brush/slot`, { data: { slot: 'morning', done: true } })).status(),
    ).toBe(401);
  });

  test('yeni kullanıcıda yuvalar boş, seri sıfır', async ({ request }) => {
    const { token } = await registerUser(request, 'brush-fresh');
    const res = await request.get(`${API}/api/brush/status?date=${D1}`, { headers: auth(token) });
    expect(res.status()).toBe(200);

    const s = await res.json();
    expect(s).toMatchObject({
      morning: false,
      evening: false,
      value: 0,
      target: 2,
      complete: false,
      streak: 0,
      best_streak: 0,
      next_milestone: 3,
    });
  });

  test('bir yuva günü tamamlamaz, iki yuva tamamlar ve seri başlar', async ({ request }) => {
    const { token } = await registerUser(request, 'brush-slots');

    const one = await (await setSlot(request, token, D1, 'morning')).json();
    expect(one).toMatchObject({ morning: true, evening: false, value: 1, complete: false, streak: 0 });
    expect(one.just_completed).toBe(false);

    const two = await (await setSlot(request, token, D1, 'evening')).json();
    expect(two).toMatchObject({ morning: true, evening: true, value: 2, complete: true, streak: 1 });
    // The write that completes the day flags it so the client can celebrate.
    expect(two.just_completed).toBe(true);
  });

  test('tamamlanan gün günlük özete ve puana yansır', async ({ request }) => {
    const { token } = await registerUser(request, 'brush-summary');
    const headers = auth(token);

    await completeDay(request, token, D1);

    const summary = await (
      await request.get(`${API}/api/summary?date=${D1}`, { headers })
    ).json();
    const brush = summary.modules.find((m: { key: string }) => m.key === 'brush');
    expect(brush.value).toBe(2);
    expect(brush.completed).toBe(true);
    expect(summary.completed_count).toBeGreaterThanOrEqual(1);
  });

  test('arka arkaya üç tam gün seriyi üçe çıkarır', async ({ request }) => {
    const { token } = await registerUser(request, 'brush-streak');

    await completeDay(request, token, D3);
    await completeDay(request, token, D2);
    await completeDay(request, token, D1);

    const s = await (
      await request.get(`${API}/api/brush/status?date=${D1}`, { headers: auth(token) })
    ).json();
    expect(s.streak).toBe(3);
    expect(s.best_streak).toBe(3);
    expect(s.next_milestone).toBe(7);
  });

  test('kilometre taşı yalnızca tamamlayan yazımda bir kez döner', async ({ request }) => {
    const { token } = await registerUser(request, 'brush-milestone');

    // Two older days done first, then complete the anchor day → streak hits 3.
    await completeDay(request, token, D3);
    await completeDay(request, token, D2);
    await setSlot(request, token, D1, 'morning');

    const completing = await (await setSlot(request, token, D1, 'evening')).json();
    expect(completing.streak).toBe(3);
    expect(completing.milestone).toBe(3);
    expect(completing.just_completed).toBe(true);

    // Re-touching an already-complete slot must not re-fire the celebration.
    const again = await (await setSlot(request, token, D1, 'evening')).json();
    expect(again.milestone).toBeNull();
    expect(again.just_completed).toBe(false);
  });

  test('yuvayı geri almak tamamlanmayı ve değeri düşürür', async ({ request }) => {
    const { token } = await registerUser(request, 'brush-undo');
    const headers = auth(token);

    await completeDay(request, token, D1);
    const undone = await (await setSlot(request, token, D1, 'evening', false)).json();
    expect(undone).toMatchObject({ morning: true, evening: false, value: 1, complete: false, streak: 0 });

    // The daily entry follows the slot count back down.
    const summary = await (
      await request.get(`${API}/api/summary?date=${D1}`, { headers })
    ).json();
    const brush = summary.modules.find((m: { key: string }) => m.key === 'brush');
    expect(brush.value).toBe(1);
    expect(brush.completed).toBe(false);
  });

  test('en iyi seri boşluktan sonra korunur', async ({ request }) => {
    const { token } = await registerUser(request, 'brush-best');

    // A 3-day run, a gap, then a single day: current streak resets, best holds.
    await completeDay(request, token, D3);
    await completeDay(request, token, D2);
    await completeDay(request, token, D1);
    await completeDay(request, token, '2026-05-20');

    const s = await (
      await request.get(`${API}/api/brush/status?date=2026-05-20`, { headers: auth(token) })
    ).json();
    expect(s.streak).toBe(1);
    expect(s.best_streak).toBe(3);
  });

  test('geçersiz yuva reddedilir', async ({ request }) => {
    const { token } = await registerUser(request, 'brush-invalid');
    const res = await request.put(`${API}/api/brush/slot?date=${D1}`, {
      headers: auth(token),
      data: { slot: 'noon', done: true },
    });
    expect(res.status()).toBe(422);
  });
});

test.describe('Spor — kütüphane', () => {
  test('kütüphane 40 egzersiz döner, görsel alanı yok', async ({ request }) => {
    const { token } = await registerUser(request, 'spor-lib');
    const res = await request.get(`${API}/api/spor/exercises`, { headers: auth(token) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(40);
    expect(body.exercises).toHaveLength(40);
    // Telif riski nedeniyle görsel alanı istemciye gitmemeli.
    expect(body.exercises.every((e: Record<string, unknown>) => !('image' in e))).toBe(true);
    expect(body.exercises[0]).toHaveProperty('met');
    expect(body.exercises[0]).toHaveProperty('steps');
  });

  test('kategori ve düşük etkili filtresi çalışır', async ({ request }) => {
    const { token } = await registerUser(request, 'spor-filter');
    const cardio = await (
      await request.get(`${API}/api/spor/exercises?category=kardiyo`, { headers: auth(token) })
    ).json();
    expect(cardio.exercises.length).toBeGreaterThan(0);
    expect(cardio.exercises.every((e: { category: string }) => e.category === 'kardiyo')).toBe(true);

    const low = await (
      await request.get(`${API}/api/spor/exercises?low_impact=true`, { headers: auth(token) })
    ).json();
    expect(low.exercises.every((e: { low_impact: boolean }) => e.low_impact)).toBe(true);
    // Yüksek etkili (burpee/jumping jack) düşük etkili filtresinde olmamalı.
    expect(low.exercises.some((e: { key: string }) => e.key === 'burpee')).toBe(false);
  });

  test('egzersiz detayı adımlar ve kırmızı bayrak içerir; bilinmeyen 404', async ({ request }) => {
    const { token } = await registerUser(request, 'spor-detail');
    const res = await request.get(`${API}/api/spor/exercises/bodyweight_squat`, { headers: auth(token) });
    expect(res.status()).toBe(200);
    const e = await res.json();
    expect(e.steps.length).toBeGreaterThan(0);
    expect(e.red_flags.length).toBeGreaterThan(0);

    const missing = await request.get(`${API}/api/spor/exercises/yokboyle`, { headers: auth(token) });
    expect(missing.status()).toBe(404);
  });

  test('spor uçları oturum ister', async ({ request }) => {
    for (const path of ['/api/spor/exercises', '/api/spor/meta', '/api/spor/weekly', '/api/spor/profile']) {
      expect((await request.get(`${API}${path}`)).status()).toBe(401);
    }
  });
});

test.describe('Spor — profil ve PAR-Q', () => {
  test('yeni kullanıcının profili boş', async ({ request }) => {
    const { token } = await registerUser(request, 'spor-profile');
    const p = await (await request.get(`${API}/api/spor/profile`, { headers: auth(token) })).json();
    expect(p.height_cm).toBeNull();
    expect(p.parq_completed).toBe(false);
  });

  test('profil kısmi güncellenir', async ({ request }) => {
    const { token } = await registerUser(request, 'spor-profile-upd');
    const p = await (
      await request.put(`${API}/api/spor/profile`, {
        headers: auth(token),
        data: { height_cm: 175, sex: 'erkek', goal: 'ver', target_weight_kg: 75 },
      })
    ).json();
    expect(p.height_cm).toBe(175);
    expect(p.sex).toBe('erkek');
    expect(p.goal).toBe('ver');
  });

  test('PAR-Q "evet" hekime danış işareti koyar', async ({ request }) => {
    const { token } = await registerUser(request, 'spor-parq');
    const clean = await (
      await request.post(`${API}/api/spor/parq`, {
        headers: auth(token),
        data: { answers: [false, false, false, false, false, false, false] },
      })
    ).json();
    expect(clean.parq_completed).toBe(true);
    expect(clean.parq_flagged).toBe(false);

    const flagged = await (
      await request.post(`${API}/api/spor/parq`, {
        headers: auth(token),
        data: { answers: [true, false, false, false, false, false, false] },
      })
    ).json();
    expect(flagged.parq_flagged).toBe(true);
  });
});

test.describe('Spor — vücut takibi (BMI)', () => {
  test('boy varsa BMI ve kategori hesaplanır, bel riski gelir', async ({ request }) => {
    const { token } = await registerUser(request, 'spor-bmi');
    const headers = auth(token);
    await request.put(`${API}/api/spor/profile`, {
      headers,
      data: { height_cm: 175, sex: 'erkek' },
    });
    const m = await (
      await request.post(`${API}/api/spor/metrics?date=${TODAY}`, {
        headers,
        data: { weight_kg: 90, waist_cm: 105 },
      })
    ).json();
    // 90 / 1.75^2 = 29.4 → fazla kilolu
    expect(m.bmi).toBeCloseTo(29.4, 1);
    expect(m.bmi_category).toBe('fazla_kilolu');
    // Bel 105 > 102 (erkek) → yüksek risk
    expect(m.waist_risk).toBe('yuksek');
  });

  test('boy yoksa BMI null', async ({ request }) => {
    const { token } = await registerUser(request, 'spor-nobmi');
    const m = await (
      await request.post(`${API}/api/spor/metrics?date=${TODAY}`, {
        headers: auth(token),
        data: { weight_kg: 80 },
      })
    ).json();
    expect(m.bmi).toBeNull();
    expect(m.bmi_category).toBeNull();
  });

  test('özet güvenli kilo verme süresini verir', async ({ request }) => {
    const { token } = await registerUser(request, 'spor-safe');
    const headers = auth(token);
    await request.put(`${API}/api/spor/profile`, { headers, data: { height_cm: 175, goal: 'ver', target_weight_kg: 80 } });
    await request.post(`${API}/api/spor/metrics?date=${TODAY}`, { headers, data: { weight_kg: 90 } });
    const s = await (await request.get(`${API}/api/spor/metrics/summary?date=${TODAY}`, { headers })).json();
    expect(s.has_data).toBe(true);
    expect(s.to_lose_kg).toBeCloseTo(10, 1);
    // 10 kg güvenli hızda: min 10 hafta (1 kg/hafta), max 20 hafta (0.5 kg/hafta)
    expect(s.safe_min_weeks).toBe(10);
    expect(s.safe_max_weeks).toBe(20);
  });
});

test.describe('Spor — antrenman ve hedef', () => {
  test('antrenman süre + kalori hesaplar ve güne yansır', async ({ request }) => {
    const { token } = await registerUser(request, 'spor-workout');
    const headers = auth(token);
    // Kalori için kilo gerekli.
    await request.post(`${API}/api/spor/metrics?date=${TODAY}`, { headers, data: { weight_kg: 80 } });

    const w = await (
      await request.post(`${API}/api/spor/workouts?date=${TODAY}`, {
        headers,
        data: { items: [{ key: 'brisk_walk', duration_sec: 1800 }] },
      })
    ).json();
    expect(w.duration_min).toBe(30);
    // kcal = MET(4.3) × 80 kg × 0.5 saat = 172
    expect(w.calories).toBe(172);
    expect(w.has_strength).toBe(false);

    // Günlük puana yansımalı: workout modülü değeri = dakika.
    const summary = await (await request.get(`${API}/api/summary?date=${TODAY}`, { headers })).json();
    const workout = summary.modules.find((m: { key: string }) => m.key === 'workout');
    expect(workout.value).toBe(30);
    expect(workout.completed).toBe(true); // hedef 30 dk
  });

  test('kuvvet antrenmanı haftalık kuvvet gününe sayılır', async ({ request }) => {
    const { token } = await registerUser(request, 'spor-strength');
    const headers = auth(token);
    await request.post(`${API}/api/spor/workouts?date=${TODAY}`, {
      headers,
      data: { items: [{ key: 'bodyweight_squat', sets: 3, reps: 12 }] },
    });
    const weekly = await (await request.get(`${API}/api/spor/weekly?date=${TODAY}`, { headers })).json();
    expect(weekly.strength_days).toBe(1);
    expect(weekly.active_minutes).toBeGreaterThan(0);
    expect(weekly.strength_target).toBe(2);
  });

  test('bilinmeyen egzersizli antrenman 404', async ({ request }) => {
    const { token } = await registerUser(request, 'spor-badworkout');
    const res = await request.post(`${API}/api/spor/workouts?date=${TODAY}`, {
      headers: auth(token),
      data: { items: [{ key: 'uydurma_hareket' }] },
    });
    expect(res.status()).toBe(404);
  });

  test('öneri kural-temelli yapı döner (llm kapalı)', async ({ request }) => {
    const { token } = await registerUser(request, 'spor-rec');
    const headers = auth(token);
    await request.put(`${API}/api/spor/profile`, { headers, data: { height_cm: 170, goal: 'ver' } });
    await request.post(`${API}/api/spor/metrics?date=${TODAY}`, { headers, data: { weight_kg: 95 } });
    const rec = await (await request.get(`${API}/api/spor/recommendation?llm=false`, { headers })).json();
    expect(rec.source).toBe('rule');
    expect(rec.focus.length).toBeGreaterThan(0);
    expect(rec.recommended_exercise_keys.length).toBeGreaterThan(0);
    expect(rec.disclaimer).toBeTruthy();
    // BMI 95/1.7^2 = 32.9 → obez → yüksek etkiliden kaçın
    expect(rec.avoid_high_impact).toBe(true);
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

// Metadata lookup/search canlı Google Books / Open Library'ye gider; bu blok
// bilerek AĞA ÇIKMAYAN uçları test eder (checksum, raf, oturum→puan, hedef,
// istatistik). Canlı proxy manuel/gerçek cihazda doğrulanır.
test.describe('Okuma — kütüphane ve oturum', () => {
  test('meta rafları ve kapak atıfını döner', async ({ request }) => {
    const { token } = await registerUser(request, 'okuma-meta');
    const meta = await (await request.get(`${API}/api/okuma/meta`, { headers: auth(token) })).json();
    expect(meta.shelves.map((s: { key: string }) => s.key)).toEqual(['reading', 'to_read', 'finished']);
    expect(meta.default_target_books).toBe(12);
    expect(meta.cover_attribution).toBeTruthy();
  });

  test('geçersiz ISBN lookup 422', async ({ request }) => {
    const { token } = await registerUser(request, 'okuma-isbn');
    // Kitap dışı önek / bozuk checksum → 422 (ağa çıkmadan reddedilir).
    const bad = await request.get(`${API}/api/okuma/lookup?isbn=1234567890123`, { headers: auth(token) });
    expect(bad.status()).toBe(422);
  });

  test('elle kitap eklenir, ISBN ile kapak URL türetilir', async ({ request }) => {
    const { token } = await registerUser(request, 'okuma-add');
    const headers = auth(token);
    const book = await (
      await request.post(`${API}/api/okuma/books`, {
        headers,
        data: { title: 'Kürk Mantolu Madonna', authors: ['Sabahattin Ali'], isbn13: '9789750718533', page_count: 160, shelf: 'reading', source: 'manual' },
      })
    ).json();
    expect(book.book_key).toBe('book_9789750718533');
    expect(book.shelf).toBe('reading');
    expect(book.started_at).toBeTruthy();
    // Kapak yalnızca URL (görsel kopyalanmaz) — Open Library'den türetilir.
    expect(book.cover_url).toContain('covers.openlibrary.org');

    const list = await (await request.get(`${API}/api/okuma/books`, { headers })).json();
    expect(list.counts.reading).toBe(1);
    expect(list.books.length).toBe(1);
  });

  test('oturum günlük puana (dk) yansır', async ({ request }) => {
    const { token } = await registerUser(request, 'okuma-session');
    const headers = auth(token);
    await request.post(`${API}/api/okuma/sessions?date=${TODAY}`, {
      headers,
      data: { duration_min: 25, pages_from: 20, pages_to: 45 },
    });
    const s = await (
      await request.post(`${API}/api/okuma/sessions?date=${TODAY}`, { headers, data: { duration_min: 10 } })
    ).json();
    expect(s.day_total_min).toBe(35);

    const summary = await (await request.get(`${API}/api/summary?date=${TODAY}`, { headers })).json();
    const reading = summary.modules.find((m: { key: string }) => m.key === 'reading');
    expect(reading.value).toBe(35);
    expect(reading.completed).toBe(true); // hedef 30 dk

    const today = await (await request.get(`${API}/api/okuma/sessions?date=${TODAY}`, { headers })).json();
    expect(today.total_min).toBe(35);
    expect(today.total_pages).toBe(25);
  });

  test('süresiz ve sayfasız oturum 422', async ({ request }) => {
    const { token } = await registerUser(request, 'okuma-empty');
    const res = await request.post(`${API}/api/okuma/sessions?date=${TODAY}`, {
      headers: auth(token),
      data: { book_key: 'x' },
    });
    expect(res.status()).toBe(422);
  });

  test('yıllık hedef: varsayılan, ayar ve bitirilen kitaptan türetim', async ({ request }) => {
    const { token } = await registerUser(request, 'okuma-goal');
    const headers = auth(token);
    const year = new Date().getUTCFullYear();

    const def = await (await request.get(`${API}/api/okuma/goal?year=${year}`, { headers })).json();
    expect(def.target_books).toBe(12);
    expect(def.completed_books).toBe(0);
    expect(def.is_custom).toBe(false);

    const set = await (
      await request.put(`${API}/api/okuma/goal?year=${year}`, { headers, data: { target_books: 24 } })
    ).json();
    expect(set.target_books).toBe(24);
    expect(set.is_custom).toBe(true);

    // Kitabı ekleyip bitir → completed_books türetilir.
    await request.post(`${API}/api/okuma/books`, {
      headers,
      data: { title: 'Sefiller', authors: ['Victor Hugo'], isbn13: '9789944888332', shelf: 'reading', source: 'manual' },
    });
    await request.patch(`${API}/api/okuma/books/book_9789944888332`, { headers, data: { shelf: 'finished', rating: 5 } });
    const after = await (await request.get(`${API}/api/okuma/goal?year=${year}`, { headers })).json();
    expect(after.completed_books).toBe(1);

    // Bitmişten çıkarınca sayaç düşer (finished_at temizlenir).
    await request.patch(`${API}/api/okuma/books/book_9789944888332`, { headers, data: { shelf: 'reading' } });
    const back = await (await request.get(`${API}/api/okuma/goal?year=${year}`, { headers })).json();
    expect(back.completed_books).toBe(0);
  });

  test('istatistik bitirilen kitap, süre ve seriyi toplar', async ({ request }) => {
    const { token } = await registerUser(request, 'okuma-stats');
    const headers = auth(token);
    await request.post(`${API}/api/okuma/books`, {
      headers,
      data: { title: 'Beyaz Diş', authors: ['Jack London'], isbn13: '9789944888349', page_count: 220, shelf: 'finished', source: 'manual' },
    });
    await request.post(`${API}/api/okuma/sessions?date=${TODAY}`, { headers, data: { duration_min: 40 } });
    const stats = await (await request.get(`${API}/api/okuma/stats?date=${TODAY}`, { headers })).json();
    expect(stats.finished_count).toBe(1);
    expect(stats.total_minutes).toBe(40);
    expect(stats.top_authors[0].name).toBe('Jack London');
    expect(stats.streak).toBeGreaterThanOrEqual(1);
    expect(stats.monthly.length).toBe(6);
  });

  test('içgörü kural-temelli yapı döner (llm kapalı)', async ({ request }) => {
    const { token } = await registerUser(request, 'okuma-insight');
    const headers = auth(token);
    const insight = await (await request.get(`${API}/api/okuma/insight?date=${TODAY}`, { headers })).json();
    expect(insight.source).toBe('rule');
    expect(insight.headline).toBeTruthy();
    expect(Array.isArray(insight.notes)).toBe(true);
  });

  test('okuma uçları oturum ister', async ({ request }) => {
    for (const path of ['/api/okuma/meta', '/api/okuma/books', '/api/okuma/goal', '/api/okuma/stats']) {
      expect((await request.get(`${API}${path}`)).status()).toBe(401);
    }
  });
});

// Genel kullanıcı profili — vücut bilgileri bir kez girilir; modüller (spor,
// yemek) aynı paylaşılan profili okur (tekrar sormaz) + kilo/BMI timeline.
test.describe('Profil — paylaşılan vücut bilgileri', () => {
  test('boş profil, PUT sonrası BMI ve paylaşım', async ({ request }) => {
    const { token } = await registerUser(request, 'profile');
    const headers = auth(token);

    const empty = await (await request.get(`${API}/api/profile`, { headers })).json();
    expect(empty.has_body_info).toBe(false);

    const set = await (
      await request.put(`${API}/api/profile`, {
        headers,
        data: { age: 30, sex: 'erkek', height_cm: 175, weight_kg: 82, goal: 'ver', target_weight_kg: 75 },
      })
    ).json();
    // BMI = 82 / 1.75^2 = 26.8 → fazla kilolu
    expect(set.bmi).toBe(26.8);
    expect(set.bmi_category).toBe('fazla_kilolu');
    expect(set.age).toBe(30);
    expect(set.has_body_info).toBe(true);

    // Aynı profili spor ve yemek modülleri de görür (paylaşım).
    const spor = await (await request.get(`${API}/api/spor/profile`, { headers })).json();
    expect(spor.height_cm).toBe(175);
    expect(spor.goal).toBe('ver');
    const yemek = await (await request.get(`${API}/api/yemek/profile`, { headers })).json();
    expect(yemek.age).toBe(30);
    expect(yemek.height_cm).toBe(175);
  });

  test('kilo girişleri timeline’a düşer', async ({ request }) => {
    const { token } = await registerUser(request, 'profile-tl');
    const headers = auth(token);
    await request.put(`${API}/api/profile`, { headers, data: { height_cm: 180, weight_kg: 90 } });
    const tl = await (await request.get(`${API}/api/profile/timeline?days=30`, { headers })).json();
    expect(tl.count).toBe(1);
    expect(tl.points[0].weight_kg).toBe(90);
    expect(tl.points[0].bmi).toBe(27.8); // 90 / 1.8^2
  });

  test('profil uçları oturum ister', async ({ request }) => {
    expect((await request.get(`${API}/api/profile`)).status()).toBe(401);
    expect((await request.put(`${API}/api/profile`, { data: { age: 20 } })).status()).toBe(401);
    expect((await request.get(`${API}/api/profile/timeline`)).status()).toBe(401);
  });
});
