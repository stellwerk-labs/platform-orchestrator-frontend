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
        entry: path.join(app, 'scripts/native-controls-browser.tsx'),
        formats: ['es'],
        fileName: () => 'native-controls.js',
        cssFileName: 'native-controls',
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
          '<html><head><link rel="stylesheet" href="/native-controls.css"></head><body><div id="root"></div><script type="module" src="/native-controls.js"></script></body></html>',
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
    const posts = [];
    let reads = 0;
    let failPost = true;
    let outcome = 'pending';
    const progress = {
      definition: { id: 'reviewed', name: 'Reviewed', version: 1, strategy: 'reviewed', steps: [] },
      available_controls: ['approve', 'deny', 'cancel'],
      progress: {
        id: 'deployment',
        environment_id: 'environment',
        phase: 'awaiting_approval',
        created_at: '',
        revision: 7,
        subject: 'a'.repeat(64),
        infrastructure_applied: false,
        plan_changes: { add: 1, change: 2, remove: 3 },
      },
    };
    const receipt = () => ({
      id: 'control',
      deployment_id: 'deployment',
      actor_id: 'actor',
      action: 'approve',
      status: outcome === 'pending' ? 'pending' : 'resolved',
      created_at: '2026-11-21T00:00:00Z',
      expires_at: '2026-11-21T00:01:00Z',
      ...(outcome === 'pending'
        ? {}
        : {
            result: {
              version: 'stellwerk.pipeline.control-result/v1',
              control_id: 'control',
              rollout_id: 'deployment',
              request_digest: 'b'.repeat(64),
              execution_digest: 'c'.repeat(64),
              outcome,
              code: outcome === 'refused' ? 'approval_subject_conflict' : '',
              phase: 'approved',
              revision: 8,
            },
          }),
    });
    await page.route('**/orgs/org/deployments/**', async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith('/pipeline')) return route.fulfill({ json: progress });
      if (pathname.endsWith('/pipeline/controls') && request.method() === 'POST') {
        posts.push({ key: request.headers()['idempotency-key'], body: request.postDataJSON() });
        return route.fulfill({
          status: failPost ? 503 : 202,
          json: failPost ? { message: 'PRIVATE UPSTREAM PAYLOAD' } : receipt(),
        });
      }
      if (pathname.endsWith('/pipeline/controls/control')) {
        reads += 1;
        return route.fulfill({ json: receipt() });
      }
      return route.fulfill({ status: 404, json: {} });
    });
    const confirm = async () => {
      await page.getByRole('button', { name: 'Approve local plan', exact: true }).click();
      const modal = page.getByRole('dialog', { name: 'Confirm Native pipeline control' });
      await expect(modal.getByLabel('Resource changes')).toHaveText('1 add2 change3 destroy');
      const colors = await modal
        .getByLabel('Resource changes')
        .locator('.ant-tag')
        .evaluateAll((tags) => tags.map((tag) => getComputedStyle(tag).color));
      assert.equal(
        new Set(colors).size,
        3,
        'nonzero additions, changes and destruction keep distinct colors',
      );
      await modal.getByRole('button', { name: 'Send request' }).click();
    };
    await page.goto(url);
    await confirm();
    await expect(page.getByText(/request or receipt could not be confirmed/)).toBeVisible();
    await expect(page.getByText('PRIVATE UPSTREAM PAYLOAD')).toHaveCount(0);
    await page.reload();
    failPost = false;
    await page.getByRole('button', { name: 'Retry same request' }).click();
    await expect(page.getByText('Request accepted, awaiting site confirmation')).toBeVisible();
    assert.equal(posts.length, 2);
    assert.deepEqual(posts[0], posts[1]);
    assert.deepEqual(posts[0].body, { action: 'approve', subject: 'a'.repeat(64) });
    await expect(page.getByRole('button', { name: 'Deny local plan' })).toBeDisabled();
    await expect(page.getByText('Approval decision confirmed')).toHaveCount(0);
    outcome = 'applied';
    await expect(page.getByText('Approval decision confirmed')).toBeVisible();
    await expect(
      page.getByText(/Deployment progress reports the infrastructure outcome/),
    ).toBeVisible();
    const terminalReads = reads;
    await page.waitForTimeout(1200);
    assert.equal(reads, terminalReads, 'terminal receipts stop polling');
    process.stdout.write(
      'PASS frontend-only exact retry, reload recovery, pending/confirmed receipt, safe error and modal colors\n',
    );

    await page.evaluate(() => sessionStorage.clear());
    outcome = 'refused';
    await page.reload();
    await confirm();
    await expect(page.getByText('Control request refused')).toBeVisible();
    await expect(page.getByText('The site is no longer awaiting this exact plan.')).toBeVisible();
    assert.notEqual(posts.at(-1).key, posts[0].key);
    outcome = 'pending';
    await confirm();
    await expect(page.getByText('Request accepted, awaiting site confirmation')).toBeVisible();
    await page.getByRole('button', { name: 'Toggle fixture permission' }).click();
    await expect(page.getByText('Request accepted, awaiting site confirmation')).toHaveCount(0);
    assert.equal(await page.evaluate(() => sessionStorage.length), 0);
    const deniedReads = reads;
    await page.waitForTimeout(1200);
    assert.equal(reads, deniedReads, 'permission loss stops polling');
    await page.getByRole('button', { name: 'Leave fixture deployment' }).click();
    await expect(page.getByText('Fixture deployment closed')).toBeVisible();
    process.stdout.write(
      'PASS frontend-only refusal, fresh intent key, role-change cleanup and navigation\n',
    );

    await page.evaluate(() => sessionStorage.clear());
    await page.clock.install();
    await page.reload();
    const beforePolling = reads;
    const getReadCount = () => reads;
    await confirm();
    await expect(page.getByText('Request accepted, awaiting site confirmation')).toBeVisible();
    await expect.poll(getReadCount).toBe(beforePolling + 1);
    for (let poll = 1; poll < 30; poll += 1) {
      await page.clock.runFor(1001);
      await expect.poll(getReadCount).toBe(beforePolling + poll + 1);
    }
    await expect(page.getByRole('button', { name: 'Check request status' })).toBeEnabled();
    const boundedReads = reads;
    await page.clock.runFor(60_000);
    assert.equal(reads, boundedReads, 'pending receipt polling stops after one bounded sweep');
    await expect(page.getByText('Request accepted, awaiting site confirmation')).toBeVisible();
    await expect(page.getByText('Control request refused')).toHaveCount(0);
    process.stdout.write(
      'PASS frontend-only bounded pending sweep leaves expired silence unconfirmed\n',
    );

    await page.evaluate(() => sessionStorage.clear());
    progress.progress.plan_changes = { add: 0, change: 0, remove: 0 };
    await page.reload();
    await page.getByRole('button', { name: 'Approve local plan', exact: true }).click();
    const counts = page.getByRole('dialog').getByLabel('Resource changes');
    await expect(counts).toHaveText('0 add0 change0 destroy');
    const neutral = await counts
      .locator('.ant-tag')
      .evaluateAll((tags) => tags.map((tag) => getComputedStyle(tag).color));
    assert.equal(new Set(neutral).size, 1, 'zero resource changes all remain neutral');
    process.stdout.write('PASS frontend-only zero counts remain neutral inside confirmation\n');
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
