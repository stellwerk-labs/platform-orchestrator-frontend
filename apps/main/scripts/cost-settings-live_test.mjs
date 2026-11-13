import assert from 'node:assert/strict';

import { chromium, test } from '@playwright/test';

const expect = test.expect;
const url = process.env.PLATFORM_SETTINGS_BROWSER_URL;
assert.ok(url, 'Run against the real IAM/Data Plane qualification fixture');
const endpoint = `${url}/platform-settings/cost-estimation`;
const fixtureKey = 'infracost-fixture-key-not-a-live-credential';
const browser = await chromium.launch();
const context = await browser.newContext({ ignoreHTTPSErrors: true });

try {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const estimates = page.getByRole('switch', { name: 'Infrastructure cost estimates' });
  const key = page.getByLabel('Infracost API key');
  const remove = page.getByRole('checkbox', { name: 'Remove saved API key' });
  const save = page.getByRole('button', { name: 'Save cost settings' });
  const read = async () => {
    const response = await context.request.get(endpoint);
    assert.equal(response.status(), 200);
    const raw = await response.text();
    assert.ok(!raw.includes(fixtureKey));
    const value = JSON.parse(raw);
    assert.ok(!('api_key' in value));
    assert.equal(response.headers().etag, `"${value.revision}"`);
    assert.equal(response.headers()['cache-control'], 'no-store');
    return value;
  };
  const write = (values, revision, extraHeaders = {}) =>
    context.request.put(endpoint, {
      headers: { Origin: url, 'If-Match': `"${revision}"`, ...extraHeaders },
      data: values,
    });
  const submit = async (values, revision, status = 200) => {
    const responsePromise = page.waitForResponse(
      (candidate) => candidate.url() === endpoint && candidate.request().method() === 'PUT',
    );
    await save.click();
    const response = await responsePromise;
    assert.equal(response.status(), status);
    assert.deepEqual(response.request().postDataJSON(), values);
    assert.equal(response.request().headers()['if-match'], `"${revision}"`);
    assert.ok(!(await response.text()).includes(fixtureKey));
  };

  await page.goto(`${url}/fixture/session?role=none`);
  assert.equal((await context.request.get(endpoint)).status(), 403);
  await page.goto(`${url}/fixture/session?role=reader`);
  await expect(estimates).toBeDisabled();
  await expect(key).toBeDisabled();
  await expect(save).toBeDisabled();
  assert.equal((await write({ enabled: false }, 1)).status(), 403);
  process.stdout.write('PASS cost settings actual IAM read/write separation\n');

  await page.goto(`${url}/fixture/session?role=writer`);
  let policy = await read();
  assert.equal(policy.enabled, false);
  assert.equal(policy.api_key_configured, false);
  await estimates.click();
  await expect(save).toBeDisabled();
  assert.equal((await write({ enabled: true }, policy.revision)).status(), 400);
  await key.fill(fixtureKey);
  await submit({ enabled: true, api_key: fixtureKey }, policy.revision);
  await expect(key).toHaveValue('');
  await page.reload();
  await expect(estimates).toBeChecked();
  await expect(key).toHaveValue('');
  policy = await read();
  assert.equal(policy.api_key_configured, true);
  process.stdout.write('PASS key write-only storage, enablement and cleared password field\n');

  await estimates.click();
  await submit({ enabled: false }, policy.revision);
  await page.reload();
  policy = await read();
  assert.equal(policy.enabled, false);
  assert.equal(policy.api_key_configured, true);
  await key.fill(`${fixtureKey}-replacement`);
  await submit({ enabled: false, api_key: `${fixtureKey}-replacement` }, policy.revision);
  await expect(key).toHaveValue('');
  policy = await read();
  assert.equal(policy.api_key_configured, true);
  await estimates.click();
  await submit({ enabled: true }, policy.revision);
  policy = await read();
  await remove.check();
  await expect(save).toBeDisabled();
  await estimates.click();
  await submit({ enabled: false, api_key: '' }, policy.revision);
  await page.reload();
  policy = await read();
  assert.equal(policy.api_key_configured, false);
  await expect(remove).toHaveCount(0);
  process.stdout.write('PASS key preserve, rotation, disable and explicit removal\n');

  await key.fill('bad key');
  await submit({ enabled: false, api_key: 'bad key' }, policy.revision, 400);
  await expect(key).toHaveValue('');
  await page.getByRole('button', { name: 'Reload settings', exact: true }).click();
  await expect(save).toBeEnabled();
  await expect(key).toHaveValue('');
  assert.equal((await read()).revision, policy.revision);
  process.stdout.write('PASS failed credential write clears input and unchanged reload recovers\n');

  assert.equal((await write({ enabled: false }, policy.revision)).status(), 200);
  await submit({ enabled: false }, policy.revision, 412);
  await expect(
    page.getByText('These settings changed elsewhere. Reload them before saving again.').first(),
  ).toBeVisible();
  await expect(save).toBeDisabled();
  await expect(key).toBeDisabled();
  await page.getByRole('button', { name: 'Reload settings', exact: true }).click();
  await expect(save).toBeEnabled();
  process.stdout.write('PASS stale revision requires reload\n');

  policy = await read();
  for (const invalid of [
    {},
    { enabled: null },
    { enabled: false, arbitrary: true },
    { enabled: false, api_key: null },
    { enabled: false, api_key: 42 },
    { enabled: false, api_key: 'bad key' },
    { enabled: false, api_key: 'bad\nkey' },
    { enabled: false, api_key: 'x'.repeat(4097) },
  ]) {
    assert.equal((await write(invalid, policy.revision)).status(), 400);
  }
  assert.equal(
    (
      await context.request.put(endpoint, { headers: { Origin: url }, data: { enabled: false } })
    ).status(),
    428,
  );
  assert.equal(
    (
      await write({ enabled: false }, policy.revision, { Origin: 'https://untrusted.example.test' })
    ).status(),
    403,
  );
  assert.deepEqual(errors, [], 'The cost settings UI raised an unhandled browser error');
  process.stdout.write(
    'PASS strict write-only credential body and cookie-origin/precondition rules\n',
  );
} finally {
  await context.close();
  await browser.close();
}
