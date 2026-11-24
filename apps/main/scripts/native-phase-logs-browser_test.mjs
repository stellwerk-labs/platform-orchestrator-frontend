import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, test } from '@playwright/test';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import svgr from 'vite-plugin-svgr';

const app = fileURLToPath(new URL('..', import.meta.url));
const output = process.argv[3];
assert.ok(output, 'Pass --build or --run and an isolated output directory');
if (process.argv[2] === '--build') {
  await build({
    configFile: false,
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    root: app,
    plugins: [react(), svgr()],
    resolve: { tsconfigPaths: true },
    build: {
      outDir: output,
      emptyOutDir: false,
      lib: {
        entry: path.join(app, 'scripts/native-phase-logs-browser.tsx'),
        formats: ['es'],
        fileName: () => 'native-phase-logs.js',
        cssFileName: 'native-phase-logs',
      },
    },
  });
} else {
  assert.equal(process.argv[2], '--run');
  const fixture = createServer(async (request, response) => {
    try {
      const name = new URL(request.url, 'http://127.0.0.1').pathname.slice(1);
      if (!name) {
        response.setHeader('Content-Type', 'text/html');
        response.end(
          '<html><head><link rel="stylesheet" href="/native-phase-logs.css"></head><body><div id="root"></div><script type="module" src="/native-phase-logs.js"></script></body></html>',
        );
      } else if (/^[a-zA-Z0-9_.-]+\.(js|css)$/.test(name)) {
        response.setHeader('Content-Type', name.endsWith('.css') ? 'text/css' : 'text/javascript');
        response.end(await readFile(path.join(output, name)));
      } else {
        response.statusCode = 404;
        response.end();
      }
    } catch {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${fixture.address().port}`;
  let browser;
  let page;
  let failure;
  try {
    browser = await chromium.launch();
    page = await browser.newPage();
    const expect = test.expect;
    const requests = [];
    let transferred = false;
    const capture = (phase, revision) => ({
      status: 'pending_transfer',
      authority: {
        phase,
        execution_id: phase === 'plan' ? 'source' : 'child',
        capture_revision: revision,
        subject: phase === 'plan' ? 'a'.repeat(64) : undefined,
        inherited: phase === 'plan',
        source_plan_id: 'source',
      },
    });
    const pipeline = () => ({
      native_logs: true,
      source_plan_id: 'source',
      definition: {
        id: 'apply-saved',
        version: 1,
        name: 'Saved plan',
        strategy: 'apply_saved',
        steps: [],
      },
      progress: {
        id: 'child',
        environment_id: 'environment',
        revision: 9,
        created_at: '',
        phase: 'completed',
        infrastructure_applied: true,
        subject: 'a'.repeat(64),
        log_capture: capture('plan', 2),
        log_references: transferred
          ? [capture('plan', 2), capture('plan', 1), capture('apply', 3)]
          : [],
      },
    });
    await page.route('**/orgs/org/deployments/**', async (route) => {
      const address = new URL(route.request().url());
      if (address.pathname.endsWith('/pipeline')) return route.fulfill({ json: pipeline() });
      if (address.pathname.endsWith('/actions/get-logs')) {
        requests.push(Object.fromEntries(address.searchParams));
        return route.fulfill({
          contentType: 'text/plain',
          body: `PRIVATE ${address.searchParams.get('phase')} capture ${address.searchParams.get('capture_revision')} <img src=x onerror=alert(1)>`,
        });
      }
      return route.fulfill({ status: 404, json: {} });
    });
    await page.goto(url);
    await expect(page.getByText(/Pending transfer/)).toBeVisible();
    assert.equal(requests.length, 0, 'pending capture never fetches a fabricated site route');
    transferred = true;
    await page.reload();
    const logs = page.getByLabel('Runner logs');
    await expect(logs).toContainText('PRIVATE plan capture 2');
    await expect(page.getByRole('link', { name: 'View source Plan logs' })).toBeVisible();
    await expect(page.getByText(/did not execute a new Plan/)).toBeVisible();
    assert.deepEqual(requests.at(-1), {
      decrypt: 'true',
      phase: 'plan',
      execution_id: 'source',
      capture_revision: '2',
      subject: 'a'.repeat(64),
    });
    await expect(logs.locator('img')).toHaveCount(0);
    assert.equal((await logs.locator('xpath=ancestor::*[@data-amp-mask]').count()) > 0, true);
    await page.getByRole('button', { name: 'Show raw logs' }).click();
    await expect(logs).toContainText('<img src=x onerror=alert(1)>');
    await page.getByRole('button', { name: 'Clear logs' }).click();
    await expect(page.getByLabel('Runner logs')).toHaveCount(0);
    await page.getByRole('button', { name: 'Reload logs' }).click();
    await expect(logs).toContainText('PRIVATE plan capture 2');
    const captureSelector = page.getByRole('combobox', { name: 'Log capture', exact: true });
    await captureSelector.press('ArrowDown');
    await expect(captureSelector).toHaveAttribute('aria-expanded', 'true');
    const earlierCapture = page
      .locator('.ant-select-dropdown:visible')
      .getByText('source, capture 1', { exact: true });
    await expect(earlierCapture).toHaveCount(1);
    await earlierCapture.click();
    await expect(page.locator('.ant-select-selection-item')).toHaveText('source, capture 1');
    await expect(logs).toContainText('PRIVATE plan capture 1');
    await page.getByText('Apply logs', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Apply logs' })).toBeChecked();
    await expect(logs).toContainText('PRIVATE apply capture 3');
    assert.equal(requests.at(-1).subject, undefined);
    assert.equal(
      await page.evaluate(() => localStorage.length + sessionStorage.length),
      0,
      'plaintext is kept in component memory',
    );
    await page.getByRole('button', { name: 'Toggle fixture permission' }).click();
    await expect(page.getByLabel('Runner logs')).toHaveCount(0);
    const before = requests.length;
    await page.waitForTimeout(300);
    assert.equal(requests.length, before);
    await page.getByRole('button', { name: 'Leave fixture deployment' }).click();
    await expect(page.getByText('Fixture deployment closed')).toBeVisible();
    process.stdout.write(
      'PASS frontend-only normal Native Logs phase/capture/subject, pending/available, inherited source, masking, raw/reload/clear, permission/navigation clearing\n',
    );
  } catch (error) {
    failure = { error };
    try {
      await page?.screenshot({ path: path.join(output, 'failure.png'), timeout: 5000 });
    } catch {
      process.stderr.write('Failure screenshot unavailable\n');
    }
  } finally {
    try {
      await browser?.close();
    } catch (error) {
      failure ??= { error };
      process.stderr.write('Browser cleanup failed\n');
    } finally {
      try {
        const closed = new Promise((resolve, reject) =>
          fixture.close((error) => (error ? reject(error) : resolve())),
        );
        fixture.closeAllConnections();
        await closed;
      } catch (error) {
        failure ??= { error };
        process.stderr.write('HTTP fixture cleanup failed\n');
      }
    }
  }
  if (failure) throw failure.error;
}
