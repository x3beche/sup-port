import { expect, test } from '@playwright/test';

// Galaxy S23: 1080x2340 physical at DPR 3 => 360x780 logical CSS pixels.
const S23_WIDTH = 360;
const S23_HEIGHT = 780;

test.describe('S23 çerçevesi', () => {
  test('çerçeve sayfası uygulamayı iframe içinde gösterir', async ({ page }) => {
    await page.goto('/s23.html');

    const phone = page.locator('.phone');
    await expect(phone).toBeVisible();
    await expect(page.locator('.camera')).toBeVisible();
    await expect(page.getByText('Galaxy S23')).toBeVisible();

    // The app must actually be embedded, not merely linked.
    const frame = page.frameLocator('iframe');
    await expect(frame.getByText('Hello World')).toBeVisible({ timeout: 30_000 });
    await expect(frame.getByText('sup-port')).toBeVisible();
  });

  test('iframe tam olarak S23 mantıksal çözünürlüğünde', async ({ page }) => {
    await page.goto('/s23.html');

    const iframe = page.locator('iframe');
    await expect(iframe).toBeVisible();

    const box = await iframe.boundingBox();
    expect(box).not.toBeNull();

    // The stage scales down on short windows, so compare the unscaled layout size.
    const size = await iframe.evaluate((el) => ({
      width: el.clientWidth,
      height: el.clientHeight,
    }));
    expect(size).toEqual({ width: S23_WIDTH, height: S23_HEIGHT });
  });

  test('uygulama iframe dışına taşmıyor', async ({ page }) => {
    await page.goto('/s23.html');

    const frame = page.frameLocator('iframe');
    await expect(frame.getByText('Hello World')).toBeVisible({ timeout: 30_000 });

    const overflow = await page.locator('iframe').evaluate((el) => {
      const doc = (el as HTMLIFrameElement).contentDocument!;
      return {
        scrollWidth: doc.documentElement.scrollWidth,
        clientWidth: doc.documentElement.clientWidth,
      };
    });
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });

  test('kök adres çerçevesiz uygulamayı verir', async ({ page }) => {
    // Guards the distinction that caused confusion: "/" is the bare app,
    // "/s23.html" is the framed view.
    await page.goto('/');
    await expect(page.getByText('Hello World')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.phone')).toHaveCount(0);
  });
});
