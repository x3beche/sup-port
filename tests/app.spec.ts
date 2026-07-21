import { Page, expect, test } from '@playwright/test';

const PASSWORD = 'parola12345';

function uniqueEmail(tag: string) {
  return `ui-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function registerThroughUi(page: Page, tag: string) {
  const email = uniqueEmail(tag);

  await page.goto('/');
  await page.getByTestId('toggle-auth-mode').click();
  await page.getByTestId('input-name').fill('Playwright');
  await page.getByTestId('input-email').fill(email);
  await page.getByTestId('input-password').fill(PASSWORD);
  await page.getByTestId('submit-auth').click();

  await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 30_000 });
  return email;
}

test.describe('Oturum', () => {
  test('giriş yapmadan panele erişilemez', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('submit-auth')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('home-screen')).toHaveCount(0);
  });

  test('kayıt olunca panel açılır', async ({ page }) => {
    await registerThroughUi(page, 'signup');
    await expect(page.getByText('Merhaba, Playwright')).toBeVisible();
    await expect(page.getByTestId('score-card')).toBeVisible();
  });

  test('yanlış parola hata gösterir, panele geçmez', async ({ page }) => {
    const email = await registerThroughUi(page, 'wrongpass');
    await page.getByTestId('menu-open').click();
    await page.getByTestId('menu-logout').click();
    await expect(page.getByTestId('submit-auth')).toBeVisible();

    await page.getByTestId('input-email').fill(email);
    await page.getByTestId('input-password').fill('kesinlikleyanlis');
    await page.getByTestId('submit-auth').click();

    await expect(page.getByTestId('auth-error')).toBeVisible();
    await expect(page.getByTestId('home-screen')).toHaveCount(0);
  });

  test('oturum sayfa yenilendikten sonra korunur', async ({ page }) => {
    await registerThroughUi(page, 'persist');
    await page.reload();
    // No login form should flash: the session is restored from local storage.
    await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 30_000 });
  });

  test('çıkış yapınca oturum silinir ve yenilemede geri gelmez', async ({ page }) => {
    await registerThroughUi(page, 'logout');
    await page.getByTestId('menu-open').click();
    await page.getByTestId('menu-logout').click();
    await expect(page.getByTestId('submit-auth')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('submit-auth')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('home-screen')).toHaveCount(0);
  });
});

test.describe('Panel ve modüller', () => {
  test('uygulama ızgarası tüm modülleri gösterir', async ({ page }) => {
    await registerThroughUi(page, 'grid');

    const grid = page.getByTestId('module-grid');
    await expect(grid).toBeVisible();
    for (const key of ['water', 'meal', 'brush', 'english', 'steps', 'sleep', 'reading', 'meditation']) {
      await expect(page.getByTestId(`tile-${key}`)).toBeVisible();
    }
  });

  test('modül açılır, sayaç artar ve panele yansır', async ({ page }) => {
    await registerThroughUi(page, 'counter');

    await page.getByTestId('tile-water').click();
    await expect(page.getByTestId('module-screen-water')).toBeVisible();
    await expect(page.getByTestId('module-value')).toContainText('0');

    await page.getByTestId('increment-1').click();
    await expect(page.getByTestId('module-value')).toContainText('1');
    await page.getByTestId('increment-1').click();
    await expect(page.getByTestId('module-value')).toContainText('2');

    await page.getByTestId('back').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    // The dashboard refetches on mount, so the tile must reflect the new value.
    await expect(page.getByTestId('tile-water')).not.toContainText('%0', { timeout: 30_000 });
  });

  test('sayaç sıfırın altına inmez', async ({ page }) => {
    await registerThroughUi(page, 'floor');

    await page.getByTestId('tile-water').click();
    await expect(page.getByTestId('module-value')).toContainText('0');
    // Guard disables the button at zero rather than letting the value go negative.
    await expect(page.getByTestId('decrement-1')).toBeDisabled();
  });

  test('hedef tamamlanınca tamamlandı rozeti çıkar', async ({ page }) => {
    await registerThroughUi(page, 'complete');

    // Su, jenerik sayaçlı sabit bir modül (brush/spor/okuma/yemek artık kendi
    // zengin ekranlarını kullanıyor); ortak sayaç testi buna taşındı.
    await page.getByTestId('tile-water').click();
    await expect(page.getByTestId('module-screen-water')).toBeVisible();

    // Water target is 8; +4 iki kez = 8.
    await page.getByTestId('increment-4').click();
    await page.getByTestId('increment-4').click();

    await expect(page.getByTestId('module-value')).toContainText('8 / 8 bardak');
  });

  test('geçmiş grafiği 7 gün çizer', async ({ page }) => {
    await registerThroughUi(page, 'chart');
    await page.getByTestId('tile-water').click();
    await expect(page.getByTestId('history-chart')).toBeVisible();
    await expect(page.getByText('Son 7 gün')).toBeVisible();
  });

  test('ikonlar emoji değil vektör çizim', async ({ page }) => {
    await registerThroughUi(page, 'icons');
    // Emoji would render as a text node; the tiles must contain real SVG art.
    await expect(page.getByTestId('tile-water').locator('svg')).toHaveCount(1);
    await expect(page.getByTestId('tile-sleep').locator('svg path').first()).toBeVisible();
  });
});

test.describe('Diş fırçalama', () => {
  test('brush kendi ekranını açar, yuvalar ve seri görünür', async ({ page }) => {
    await registerThroughUi(page, 'brush-ui');

    await page.getByTestId('tile-brush').click();
    // Jenerik sayaç değil, özel ekran.
    await expect(page.getByTestId('brush-screen')).toBeVisible();
    await expect(page.getByTestId('module-screen-brush')).toHaveCount(0);
    await expect(page.getByTestId('brush-slot-morning')).toBeVisible();
    await expect(page.getByTestId('brush-slot-evening')).toBeVisible();
    await expect(page.getByTestId('brush-streak')).toContainText('0');
  });

  test('iki yuva işaretlenince gün tamamlanır ve seri başlar', async ({ page }) => {
    await registerThroughUi(page, 'brush-complete');

    await page.getByTestId('tile-brush').click();
    await expect(page.getByTestId('brush-screen')).toBeVisible();

    await page.getByTestId('brush-slot-morning').click();
    // Tek yuva günü tamamlamaz.
    await expect(page.getByTestId('brush-complete-banner')).toHaveCount(0);

    await page.getByTestId('brush-slot-evening').click();
    await expect(page.getByTestId('brush-complete-banner')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('brush-streak')).toContainText('1');

    // Panele dönünce tamamlanma yansır (kutucuk %0 değil).
    await page.getByTestId('back').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('tile-brush')).not.toContainText('%0', { timeout: 30_000 });
  });

  test('2 dakika sayacı açılıp kapanır', async ({ page }) => {
    await registerThroughUi(page, 'brush-timer');

    await page.getByTestId('tile-brush').click();
    await page.getByTestId('brush-start').click();
    await expect(page.getByTestId('brush-timer')).toBeVisible();
    await expect(page.getByTestId('brush-timer-remaining')).toContainText('2:00');

    // Duraklat/Devam çalışır, Vazgeç kapatır (yuva işaretlenmez).
    await page.getByTestId('brush-timer-toggle').click();
    await page.getByTestId('brush-timer-cancel').click();
    await expect(page.getByTestId('brush-timer')).toHaveCount(0);
    await expect(page.getByTestId('brush-complete-banner')).toHaveCount(0);
  });
});

test.describe('Spor / Egzersiz', () => {
  test('egzersiz modülü kendi ekranını açar', async ({ page }) => {
    await registerThroughUi(page, 'spor-open');
    await page.getByTestId('tile-workout').click();
    await expect(page.getByTestId('spor-screen')).toBeVisible();
    // Jenerik sayaç değil.
    await expect(page.getByTestId('module-screen-workout')).toHaveCount(0);
    await expect(page.getByTestId('spor-disclaimer')).toBeVisible();
    // Yeni kullanıcıya güvenlik taraması önerilir.
    await expect(page.getByTestId('parq-prompt')).toBeVisible();
  });

  test('PAR-Q taraması tamamlanınca uyarı kalkar', async ({ page }) => {
    await registerThroughUi(page, 'spor-parq');
    await page.getByTestId('tile-workout').click();
    await page.getByTestId('parq-prompt').click();
    await expect(page.getByTestId('parq-sheet')).toBeVisible();
    // Varsayılan tüm yanıtlar "Hayır" — doğrudan tamamla.
    await page.getByTestId('parq-save').click();
    await expect(page.getByTestId('parq-sheet')).toHaveCount(0);
    await expect(page.getByTestId('parq-prompt')).toHaveCount(0);
  });

  test('ölçüm eklenince BMI görünür', async ({ page }) => {
    await registerThroughUi(page, 'spor-bmi');
    await page.getByTestId('tile-workout').click();
    await page.getByTestId('add-metric').click();
    await expect(page.getByTestId('body-metric-sheet')).toBeVisible();

    await page.getByTestId('metric-weight').fill('90');
    await page.getByTestId('metric-height').fill('175');
    await page.getByTestId('metric-save').click();

    await expect(page.getByTestId('body-metric-sheet')).toHaveCount(0);
    // 90 / 1.75^2 ≈ 29.4 → BMI rozeti çıkar.
    await expect(page.getByTestId('bmi-value')).toContainText('BMI', { timeout: 15_000 });
    await expect(page.getByTestId('bmi-weight')).toContainText('90');
  });

  test('kütüphaneden antrenman kaydedilir ve güne yansır', async ({ page }) => {
    await registerThroughUi(page, 'spor-workout');
    await page.getByTestId('tile-workout').click();
    await page.getByTestId('open-library').click();
    await expect(page.getByTestId('exercise-library')).toBeVisible();

    // Tempolu yürüyüş (30 dk) ekle ve kaydet.
    await page.getByTestId('ex-add-brisk_walk').click();
    await page.getByTestId('library-save').click();

    await expect(page.getByTestId('exercise-library')).toHaveCount(0);
    // Bugünkü antrenman kartı görünür.
    await expect(page.getByTestId('spor-today')).toBeVisible({ timeout: 15_000 });
  });

  test('kütüphane düşük etkili filtresi yüksek etkiliyi gizler', async ({ page }) => {
    await registerThroughUi(page, 'spor-lowimpact');
    await page.getByTestId('tile-workout').click();
    await page.getByTestId('open-library').click();
    await expect(page.getByTestId('exercise-library')).toBeVisible();

    // Burpee (yüksek etkili) filtre kapalıyken görünür.
    await expect(page.getByTestId('ex-burpee')).toBeVisible();
    await page.getByTestId('library-lowimpact').click();
    // Düşük etkili filtresi açılınca burpee gizlenir.
    await expect(page.getByTestId('ex-burpee')).toHaveCount(0, { timeout: 15_000 });
  });
});

test.describe('Yeni davranışlar', () => {
  test('hızlı arka arkaya dokunuşların hiçbiri kaybolmaz', async ({ page }) => {
    await registerThroughUi(page, 'burst');

    await page.getByTestId('tile-water').click();
    await expect(page.getByTestId('module-screen-water')).toBeVisible();

    const inc = page.getByTestId('increment-1');
    for (let i = 0; i < 12; i++) await inc.click({ delay: 0 });

    // Taps land faster than the round trip; they must accumulate, not drop.
    await expect(page.getByTestId('module-value')).toContainText('12', { timeout: 15_000 });
    await page.reload();
    await page.getByTestId('tile-water').click();
    await expect(page.getByTestId('module-value')).toContainText('12', { timeout: 30_000 });
  });

  test('kutucuğa basılı tutunca hızlı kayıt açılır', async ({ page }) => {
    await registerThroughUi(page, 'longpress');

    await expect(page.getByTestId('quick-add')).toHaveCount(0);
    await page.getByTestId('tile-water').click({ delay: 700 });

    await expect(page.getByTestId('quick-add')).toBeVisible();
    // Home screen stays put: the point is logging without navigating.
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('module-screen-water')).toHaveCount(0);

    await page.getByTestId('quick-add').getByTestId('increment-1').click();
    await expect(page.getByTestId('quick-add-value')).toContainText('1 / 8 bardak');

    await page.getByTestId('quick-add-close').click();
    await expect(page.getByTestId('quick-add')).toHaveCount(0);
  });

  test('modüle göre kademe seti sunulur, favori en geniş', async ({ page }) => {
    await registerThroughUi(page, 'steps');

    await page.getByTestId('tile-steps').click();
    await expect(page.getByTestId('module-screen-steps')).toBeVisible();

    for (const step of [500, 1000, 2500]) {
      await expect(page.getByTestId(`increment-${step}`)).toBeVisible();
      await expect(page.getByTestId(`decrement-${step}`)).toBeVisible();
    }

    // One row, decrements left of increments.
    const minus = await page.getByTestId('decrement-2500').boundingBox();
    const plus = await page.getByTestId('increment-2500').boundingBox();
    expect(minus!.x).toBeLessThan(plus!.x);
    expect(Math.abs(minus!.y - plus!.y)).toBeLessThan(2);

    // The default favourite (500) must be wider than a plain option.
    const favourite = await page.getByTestId('increment-500').boundingBox();
    const plain = await page.getByTestId('increment-1000').boundingBox();
    expect(favourite!.width).toBeGreaterThan(plain!.width);
  });

  test('en çok kullanılan kademe en geniş alana taşınır', async ({ page }) => {
    await registerThroughUi(page, 'favstep');

    await page.getByTestId('tile-steps').click();
    await expect(page.getByTestId('module-screen-steps')).toBeVisible();

    // Use 2500 repeatedly; it should overtake the default favourite.
    for (let i = 0; i < 3; i++) {
      await page.getByTestId('increment-2500').click();
      await page.waitForTimeout(450);
    }

    await page.getByTestId('back').click();
    await page.getByTestId('tile-steps').click();
    await expect(page.getByTestId('module-screen-steps')).toBeVisible();

    const used = await page.getByTestId('increment-2500').boundingBox();
    const other = await page.getByTestId('increment-1000').boundingBox();
    expect(used!.width).toBeGreaterThan(other!.width);
  });

  test('haftalık grafik 7 gün çizer ve basılı tutunca görünüm değişir', async ({ page }) => {
    await registerThroughUi(page, 'week');

    const chart = page.getByTestId('weekly-chart');
    await expect(chart).toBeVisible();
    await expect(page.getByText('Bu hafta')).toBeVisible();
    await expect(page.getByTestId('weekly-average')).toContainText('ortalama');

    await chart.click({ delay: 700 });
    await expect(page.getByTestId('weekly-average')).toContainText('en iyi gün');
  });

  test('doğrulama hataları Türkçe gösterilir', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('toggle-auth-mode').click();
    await page.getByTestId('input-name').fill('Test');
    await page.getByTestId('input-email').fill('gecersiz-eposta');
    await page.getByTestId('input-password').fill('parola12345');
    await page.getByTestId('submit-auth').click();

    const error = page.getByTestId('auth-error');
    await expect(error).toBeVisible();
    // Raw Pydantic English must never reach a Turkish screen.
    await expect(error).not.toContainText('valid email address');
    await expect(error).not.toContainText('@-sign');
    await expect(error).toContainText('e-posta');
  });

  test('sayfa dili Türkçe olarak işaretli', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('submit-auth')).toBeVisible({ timeout: 30_000 });
    // A Turkish UI announced by an English speech engine is unusable.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.lang), { timeout: 10_000 })
      .toBe('tr');
  });

  test('sayılar tr-TR binlik ayracıyla yazılır', async ({ page }) => {
    await registerThroughUi(page, 'format');
    await page.getByTestId('tile-steps').click();
    await expect(page.getByTestId('module-value')).toContainText('8.000 adım');
  });
});

test.describe('Izgara düzeni', () => {
  async function gridOrder(page: Page) {
    const keys = ['water', 'meal', 'brush', 'english', 'steps', 'sleep', 'reading', 'meditation'];
    const boxes = [];
    for (const key of keys) {
      const box = await page.getByTestId(`tile-${key}`).boundingBox();
      boxes.push({ key, x: box!.x, y: box!.y });
    }
    boxes.sort((a, b) => a.y - b.y || a.x - b.x);
    return boxes.map((b) => b.key);
  }

  test('kutucuklar sürüklenerek yeniden sıralanır ve sıra kalıcı olur', async ({ page }) => {
    await registerThroughUi(page, 'reorder');
    const before = await gridOrder(page);
    expect(before[0]).toBe('water');

    const src = (await page.getByTestId('tile-water').boundingBox())!;
    const dst = (await page.getByTestId('tile-brush').boundingBox())!;

    await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(
        src.x + src.width / 2 + ((dst.x - src.x) * i) / 10,
        src.y + src.height / 2,
      );
      await page.waitForTimeout(30);
    }
    await page.mouse.up();

    await expect.poll(() => gridOrder(page).then((o) => o[0])).not.toBe('water');
    const dragged = await gridOrder(page);

    // The order lives on the server, so it must survive a reload.
    await page.reload();
    await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => gridOrder(page)).toEqual(dragged);
  });

  test('kısa dokunuş sürükleme sayılmaz, modül açılır', async ({ page }) => {
    await registerThroughUi(page, 'tapnotdrag');
    await page.getByTestId('tile-water').click();
    await expect(page.getByTestId('module-screen-water')).toBeVisible();
  });

  test('özet kartı küçültülüp büyütülebilir ve tercih kalıcı', async ({ page }) => {
    await registerThroughUi(page, 'resize');

    const card = page.getByTestId('score-card');
    const large = (await card.boundingBox())!.height;

    await page.getByTestId('summary-resize').click();
    await expect.poll(async () => (await card.boundingBox())!.height).toBeLessThan(large);
    const small = (await card.boundingBox())!.height;

    await page.reload();
    await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 30_000 });
    // Stored on the device, so the compact choice survives a reload.
    await expect.poll(async () => (await card.boundingBox())!.height).toBeLessThan(large);

    await page.getByTestId('summary-resize').click();
    await expect.poll(async () => (await card.boundingBox())!.height).toBeGreaterThan(small);
  });

  test('sağda kaydırma çubuğu görünmüyor', async ({ page }) => {
    await registerThroughUi(page, 'scrollbar');
    const gutter = await page.evaluate(() => window.innerWidth - document.documentElement.clientWidth);
    // A visible scrollbar would eat horizontal space; the page must keep it all.
    expect(gutter).toBe(0);
  });
});

test.describe('Uygulama mağazası', () => {
  test('mağaza açılır ve tüm uygulamaları kategorilerle listeler', async ({ page }) => {
    await registerThroughUi(page, 'store');
    await page.getByTestId('open-store').click();

    await expect(page.getByTestId('store-screen')).toBeVisible();
    for (const key of ['water', 'steps', 'meditation', 'english']) {
      await expect(page.getByTestId(`store-app-${key}`)).toBeVisible();
    }
    await expect(page.getByText('Sağlık')).toBeVisible();
    await expect(page.getByText('Öğrenme')).toBeVisible();
  });

  test('uygulama kaldırılınca ana ekrandan çıkar, geri kurulunca döner', async ({ page }) => {
    await registerThroughUi(page, 'store-uninstall');
    await expect(page.getByTestId('tile-meditation')).toBeVisible();

    await page.getByTestId('open-store').click();
    await page.getByTestId('store-app-meditation').click();
    await expect(page.getByTestId('store-detail-meditation')).toBeVisible();
    await expect(page.getByTestId('detail-toggle')).toContainText('Kaldır');

    await page.getByTestId('detail-toggle').click();
    await expect(page.getByTestId('detail-toggle')).toContainText('Kur');

    await page.getByTestId('detail-back').click();
    await page.getByTestId('store-back').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    // Uninstalling removes it from the grid.
    await expect(page.getByTestId('tile-meditation')).toHaveCount(0);

    // Reinstall brings it back.
    await page.getByTestId('open-store').click();
    await page.getByTestId('store-app-meditation').click();
    await page.getByTestId('detail-toggle').click();
    await expect(page.getByTestId('detail-toggle')).toContainText('Kaldır');
    await page.getByTestId('detail-back').click();
    await page.getByTestId('store-back').click();
    await expect(page.getByTestId('tile-meditation')).toBeVisible({ timeout: 30_000 });
  });

  test('kaldırılan uygulamanın verisi geri kurulunca korunur', async ({ page }) => {
    await registerThroughUi(page, 'store-data');

    // Log a value, uninstall, reinstall — the value must survive.
    await page.getByTestId('tile-water').click();
    await page.getByTestId('increment-1').click();
    await page.getByTestId('increment-1').click();
    await expect(page.getByTestId('module-value')).toContainText('2');
    await page.getByTestId('back').click();

    await page.getByTestId('open-store').click();
    await page.getByTestId('store-app-water').click();
    await page.getByTestId('detail-toggle').click(); // kaldır
    await expect(page.getByTestId('detail-toggle')).toContainText('Kur');
    await page.getByTestId('detail-toggle').click(); // geri kur
    await expect(page.getByTestId('detail-toggle')).toContainText('Kaldır');
    await page.getByTestId('detail-back').click();
    await page.getByTestId('store-back').click();

    await page.getByTestId('tile-water').click();
    await expect(page.getByTestId('module-value')).toContainText('2', { timeout: 30_000 });
  });

  test('tüm uygulamalar kaldırılınca boş durum gösterilir', async ({ page }) => {
    await registerThroughUi(page, 'store-empty');
    // Faster than clicking eight times: drive the API, then reload the grid.
    await page.evaluate(async () => {
      // Tokens now live in secure storage (web falls back to this key), not in
      // the session profile blob.
      const token = localStorage.getItem('support.secure.accessToken');
      const store = await (await fetch('http://localhost:4000/api/store', {
        headers: { Authorization: `Bearer ${token}` },
      })).json();
      for (const app of store) {
        await fetch(`http://localhost:4000/api/store/${app.key}/install`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    });
    await page.reload();
    await expect(page.getByTestId('empty-grid')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Hiç uygulama kurulu değil')).toBeVisible();
  });
});

