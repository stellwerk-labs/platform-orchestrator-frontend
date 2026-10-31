import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import type {
  CoreModuleVersion,
  ModuleDraftPublication,
  ModuleDraftTestSnapshot,
  StableModuleVersionSuccessorResult,
} from '../src/models/v2/controlplane';

const api = process.env.STELLWERK_LIVE_API_URL!;
const org = process.env.STELLWERK_LIVE_ORG!;
const token = process.env.STELLWERK_LIVE_USER_TOKEN!;
const readerToken = process.env.STELLWERK_LIVE_READER_TOKEN!;
const project = process.env.STELLWERK_DRAFT_PROJECT_ID;
const envType = process.env.STELLWERK_DRAFT_ENV_TYPE;
const outputSchema = {
  type: 'object',
  properties: { name: { type: 'string' } },
  required: ['name'],
};
const headers = () => ({ Authorization: `Bearer ${token}`, 'Idempotency-Key': randomUUID() });
const definition = (label: string) => ({
  semantic_version: '1.0.0',
  resource_type_version: 1,
  module_source: 'inline',
  module_source_code: `output "name" { value = "${label}" }`,
  module_inputs: {},
  module_params: {},
  provider_mapping: {},
  dependencies: {},
  coprovisioned: [],
  output_schema: outputSchema,
});

