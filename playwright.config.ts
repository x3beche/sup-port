import { defineConfig, devices } from '@playwright/test';

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:8090';

export default defineConfig({
  testDir: './tests',
  // Test paketini production DB'ye karşı çalıştırmayı engeller (bkz. dosya).
  globalSetup: './tests/global-setup.ts',
  // Keep every Playwright artifact under tests/ so the repo root stays clean.
  outputDir: './tests/.artifacts',
  reporter: [['list'], ['html', { outputFolder: './tests/.report', open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1000, height: 1000 } },
    },
  ],
});
