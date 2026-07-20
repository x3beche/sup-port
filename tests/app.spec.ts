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
    await page.getByTestId('logout').click();
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
    await page.getByTestId('logout').click();
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

    await page.getByTestId('tile-brush').click();
    await expect(page.getByTestId('module-screen-brush')).toBeVisible();

    // Brush target is 2 with step 1.
    await page.getByTestId('increment-1').click();
    await page.getByTestId('increment-1').click();

    await expect(page.getByTestId('module-value')).toContainText('2 / 2 kez');
  });

  test('geçmiş grafiği 7 gün çizer', async ({ page }) => {
    await registerThroughUi(page, 'chart');
    await page.getByTestId('tile-reading').click();
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

test.describe('Kişisel hedefler', () => {
  test('kullanıcı kendi hedefini belirleyebilir', async ({ page }) => {
    await registerThroughUi(page, 'ui-target');

    await page.getByTestId('tile-brush').click();
    await expect(page.getByTestId('target-value')).toContainText('2 kez');

    await page.getByTestId('edit-target').click();
    await page.getByTestId('target-input').fill('5');
    await page.getByTestId('target-save').click();

    await expect(page.getByTestId('target-value')).toContainText('5 kez');
    await expect(page.getByTestId('target-value')).toContainText('kendi hedefin');
    await expect(page.getByTestId('module-value')).toContainText('/ 5 kez');
  });

  test('yeni hedef tamamlanma durumunu yeniden hesaplar', async ({ page }) => {
    await registerThroughUi(page, 'ui-target-recalc');

    await page.getByTestId('tile-brush').click();
    await page.getByTestId('increment-1').click();
    await page.getByTestId('increment-1').click();
    await expect(page.getByTestId('module-value')).toContainText('2 / 2 kez');

    await page.getByTestId('edit-target').click();
    await page.getByTestId('target-input').fill('4');
    await page.getByTestId('target-save').click();

    // The target moved, so the same value is no longer complete.
    await expect(page.getByTestId('module-value')).toContainText('2 / 4 kez');
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
