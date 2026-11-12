import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, test } from '@playwright/test';

const expect = test.expect;
import { build } from 'vite';

const app = fileURLToPath(new URL('..', import.meta.url));
if (process.argv[2] === '--build') {
  await build({
    configFile: false,
    root: app,
    build: {
      outDir: process.argv[3],
      emptyOutDir: false,
      lib: {
        entry: process.argv[4] || path.join(app, 'src/session/browserSession.ts'),
        formats: ['es'],
        fileName: () => process.argv[5] || 'controller.js',
      },
    },
  });
} else {
  assert.ok(process.env.SESSION_BROWSER_URL, 'Run through the IAM PostgreSQL integration fixture');
  const profile = await mkdtemp(path.join(tmpdir(), 'stellwerk-session-browser-'));
  const browser = await chromium.launchPersistentContext(profile, {
    headless: true,
    ignoreHTTPSErrors: true, // Only the local httptest TLS server uses this context.
  });
  try {
    const page = browser.pages()[0];
    const minimumTimeout = process.env.SESSION_BROWSER_MINIMUM === '1';
    const open = async (target = page) => {
      await target.goto(`${process.env.SESSION_BROWSER_URL}/fixture/new-session`);
      await expect.poll(() => target.evaluate(() => window.sessionState)).toBe('active');
    };
    if (process.env.SESSION_BROWSER_POLICY_REFRESH === '1') {
      await page.clock.install();
      await open();
      await page.clock.pauseAt(new Date());
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await page.evaluate(async () => {
        const response = await fetch('/fixture/policy', { method: 'POST' });
        if (!response.ok) throw new Error('Policy fixture update failed');
      });
      await page.clock.runFor(30001);
      await expect.poll(() => page.evaluate(() => window.sessionState)).toBe('expired');
      assert.equal(await page.evaluate(() => window.activityRequests), 0);
      process.stdout.write(
        'PASS remote policy shortening is detected by read-only status polling\n',
      );
    } else {
      if (!minimumTimeout) {
        await open();
        await page.evaluate(async () => {
          const { sessionCheckMask } = await import('/mask.js');
          const portal = document.createElement('div');
          portal.id = 'private-modal';
          portal.textContent = 'Protected dialog';
          document.body.append(portal);
          const overlay = document.createElement('div');
          overlay.id = 'stellwerk-session-check';
          overlay.textContent = 'Checking session';
          const style = document.createElement('style');
          style.textContent = sessionCheckMask;
          overlay.append(style);
          document.body.append(overlay);
        });
        await expect(page.locator('#private-modal')).not.toBeVisible();
        await expect(page.locator('#stellwerk-session-check')).toBeVisible();
        await page.evaluate(() => document.querySelector('#stellwerk-session-check').remove());
        await expect(page.locator('#private-modal')).toBeVisible();
        process.stdout.write('PASS revalidation masks body portals without unmounting them\n');
        await page.evaluate(() => {
          window.polling = setInterval(() => {
            void fetch('/auth/session');
            document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
          }, 200);
        });
        await expect
          .poll(() => page.evaluate(() => window.sessionState), { timeout: 7000 })
          .toBe('expired');
        assert.equal(
          await page.evaluate(() => window.activityRequests),
          0,
          'polling and synthetic input renewed the session',
        );
        process.stdout.write('PASS idle expiry despite polling and synthetic input\n');

        await open();
        const second = await browser.newPage();
        await second.goto(`${process.env.SESSION_BROWSER_URL}/fixture`);
        await expect.poll(() => second.evaluate(() => window.sessionState)).toBe('active');
        for (let i = 0; i < 12; i++) {
          await second.locator('#input').click();
          await second.locator('#input').press('ArrowRight');
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        assert.equal(await page.evaluate(() => window.sessionState), 'active');
        assert.equal(await second.evaluate(() => window.sessionState), 'active');
        assert.ok((await second.evaluate(() => window.activityRequests)) > 1);
        process.stdout.write('PASS native input and shared session across two tabs\n');
        await expect
          .poll(() => second.evaluate(() => window.sessionState), { timeout: 7000 })
          .toBe('expired');
        await expect
          .poll(() => page.evaluate(() => window.sessionState), { timeout: 3000 })
          .toBe('expired');
        await second.close();
      }

      for (const pluginUrl of JSON.parse(process.env.SESSION_BROWSER_PLUGINS || '[]')) {
        await open();
        await page.evaluate((url) => {
          const iframe = document.createElement('iframe');
          const nonce = crypto.randomUUID();
          const channel = new MessageChannel();
          channel.port1.onmessage = ({ data }) => {
            if (data.type === 'stellwerk.plugin.activity' && data.nonce === nonce)
              window.controller.activity();
          };
          iframe.src = url;
          iframe.onload = () =>
            iframe.contentWindow.postMessage({ nonce }, new URL(url).origin, [channel.port2]);
          document.body.append(iframe);
        }, pluginUrl);
        const input = page.frameLocator('iframe').locator('#plugin-input');
        await input.waitFor();
        await input.evaluate(() => document.dispatchEvent(new PointerEvent('pointermove')));
        assert.equal(await page.evaluate(() => window.activityRequests), 0);
        for (let i = 0; i < (minimumTimeout ? 25 : 12); i++) {
          await input.click();
          await input.press('ArrowRight');
          await new Promise((resolve) => setTimeout(resolve, minimumTimeout ? 80 : 500));
        }
        assert.equal(await page.evaluate(() => window.sessionState), 'active');
        assert.ok((await page.evaluate(() => window.activityRequests)) > 1);
        process.stdout.write(
          `PASS trusted cross-origin plugin input: ${new URL(pluginUrl).pathname}\n`,
        );
      }

      if (!minimumTimeout) {
        await open();
        await page.clock.install();
        await page.clock.pauseAt(new Date());
        await new Promise((resolve) => setTimeout(resolve, 4500));
        await page.clock.runFor(5000);
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await expect.poll(() => page.evaluate(() => window.sessionState)).toBe('expired');
        assert.equal(
          await page.evaluate(() => window.activityRequests),
          0,
          'resuming renewed an expired session',
        );
        process.stdout.write('PASS suspended timers and resume cannot revive an expired session\n');
      }
    }
  } finally {
    await browser.close();
    await rm(profile, { recursive: true, force: true });
  }
}
