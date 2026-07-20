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

    await page.getByTestId('increment').click();
    await expect(page.getByTestId('module-value')).toContainText('1');
    await page.getByTestId('increment').click();
    await expect(page.getByTestId('module-value')).toContainText('2');

    await page.getByTestId('back').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    // The dashboard refetches on mount, so the new value must raise the score.
    await expect(page.getByTestId('score-card')).not.toContainText('0%', { timeout: 30_000 });
  });

  test('sayaç sıfırın altına inmez', async ({ page }) => {
    await registerThroughUi(page, 'floor');

    await page.getByTestId('tile-water').click();
    await expect(page.getByTestId('module-value')).toContainText('0');
    // Guard disables the button at zero rather than letting the value go negative.
    await expect(page.getByTestId('decrement')).toBeDisabled();
  });

  test('hedef tamamlanınca tamamlandı rozeti çıkar', async ({ page }) => {
    await registerThroughUi(page, 'complete');

    await page.getByTestId('tile-brush').click();
    await expect(page.getByTestId('module-screen-brush')).toBeVisible();

    // Brush target is 2 with step 1.
    await page.getByTestId('increment').click();
    await page.getByTestId('increment').click();

    await expect(page.getByText('Bugünlük tamam ✓')).toBeVisible();
  });

  test('geçmiş grafiği 7 gün çizer', async ({ page }) => {
    await registerThroughUi(page, 'chart');
    await page.getByTestId('tile-reading').click();
    await expect(page.getByTestId('history-chart')).toBeVisible();
    await expect(page.getByText('Son 7 gün')).toBeVisible();
  });
});
