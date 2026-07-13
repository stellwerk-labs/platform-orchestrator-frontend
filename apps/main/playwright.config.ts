import { PlaywrightTestConfig } from '@playwright/test';

import ciConfig from './playwright.config.ci';

// Default config for local
// Extend from production config.
const config: PlaywrightTestConfig = {
  ...ciConfig,
  timeout: 60000,
  retries: 0,
  forbidOnly: false,
  workers: 1,
  webServer: {
    ...ciConfig.webServer,
    command: 'pnpm run start',
    env: {
      VITE_PORT: '5200',
      VITE_BASE_URL: 'http://example.com',
      VITE_BASE_WEBSOCKET_URL: 'ws://example.com',
      VITE_GOOGLE_CLIENT_ID: 'test-google-client-id',
      VITE_MICROSOFT_CLIENT_ID: 'test-microsoft-client-id',
    },
  },
  use: {
    ...ciConfig.use,
    // Browser options
    headless: false,
  },
};

export default config;
