import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, test } from '@playwright/test';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import svgr from 'vite-plugin-svgr';

const expect = test.expect;
const app = fileURLToPath(new URL('..', import.meta.url));
if (process.argv[2] === '--build') {
  await build({
    configFile: false,
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    root: app,
    plugins: [react(), svgr()],
    resolve: { tsconfigPaths: true },
    build: {
      outDir: process.argv[3],
      emptyOutDir: false,
      lib: {
        entry: path.join(app, 'scripts/platform-settings-browser.tsx'),
        formats: ['es'],
        fileName: () => 'settings-app.js',
      },
    },
  });
} else {
  const url = process.env.PLATFORM_SETTINGS_BROWSER_URL;
  assert.ok(url, 'Run against the real IAM/Data Plane qualification fixture');
  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400)
        process.stderr.write(`HTTP ${response.status()} ${new URL(response.url()).pathname}\n`);
    });
    const settingsRequests = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/platform-settings/'))
        settingsRequests.push(request.url());
    });
    await page.goto(`${url}/fixture/session?role=none`);
    await expect(page.getByText('Administration is restricted', { exact: true })).toBeVisible();
    assert.equal(settingsRequests.length, 0, 'a denied user fetched installation settings');
    await page.goto(`${url}/fixture/session?role=reader`);
    await expect(page.getByRole('heading', { name: 'Configuration', exact: true })).toBeVisible();
    await expect(page.getByLabel('Console inactivity timeout')).toBeDisabled();
    await expect(page.getByRole('switch', { name: 'Maintenance mode' })).toBeDisabled();
    const forbidden = await context.request.put(`${url}/platform-settings/deployments`, {
      headers: { Origin: url, 'If-Match': '"1"' },
      data: { enabled: true },
    });
    assert.equal(forbidden.status(), 403);
    process.stdout.write('PASS real IAM platform read/write separation and denied GUI gate\n');

    await page.goto(`${url}/fixture/session?role=writer`);
    await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Plugin Manager', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Configuration', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByLabel('Console inactivity timeout')).toBeEnabled();
    await page.getByLabel('Console inactivity timeout').fill('30m');
    await page.getByLabel('CLI user-token lifetime').fill('4h');
    await page.getByRole('button', { name: 'Save session settings' }).click();
    await page.getByRole('button', { name: 'Apply settings', exact: true }).click();
    await expect(page.getByLabel('Console inactivity timeout')).toHaveValue('30m0s');
    await page.reload();
    await expect(page.getByLabel('CLI user-token lifetime')).toHaveValue('4h0m0s');
    process.stdout.write(
      'PASS actual settings form, immediate API update and reload persistence\n',
    );

    await page.getByRole('switch', { name: 'Maintenance mode' }).click();
    await page.getByRole('button', { name: 'Enable maintenance', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Maintenance mode' })).toBeChecked();
    await expect(
      page.getByText('Ready for maintenance. Accepted work has finished and plugins are paused.', {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole('switch', { name: 'Maintenance mode' }).click();
    await page.getByRole('button', { name: 'Resume deployments', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Maintenance mode' })).not.toBeChecked();
    await expect(
      page.getByText('Ready for maintenance. Accepted work has finished and plugins are paused.', {
        exact: true,
      }),
    ).not.toBeVisible();
    await expect(page.getByText('The installation accepts work.', { exact: true })).toBeVisible();
    process.stdout.write(
      'PASS real Core/DP readiness and immediate removal of stale ready after resume\n',
    );
    await page.getByRole('switch', { name: 'Maintenance mode' }).click();
    await page.getByRole('button', { name: 'Enable maintenance', exact: true }).click();
    await page.getByRole('switch', { name: 'Maintenance mode' }).click();
    await expect(
      page.getByRole('button', { name: 'Resume deployments', exact: true }),
    ).toBeVisible();
    const before = await (await context.request.get(`${url}/platform-settings/deployments`)).json();
    const changed = await context.request.put(`${url}/platform-settings/deployments`, {
      headers: { Origin: url, 'If-Match': `"${before.revision}"` },
      data: { enabled: true },
    });
    assert.equal(changed.status(), 200);
    await page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/platform-settings/deployments' &&
        response.request().method() === 'GET',
      { timeout: 15000 },
    );
    await page.getByRole('button', { name: 'Resume deployments', exact: true }).click();
    await expect(
      page.getByText('These settings changed elsewhere. Reload them before saving again.').first(),
    ).toBeVisible();
    const after = await (await context.request.get(`${url}/platform-settings/deployments`)).json();
    assert.equal(after.enabled, true, 'stale modal overwrote another operator revision');
    await page.getByRole('button', { name: 'Reload settings', exact: true }).click();
    process.stdout.write(
      'PASS delayed confirmation cannot overwrite a newer maintenance revision\n',
    );

    const missing = await context.request.put(`${url}/platform-settings/sessions`, {
      headers: { Origin: url },
      data: { browser_idle_timeout: '15m', cli_token_ttl: '2h' },
    });
    assert.equal(missing.status(), 428);
    const invalid = await context.request.put(`${url}/platform-settings/sessions`, {
      headers: { Origin: url, 'If-Match': '"2"' },
      data: { browser_idle_timeout: '0s', cli_token_ttl: '2h' },
    });
    assert.equal(invalid.status(), 400);
    const csrf = await context.request.put(`${url}/platform-settings/sessions`, {
      headers: { Origin: 'https://untrusted.example.test', 'If-Match': '"2"' },
      data: { browser_idle_timeout: '15m', cli_token_ttl: '2h' },
    });
    assert.equal(csrf.status(), 403);
    process.stdout.write(
      'PASS write preconditions, duration validation and cookie-origin protection\n',
    );
    assert.deepEqual(pageErrors, [], 'The settings UI raised an unhandled browser error');
  } finally {
    await context.close();
    await browser.close();
  }
}
