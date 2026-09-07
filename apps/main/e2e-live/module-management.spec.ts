import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

const api = process.env.STELLWERK_LIVE_API_URL!;
const org = process.env.STELLWERK_LIVE_ORG!;
const token = process.env.STELLWERK_LIVE_USER_TOKEN!;
const readerToken = process.env.STELLWERK_LIVE_READER_TOKEN!;

test('real Module publication, promotion, comparison and lifecycle evidence', async ({
  page,
  request,
  browser,
}, testInfo) => {
  const network: string[] = [];
  page.on('response', (response) => {
    if (response.url().startsWith(api)) {
      network.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  page.on('requestfailed', (failedRequest) => {
    network.push(
      `FAILED ${new URL(failedRequest.url()).pathname}: ${failedRequest.failure()?.errorText}`,
    );
  });
  const moduleId = `release-ui-${randomUUID()}`;
  const root = `${api}/orgs/${org}`;
  const headers = { Authorization: `Bearer ${token}`, 'Idempotency-Key': randomUUID() };
  const resource = await request.post(`${root}/resource-types`, {
    headers,
    data: {
      id: moduleId,
      is_developer_accessible: true,
      output_schema: { type: 'object', properties: { name: { type: 'string' } } },
      module_contract: {
        type: 'object',
        properties: {
          module_inputs: {
            type: 'object',
            required: ['color'],
            properties: { color: { type: 'string', minLength: 1 } },
          },
        },
      },
    },
  });
  expect(resource.status()).toBe(201);
  const catalogue = await request.post(`${root}/module-catalogue`, {
    headers,
    data: { slug: moduleId, resource_type: moduleId, display_name: 'Release Demo Service' },
  });
  expect(catalogue.status()).toBe(201);
  // Continue real requests with the real user's token. No API responses are mocked.
  await page.route(`${api}/**`, (route) =>
    route.continue({ headers: { ...route.request().headers(), Authorization: `Bearer ${token}` } }),
  );
  await page.goto(`/orgs/${org}/modules/${moduleId}/versions`);
  try {
    await expect(
      page.getByRole('button', { name: 'Publish Module Version', exact: true }),
    ).toBeVisible();
  } finally {
    await testInfo.attach('initial-api-statuses', {
      body: network.join('\n'),
      contentType: 'text/plain',
    });
  }
  const publish = async (version: string, color: string, external = false) => {
    await page.getByRole('button', { name: 'Publish Module Version', exact: true }).click();
    await page.getByLabel('Complete Module Version definition', { exact: true }).fill(
      JSON.stringify({
        semantic_version: version,
        ...(external
          ? {
              module_source: 'git::https://example.invalid/release-demo.git?ref=reviewed-release',
              source_revision: 'reviewed-release',
            }
          : {
              module_source: 'inline',
              module_source_code:
                'variable "color" { type = string }\noutput "name" { value = var.color }',
            }),
        module_inputs: { color },
        module_params: {},
        dependencies: {},
        coprovisioned: [],
        provider_mapping: {},
        output_schema: { type: 'object', properties: { name: { type: 'string' } } },
        release_notes: `Release ${version}: ${color} service configuration`,
      }),
    );
    await page.getByRole('button', { name: 'Publish Proposed version', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: version })).toContainText('proposed');
  };
  const promote = async (version: string) => {
    await page
      .getByRole('row')
      .filter({ hasText: version })
      .getByRole('button', { name: 'Promote to Default' })
      .click();
    const promotionDialog = page.getByRole('dialog');
    await promotionDialog.getByRole('textbox').fill(`Release review approved ${version}`);
    await promotionDialog.getByRole('button', { name: 'Promote to Default', exact: true }).click();
    await expect(promotionDialog).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: version })).toContainText('default');
  };
  await publish('1.0.0', 'blue');
  await promote('1.0.0');
  await publish('1.1.0', 'green');
  await page.screenshot({ path: testInfo.outputPath('module-history.png'), fullPage: true });
  await page
    .getByRole('row')
    .filter({ hasText: '1.0.0' })
    .getByRole('button', { name: 'Compare', exact: true })
    .click();
  await page.getByRole('combobox', { name: 'Version to compare' }).click();
  await page.getByTitle('1.1.0', { exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('blue');
  await expect(page.getByRole('dialog')).toContainText('green');
  await page.screenshot({ path: testInfo.outputPath('module-comparison.png'), fullPage: true });
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await promote('1.1.0');
  await expect(page.getByRole('row').filter({ hasText: '1.0.0' })).toContainText('deprecated');
  await page
    .getByRole('row')
    .filter({ hasText: '1.1.0' })
    .getByRole('button', { name: 'Evidence', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('Release review approved 1.1.0');
  await page.screenshot({ path: testInfo.outputPath('module-evidence.png'), fullPage: true });
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await page
    .getByRole('row')
    .filter({ hasText: '1.1.0' })
    .getByRole('button', { name: 'Mark Defective', exact: true })
    .click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('Reject the current release during acceptance');
  await dialog.getByRole('button', { name: 'Mark Defective', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const predecessor = page.getByRole('row').filter({ hasText: '1.0.0' });
  await expect(
    predecessor.getByRole('button', { name: 'Restore previous Default', exact: true }),
  ).toBeEnabled();
  await predecessor.getByRole('button', { name: 'Restore previous Default', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('Restore the exact predecessor after failed release');
  await dialog.getByRole('button', { name: 'Restore previous Default', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(predecessor).toContainText('default');

  // Publication checks declarations, not external artifact availability or verification.
  await publish('1.2.0', 'amber', true);
  const optionalDigest = await request.get(`${root}/modules/${moduleId}/versions/1.2.0`, {
    headers,
  });
  expect(optionalDigest.status()).toBe(200);
  const optionalDigestVersion = await optionalDigest.json();
  // The existing read contract uses an empty string for an absent digest claim.
  expect(optionalDigestVersion.version.artifact_digest).toBe('');
  expect(optionalDigestVersion.version.verification_status).toBe('unverified');
  expect(optionalDigestVersion.definition.output_schema).toEqual({
    type: 'object',
    properties: { name: { type: 'string' } },
  });

  const readContext = await browser.newContext();
  try {
    const readPage = await readContext.newPage();
    await readPage.route(`${api}/**`, (route) =>
      route.continue({
        headers: { ...route.request().headers(), Authorization: `Bearer ${readerToken}` },
      }),
    );
    await readPage.goto(`http://127.0.0.1:28091/orgs/${org}/modules/${moduleId}/versions`);
    await expect(readPage.getByRole('row').filter({ hasText: '1.0.0' })).toContainText('default');
    await expect(
      readPage.getByRole('button', { name: 'Publish Module Version', exact: true }),
    ).toBeDisabled();
    await expect(
      readPage.getByRole('button', { name: 'Archive Module', exact: true }),
    ).toBeDisabled();
    for (const version of ['1.0.0', '1.2.0']) {
      await expect(
        readPage
          .getByRole('row')
          .filter({ hasText: version })
          .getByRole('button', { name: 'Mark Defective', exact: true }),
      ).toBeDisabled();
    }
    await readPage.screenshot({
      path: testInfo.outputPath('module-read-only.png'),
      fullPage: true,
    });
    const denied = await request.post(
      `${root}/modules/${moduleId}/versions/1.0.0/actions/mark-defective`,
      {
        headers: { Authorization: `Bearer ${readerToken}`, 'Idempotency-Key': randomUUID() },
        data: {
          expected_resource_version: 1,
          reason: 'Read-only access must not mutate lifecycle',
        },
      },
    );
    expect(denied.status()).toBe(403);
  } finally {
    await readContext.close();
  }
  await expect(page.getByRole('link', { name: 'Progressive rollouts', exact: true })).toHaveCount(
    0,
  );
  await page.goto(`/orgs/${org}/resource-types/${moduleId}/schema`);
  await expect(page.getByRole('heading', { name: 'Module publication contract' })).toBeVisible();
  await expect(page.getByText('module_inputs:', { exact: false })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('resource-type-contract.png'),
    fullPage: true,
  });
});
