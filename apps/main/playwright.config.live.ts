import { defineConfig } from '@playwright/test';

if (
  !process.env.STELLWERK_LIVE_API_URL ||
  !process.env.STELLWERK_LIVE_USER_TOKEN ||
  !process.env.STELLWERK_LIVE_READER_TOKEN ||
  !process.env.STELLWERK_LIVE_ORG
) {
  throw new Error(
    'Live tests require STELLWERK_LIVE_API_URL, STELLWERK_LIVE_USER_TOKEN (Admin), STELLWERK_LIVE_READER_TOKEN (Module read only) and STELLWERK_LIVE_ORG for an isolated acceptance instance.',
  );
}

export default defineConfig({
  testDir: './e2e-live',
  workers: 1,
  forbidOnly: true,
  timeout: 60000,
  reporter: [['list'], ['html', { outputFolder: 'test-reports/live', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:28091',
    headless: true,
    viewport: { width: 1512, height: 1080 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm start --host 127.0.0.1',
    url: 'http://127.0.0.1:28091',
    env: { VITE_PORT: '28091', VITE_BASE_URL: process.env.STELLWERK_LIVE_API_URL },
    reuseExistingServer: false,
  },
});
