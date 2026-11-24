import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AXIOS_INSTANCE } from '@src/custom-instance';
import { getGetEnvironmentQueryKey } from '@src/hooks/react-query/v2/controlplane/environment/environment';
import { getCheckPermissionsQueryKey } from '@src/hooks/react-query/v2/iam/user/user';
import { RBACPermission } from '@src/hooks/useRBAC';
import { server } from '@src/testing-utils/mswServer';

import { CreatePipelineDeployment, parseDeploymentManifest } from './CreatePipelineDeployment';

const originalBase = AXIOS_INSTANCE.defaults.baseURL;
let clients: QueryClient[] = [];
let submitted: Record<string, unknown>[] = [];
let compatible = true;
let publishedOnly = false;
const fixture = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  if (request.method === 'GET') {
    response.end(
      JSON.stringify({
        ...(publishedOnly
          ? {
              policy: {
                enabled: true,
                resource_version: 1,
                allowed_version_ids: ['published-version'],
              },
            }
          : {}),
        items: publishedOnly
          ? [
              {
                id: 'published-version',
                pipeline_id: 'published-pipeline',
                version: 3,
                name: 'Published reviewed pipeline',
                strategy: 'reviewed',
                steps: [],
                compatible: true,
              },
            ]
          : [
              {
                id: 'default',
                version: 1,
                name: 'Default (Apply)',
                strategy: 'apply',
                steps: [],
                compatible,
                reason: compatible ? undefined : 'Runner cannot execute this pipeline.',
              },
              {
                id: 'reviewed-bootstrap',
                version: 1,
                name: 'Plan, approval and bootstrap',
                strategy: 'reviewed',
                steps: [],
                compatible: true,
              },
            ],
      }),
    );
    return;
  }
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
  });
  request.on('end', () => {
    submitted.push(JSON.parse(body));
    response.statusCode = 201;
    response.end(JSON.stringify({ id: 'canonical-id' }));
  });
});
beforeAll(async () => {
  await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  AXIOS_INSTANCE.defaults.baseURL = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}`;
  server.close();
});
beforeEach(() => {
  submitted = [];
  compatible = true;
  publishedOnly = false;
});
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients = [];
});
afterAll(async () => {
  AXIOS_INSTANCE.defaults.baseURL = originalBase;
  server.listen();
  fixture.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    fixture.close((error) => (error ? reject(error) : resolve())),
  );
});

const setup = (allowed = true) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(client);
  client.setQueryData(getGetEnvironmentQueryKey('org', 'project', 'env'), { uuid: 'environment' });
  const permission = { resource: 'env:environment', permission: RBACPermission.DEPLOYMENT_WRITE };
  client.setQueryData(getCheckPermissionsQueryKey([permission]), {
    items: [{ permission_check: permission, allowed }],
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/orgs/org/projects/project/envs/env/deploys']}>
        <Routes>
          <Route
            path={'/orgs/:orgId/projects/:projectId/envs/:envId/deploys'}
            element={<CreatePipelineDeployment />}
          />
          <Route
            path={'/orgs/:orgId/projects/:projectId/envs/:envId/deploys/:deployId/pipeline'}
            element={<div>Canonical deployment detail</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};
const manifest = JSON.stringify({ workloads: { app: { resources: {} } } });

describe('normal deployment actions', () => {
  it('accepts the same manifest in YAML or JSON', () => {
    const expected = { workloads: { app: { resources: {} } } };
    expect(parseDeploymentManifest('workloads:\n  app:\n    resources: {}\n')).toEqual(expected);
    expect(parseDeploymentManifest(JSON.stringify(expected))).toEqual(expected);
    expect(() => parseDeploymentManifest('[]')).toThrow('YAML or JSON manifest object');
  });

  it('explains the deliberate bootstrap fault before the demo recipe is submitted', async () => {
    setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Deploy' }));
    const dialog = screen.getByRole('dialog', { name: 'Deploy environment' });
    await userEvent.click(within(dialog).getByRole('combobox'));
    await userEvent.click(await screen.findByText('Plan, approval and bootstrap · v1'));
    expect(within(dialog).getByText('Demo: retry a database bootstrap task')).toBeVisible();
    expect(within(dialog).getByText(/deliberately simulates a lost acknowledgment/)).toBeVisible();
    expect(submitted).toHaveLength(0);
  });
  it('submits the default Apply recipe through normal admission and navigates to its Deployment', async () => {
    setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Deploy' }));
    const dialog = screen.getByRole('dialog', { name: 'Deploy environment' });
    await userEvent.clear(within(dialog).getByLabelText('Deployment manifest'));
    await userEvent.type(
      within(dialog).getByLabelText('Deployment manifest'),
      manifest.replace(/{/g, '{{'),
      { initialSelectionStart: 0, initialSelectionEnd: 0 },
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deploy' }));
    expect(await screen.findByText('Canonical deployment detail')).toBeInTheDocument();
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({
      mode: 'deploy',
      project_id: 'project',
      env_id: 'env',
      pipeline: { id: 'default', version: 1 },
    });
    expect(submitted[0]).not.toHaveProperty('approval_mode');
  });

  it('runs Plan only as an explicit separate operation', async () => {
    setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Plan' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Plan' }));
    const dialog = screen.getByRole('dialog', { name: 'Plan deployment' });
    expect(
      within(dialog).getByRole('combobox', { name: 'Pipeline for the eventual Apply' }),
    ).toBeVisible();
    expect(within(dialog).getByText(/will not apply changes/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Run plan' }));
    expect(await screen.findByText('Canonical deployment detail')).toBeInTheDocument();
    expect(submitted[0]).toMatchObject({ mode: 'plan_only' });
    expect(submitted[0]).toMatchObject({ pipeline: { id: 'default', version: 1 } });
  });

  it('refuses an incompatible default recipe before normal admission', async () => {
    compatible = false;
    setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Deploy' }));
    const dialog = screen.getByRole('dialog', { name: 'Deploy environment' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deploy' }));
    expect(
      await within(dialog).findByText('Runner cannot execute this pipeline.'),
    ).toBeInTheDocument();
    expect(submitted).toHaveLength(0);
  });

  it('does not offer submission without deployment write permission', async () => {
    setup(false);
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Plan' })).toBeDisabled();
    expect(submitted).toHaveLength(0);
  });
});

it('requires an explicit allowed published version when project policy has no default, and pins it for manual Plan', async () => {
  publishedOnly = true;
  setup();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Plan' })).toBeEnabled());
  await userEvent.click(screen.getByRole('button', { name: 'Plan' }));
  await userEvent.click(screen.getByRole('button', { name: 'Run plan' }));
  expect(await screen.findByText('Choose a compatible published pipeline.')).toBeVisible();
  expect(submitted).toHaveLength(0);
  await userEvent.click(screen.getByRole('combobox', { name: 'Pipeline for the eventual Apply' }));
  await userEvent.click(screen.getByText('Published reviewed pipeline · v3'));
  await userEvent.click(screen.getByRole('button', { name: 'Run plan' }));
  expect(await screen.findByText('Canonical deployment detail')).toBeVisible();
  expect(submitted[0]).toMatchObject({
    mode: 'plan_only',
    pipeline: { id: 'published-version', version: 3 },
  });
});

it('resets an unsupported builtin reviewed recipe when changing from Deploy to manual Plan', async () => {
  setup();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled());
  await userEvent.click(screen.getByRole('button', { name: 'Deploy' }));
  const deployDialog = screen.getByRole('dialog', { name: 'Deploy environment' });
  await userEvent.click(within(deployDialog).getByRole('combobox', { name: 'Pipeline' }));
  await userEvent.click(screen.getByText('Plan, approval and bootstrap · v1'));
  await userEvent.click(within(deployDialog).getByRole('button', { name: 'Close' }));
  await userEvent.click(screen.getByRole('button', { name: 'Plan' }));
  const planDialog = screen.getByRole('dialog', { name: 'Plan deployment' });
  expect(within(planDialog).getByText('Default (Apply) · v1')).toBeVisible();
  await userEvent.click(
    within(planDialog).getByRole('combobox', { name: 'Pipeline for the eventual Apply' }),
  );
  expect(screen.queryByText('Plan, approval and bootstrap · v1')).not.toBeInTheDocument();
  expect(submitted).toHaveLength(0);
});