test('real Draft editing, captured execution, publication and interface retention', async ({
  page,
  request,
  browser,
}, testInfo) => {
  test.skip(
    !project || !envType,
    'requires a disposable Project and Environment Type with a real Runner',
  );
  test.setTimeout(90000);
  const module = `draft-ui-${randomUUID().slice(0, 8)}`;
  const base = `${api}/orgs/${org}`;
  const traffic: string[] = [];
  page.on('response', (response) => {
    if (response.url().startsWith(api))
      traffic.push(
        `${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`,
      );
  });
  const type = await request.post(`${base}/resource-types`, {
    headers: headers(),
    data: { id: module, output_schema: outputSchema },
  });
  expect(type.status()).toBe(201);
  expect(
    (
      await request.post(`${base}/module-catalogue`, {
        headers: headers(),
        data: { slug: module, resource_type: module },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.post(`${base}/projects/${project}/envs`, {
        headers: headers(),
        data: { id: module, env_type_id: envType },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.post(`${base}/module-rules`, {
        headers: headers(),
        data: { module_id: module, project_id: project, env_id: module },
      })
    ).status(),
  ).toBe(201);
  // Only authentication is supplied by the harness. All API responses and Runner
  // outcomes come from the actual isolated installation.
  await page.route(`${api}/**`, (route) =>
    route.continue({ headers: { ...route.request().headers(), Authorization: `Bearer ${token}` } }),
  );
  try {
    await page.goto(`/orgs/${org}/modules/${module}/drafts`);
    await page
      .getByLabel('Complete Draft definition', { exact: true })
      .fill(JSON.stringify(definition('A')));
    await page.getByLabel('Draft operation reason').fill('Review A before publication');
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/modules/${module}/drafts`) &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
    expect((await saved).status()).toBe(201);
    await expect(page.getByRole('heading', { name: 'Draft revision 1 (open)' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Test Environment' }).click();
    await page.getByText(`${project} / ${module}`, { exact: true }).click();
    const captured = page.waitForResponse(
      (response) =>
        response.url().endsWith('/test-snapshots') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Capture reviewed revision', exact: true }).click();
    const snapshotA: ModuleDraftTestSnapshot = await (await captured).json();
    await expect(page.getByLabel('Captured immutable definition')).toHaveValue(/value = \\"A\\"/);
    const manifest = {
      shared: {},
      workloads: {
        check: {
          resources: { message: { type: module } },
          outputs: { TEST_VALUE: `\${resources.message.outputs.name}` },
        },
      },
    };
    await page.getByLabel('Test deployment manifest').fill(JSON.stringify(manifest));
    const started = page.waitForResponse(
      (response) =>
        response.url().endsWith('/module-test-deployments') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Run captured test', exact: true }).click();
    const deploymentA = await (await started).json();
    await expect(page.getByText('Test execution: succeeded', { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await page
      .getByLabel('Complete Draft definition', { exact: true })
      .fill(JSON.stringify(definition('B')));
    await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Draft revision 2 (open)' })).toBeVisible();
    await expect(page.getByLabel('Captured test UUID')).toHaveValue(snapshotA.id);
    const captureB = page.waitForResponse(
      (response) =>
        response.url().endsWith('/test-snapshots') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Capture reviewed revision', exact: true }).click();
    const snapshotB: ModuleDraftTestSnapshot = await (await captureB).json();
    expect(snapshotB.id).not.toBe(snapshotA.id);
    expect(snapshotB.draft_revision).toBe(2);
    const startedB = page.waitForResponse(
      (response) =>
        response.url().endsWith('/module-test-deployments') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Run captured test', exact: true }).click();
    const deploymentB = await (await startedB).json();
    expect(deploymentB.id).not.toBe(deploymentA.id);
    await expect(page.getByText('Test execution: succeeded', { exact: true })).toBeVisible({
      timeout: 30000,
    });
    const repeated = page.waitForResponse(
      (response) =>
        response.url().endsWith('/module-test-deployments') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Run captured test', exact: true }).click();
    const repeatedB = await (await repeated).json();
    expect(repeatedB.id).not.toBe(deploymentB.id);
    await expect(page.getByRole('link', { name: 'Open Deployment', exact: true })).toHaveAttribute(
      'href',
      new RegExp(repeatedB.id),
    );
    await expect(page.getByText('Test execution: succeeded', { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await page.getByRole('button', { name: 'Read revision', exact: true }).click();
    await expect(page.getByLabel('Historical Draft definition')).toHaveValue(/value = \\"A\\"/);
    await page.getByRole('button', { name: 'Publish reviewed revision', exact: true }).click();
    const publishedResponse = page.waitForResponse(
      (response) => response.url().endsWith('/publish') && response.request().method() === 'POST',
    );
    await page.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
    const published: ModuleDraftPublication = await (await publishedResponse).json();
    expect(published.version.lifecycle_status).toBe('proposed');
    expect(published.version.uuid).not.toBe(snapshotB.id);
    expect(published.draft.id).toBe(snapshotB.draft_id);
    await expect(page.getByRole('heading', { name: 'Draft revision 3 (published)' })).toBeVisible();
    expect(
      traffic.filter(
        (line) => line.endsWith('/module-test-deployments') && /^(200|201|202) POST /.test(line),
      ),
    ).toHaveLength(3);
    const readerContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
    try {
      const reader = await readerContext.newPage();
      await reader.route(`${api}/**`, (route) =>
        route.continue({
          headers: { ...route.request().headers(), Authorization: `Bearer ${readerToken}` },
        }),
      );
      await reader.goto(`/orgs/${org}/modules/${module}/drafts`);
      await expect(
        reader.getByRole('button', { name: 'Start a Draft', exact: true }),
      ).toBeDisabled();
      await reader.getByRole('button', { name: `Open ${published.draft.id}`, exact: true }).click();
      await expect(reader.getByLabel('Complete Draft definition', { exact: true })).toHaveAttribute(
        'readonly',
        '',
      );
      const denied = await request.post(
        `${base}/projects/${project}/envs/${module}/modules/${module}/drafts/${snapshotB.draft_id}/test-snapshots`,
        {
          headers: { Authorization: `Bearer ${readerToken}`, 'Idempotency-Key': randomUUID() },
          data: {
            expected_resource_version: 2,
            reason: 'Reader must not capture new executable material',
          },
        },
      );
      expect(denied.status()).toBe(403);
    } finally {
      await readerContext.close();
    }
    await page.goto(`/orgs/${org}/resource-types/${module}/versions`);
    await page.getByRole('button', { name: 'Read interface 1', exact: true }).click();
    await page.getByRole('button', { name: 'Publish interface version', exact: true }).click();
    await page
      .getByLabel('Interface output schema')
      .fill(
        JSON.stringify({
          ...outputSchema,
          properties: { name: { type: 'string' }, endpoint: { type: 'string' } },
        }),
      );
    await page
      .getByLabel('Interface publication reason')
      .fill('Add an optional endpoint while retaining version one');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Publish interface', exact: true })
      .click();
    await expect(page.getByRole('button', { name: 'Read interface 2', exact: true })).toBeVisible();
    const v1 = await request.get(`${base}/resource-types/${module}/versions/1`, {
      headers: headers(),
    });
    expect((await v1.json()).output_schema).toEqual(outputSchema);
    const retained = await request.get(
      `${base}/modules/${module}/versions/${published.version.uuid}`,
      { headers: headers() },
    );
    expect((await retained.json()).definition.resource_type_version).toBe(1);
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.screenshot({
      path: testInfo.outputPath('interface-history.png'),
      fullPage: true,
      animations: 'disabled',
    });
    const deprecate = await request.post(
      `${base}/modules/${module}/versions/${published.version.uuid}/actions/deprecate`,
      {
        headers: headers(),
        data: {
          expected_resource_version: published.version.resource_version,
          reason: 'Continue interface two publication qualification',
        },
      },
    );
    expect(deprecate.status()).toBe(200);
    await page.goto(`/orgs/${org}/modules/${module}/versions`);
    await page.getByRole('button', { name: 'Publish Module Version', exact: true }).click();
    const v2Definition = {
      ...definition('C'),
      semantic_version: '1.1.0-rc.1',
      resource_type_version: 2,
      module_source_code:
        'output "name" { value = "C" }\noutput "endpoint" { value = "example.test" }',
      output_schema: {
        ...outputSchema,
        properties: { name: { type: 'string' }, endpoint: { type: 'string' } },
      },
    };
    await page
      .getByLabel('Complete Module Version definition', { exact: true })
      .fill(JSON.stringify(v2Definition));
    const explicitPublication = page.waitForResponse(
      (response) =>
        response.url().endsWith('/version-publications') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Publish Proposed version', exact: true }).click();
    const prerelease: CoreModuleVersion = await (await explicitPublication).json();
    expect(prerelease.resource_type_version).toBe(2);
    await expect(page.getByRole('dialog')).toBeHidden();
    await page
      .getByRole('row')
      .filter({ hasText: '1.1.0-rc.1' })
      .getByRole('button', { name: 'Publish stable successor', exact: true })
      .click();
    await expect(page.getByLabel('Complete stable Module Version definition')).toHaveValue(
      /"resource_type_version": 2/,
    );
    await page
      .getByRole('dialog')
      .getByRole('textbox')
      .first()
      .fill('Graduate the exact interface two candidate');
    const stablePublication = page.waitForResponse(
      (response) =>
        response.url().endsWith('/successor-publications') &&
        response.request().method() === 'POST',
    );
    await page
      .getByRole('button', { name: 'Publish and deprecate prerelease', exact: true })
      .click();
    const stable: StableModuleVersionSuccessorResult = await (await stablePublication).json();
    expect(stable.stable.resource_type_version).toBe(2);
    expect(stable.prerelease.lifecycle_status).toBe('deprecated');
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.screenshot({
      path: testInfo.outputPath('interface-two-successor.png'),
      fullPage: true,
      animations: 'disabled',
    });
  } finally {
    await testInfo.attach('real-api-statuses', {
      body: traffic.join('\n'),
      contentType: 'text/plain',
    });
    // Environment teardown follows normal Runner destroy. Retained authoring,
    // interface and published catalogue history belongs to the isolated fixture.
    const deletion = await request.delete(
      `${base}/projects/${project}/envs/${module}?deleteRules=true`,
      { headers: headers() },
    );
    expect([200, 202, 204]).toContain(deletion.status());
    await expect
      .poll(
        async () =>
          (
            await request.get(`${base}/projects/${project}/envs/${module}`, { headers: headers() })
          ).status(),
        { timeout: 20000 },
      )
      .toBe(404);
  }
});

test('a stale Console editor cannot replace a newer stored Draft revision', async ({
  page,
  request,
}) => {
  const module = `draft-cas-${randomUUID().slice(0, 8)}`;
  const base = `${api}/orgs/${org}`;
  expect(
    (
      await request.post(`${base}/resource-types`, {
        headers: headers(),
        data: { id: module, output_schema: outputSchema },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.post(`${base}/module-catalogue`, {
        headers: headers(),
        data: { slug: module, resource_type: module },
      })
    ).status(),
  ).toBe(201);
  const response = await request.post(`${base}/modules/${module}/drafts`, {
    headers: headers(),
    data: { definition: definition('A'), reason: 'Start concurrent authoring review' },
  });
  expect(response.status()).toBe(201);
  const draft = await response.json();
  await page.route(`${api}/**`, (route) =>
    route.continue({ headers: { ...route.request().headers(), Authorization: `Bearer ${token}` } }),
  );
  await page.goto(`/orgs/${org}/modules/${module}/drafts`);
  await page.getByRole('button', { name: `Open ${draft.id}`, exact: true }).click();
  const changed = await request.put(`${base}/modules/${module}/drafts/${draft.id}`, {
    headers: headers(),
    data: {
      definition: definition('B'),
      expected_resource_version: 1,
      reason: 'A second client saved B',
    },
  });
  expect(changed.status()).toBe(200);
  await page
    .getByLabel('Complete Draft definition', { exact: true })
    .fill(JSON.stringify(definition('C')));
  await page.getByLabel('Draft operation reason').fill('Try stale C without replacing B');
  const rejected = page.waitForResponse(
    (reply) => reply.url().endsWith(`/drafts/${draft.id}`) && reply.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  expect((await rejected).status()).toBe(409);
  await expect(page.getByLabel('Complete Draft definition', { exact: true })).toHaveValue(
    JSON.stringify(definition('C')),
  );
  const stored = await request.get(`${base}/modules/${module}/drafts/${draft.id}`, {
    headers: headers(),
  });
  expect((await stored.json()).definition.module_source_code).toBe(
    definition('B').module_source_code,
  );
  await page.getByRole('button', { name: 'Reload stored Draft', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Draft revision 2 (open)' })).toBeVisible();
  await expect(page.getByLabel('Complete Draft definition', { exact: true })).toHaveValue(
    /value = \\"B\\"/,
  );
  await page.getByRole('button', { name: 'Discard Draft', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Draft revision 3 (discarded)' })).toBeVisible();
});
