import { PlaywrightTestConfig, ReporterDescription } from '@playwright/test';

const reportList: ReporterDescription[] = [
  ['list'],
  ['json', { outputFile: 'test-reports/mock/test-results.json' }],
  ['html', { outputFolder: 'test-reports/mock', open: 'never' }],
  ['junit', { outputFile: 'test-reports/mock/junit-report.xml' }],
];

const config: PlaywrightTestConfig = {
  reporter: reportList,
  testMatch: '**/playwright/**/?(*.)+(spec|test).[jt]s?(x)',
  workers: 5,
  webServer: {
    command: 'serve -p 5200 -s dist --no-request-logging',
    port: 5200,
    timeout: 60000,
    reuseExistingServer: !process.env.CI,
  },
  forbidOnly: true,
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  use: {
    // Browser options
    headless: true,
    // Context options
    viewport: { width: 1512, height: 1080 },
    ignoreHTTPSErrors: true,
    // enable network traces to debug failed testcases
    trace: 'retain-on-failure',
    // Artifacts
    screenshot: 'only-on-failure',
    video: {
      mode: 'retain-on-failure',
      size: { width: 1024, height: 576 },
    },
    actionTimeout: 10000,
  },
};

export default config;