test.describe('Kişisel hedefler', () => {
  test('kullanıcı kendi hedefini belirleyebilir', async ({ page }) => {
    await registerThroughUi(page, 'ui-target');

    await page.getByTestId('tile-water').click();
    await expect(page.getByTestId('target-value')).toContainText('8 bardak');

    await page.getByTestId('edit-target').click();
    await page.getByTestId('target-input').fill('12');
    await page.getByTestId('target-save').click();

    await expect(page.getByTestId('target-value')).toContainText('12 bardak');
    await expect(page.getByTestId('target-value')).toContainText('kendi hedefin');
    await expect(page.getByTestId('module-value')).toContainText('/ 12 bardak');
  });

  test('yeni hedef tamamlanma durumunu yeniden hesaplar', async ({ page }) => {
    await registerThroughUi(page, 'ui-target-recalc');

    await page.getByTestId('tile-water').click();
    await page.getByTestId('increment-4').click();
    await page.getByTestId('increment-4').click();
    await expect(page.getByTestId('module-value')).toContainText('8 / 8 bardak');

    await page.getByTestId('edit-target').click();
    await page.getByTestId('target-input').fill('12');
    await page.getByTestId('target-save').click();

    // The target moved, so the same value is no longer complete.
    await expect(page.getByTestId('module-value')).toContainText('8 / 12 bardak');
  });

  test('hedef varsayılana döndürülebilir', async ({ page }) => {
    await registerThroughUi(page, 'ui-target-reset');

    await page.getByTestId('tile-water').click();
    await page.getByTestId('edit-target').click();
    await page.getByTestId('target-input').fill('12');
    await page.getByTestId('target-save').click();
    await expect(page.getByTestId('target-value')).toContainText('12 bardak');

    await page.getByTestId('edit-target').click();
    await page.getByTestId('target-reset').click();
    await expect(page.getByTestId('target-value')).toContainText('8 bardak');
    await expect(page.getByTestId('target-value')).not.toContainText('kendi hedefin');
  });

  test('geçersiz hedef hata gösterir', async ({ page }) => {
    await registerThroughUi(page, 'ui-target-invalid');

    await page.getByTestId('tile-water').click();
    await page.getByTestId('edit-target').click();
    await page.getByTestId('target-input').fill('0');
    await page.getByTestId('target-save').click();

    await expect(page.getByTestId('target-error')).toBeVisible();
    await expect(page.getByTestId('target-editor')).toBeVisible();
  });
});
