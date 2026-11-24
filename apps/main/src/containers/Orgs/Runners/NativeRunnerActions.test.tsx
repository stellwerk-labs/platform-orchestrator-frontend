import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';

import '@src/i18n/i18n';

import { AXIOS_INSTANCE } from '@src/custom-instance';
import { getGetRunnerQueryKey } from '@src/hooks/react-query/v2/controlplane/runner/runner';
import type { Runner } from '@src/models/v2/controlplane';
import { server } from '@src/testing-utils/mswServer';

import { RunnerDetails } from './containers/RunnerDetails/RunnerDetails';

const originalBase = AXIOS_INSTANCE.defaults.baseURL;
const registration: Runner = {
  id: 'native-pool',
  org_id: 'org',
  uuid: '11223344-5566-4788-99aa-bbccddeeff00',
  created_at: '2026-11-20T00:00:00Z',
  updated_at: '2026-11-20T00:00:00Z',
  state_storage_configuration: { type: 's3', bucket: 'state' },
  runner_configuration: {
    type: 'native-agent',
    key: 'public-key',
    max_parallel_jobs: 2,
    supported_protocols: ['stellwerk.pipeline/v2', 'stellwerk.pipeline.plan-apply/v2'],
    capabilities: [],
    native_execution: {
      contract_version: 'stellwerk.runner.catalogue/v1',
      runtime_version: 'stellwerk.runner.rollout/v2',
      tools_digest: 'a'.repeat(64),
      tools: [],
    },
  },
};
let current: Runner;
let allowed = true;
let mode: 'normal' | 'denied' | 'changed-identity' = 'normal';
let writes: unknown[];
let clients: QueryClient[] = [];
let delayNextGet = false;
let releaseGet: (() => void) | undefined;
const fixture = createServer((request, response) => {
  let raw = '';
  request.on('data', (chunk) => {
    raw += chunk;
  });
  request.on('end', () => {
    const body = raw ? JSON.parse(raw) : undefined;
    response.setHeader('Content-Type', 'application/json');
    const reply = (value: unknown, status = 200) => {
      response.statusCode = status;
      response.end(JSON.stringify(value));
    };
    if (request.url === '/auth/check-permissions') {
      reply({ items: body.map((permission_check: unknown) => ({ permission_check, allowed })) });
      return;
    }
    if (request.method === 'GET' && delayNextGet) {
      delayNextGet = false;
      const snapshot = structuredClone(current);
      releaseGet = () => reply(snapshot);
      return;
    }
    if (request.method === 'PATCH') {
      writes.push(body);
      if (mode === 'denied') {
        reply({ message: 'PRIVATE_SERVER_SENTINEL_DO_NOT_DISPLAY' }, 403);
        return;
      }
      if (current.runner_configuration.type === 'native-agent')
        delete current.runner_configuration.native_execution;
      if (mode === 'changed-identity')
        current = { ...current, uuid: '00000000-0000-0000-0000-000000000000' };
    }
    reply(current);
  });
});

beforeAll(async () => {
  await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  AXIOS_INSTANCE.defaults.baseURL = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}`;
  server.close();
});
beforeEach(() => {
  current = structuredClone(registration);
  allowed = true;
  mode = 'normal';
  writes = [];
  delayNextGet = false;
  releaseGet = undefined;
});
afterEach(() => {
  releaseGet?.();
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
const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const router = createMemoryRouter(
    [{ path: '/orgs/:orgId/runners/by-id/:runnerId/view', element: <RunnerDetails /> }],
    { initialEntries: ['/orgs/org/runners/by-id/native-pool/view'] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return client;
};
const confirmDisable = async () => {
  const button = await screen.findByRole('button', {
    name: 'Disable native admission',
  });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
  await userEvent.click(await screen.findByRole('button', { name: 'Disable admission' }));
};

it('sends only an explicit inventory clear and retains the UUID/key/capacity in the real HTTP response', async () => {
  setup();
  await confirmDisable();
  await screen.findByText('Absent, new native admission disabled');
  expect(writes).toEqual([
    { runner_configuration: { type: 'native-agent', native_execution: null } },
  ]);
  expect(screen.getByText(registration.uuid)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Disable native admission' })).toBeDisabled();
  expect(current.runner_configuration).toMatchObject({ key: 'public-key', max_parallel_jobs: 2 });
});
it('does not offer enabled mutation controls when the organization permission check denies writes', async () => {
  allowed = false;
  setup();
  expect(await screen.findByRole('button', { name: 'Disable native admission' })).toBeDisabled();
  expect(writes).toEqual([]);
});
it('keeps retained identity and reports a static failure if write authority is rejected during the request', async () => {
  mode = 'denied';
  setup();
  await confirmDisable();
  await screen.findByText(
    'Native admission could not be disabled. Check permission and connection, then retry.',
  );
  expect(screen.queryByText('PRIVATE_SERVER_SENTINEL_DO_NOT_DISPLAY')).not.toBeInTheDocument();
  expect(screen.getByText(registration.uuid)).toBeVisible();
  expect(screen.getByText('Advertised')).toBeVisible();
});
it('reports response attention and refuses to adopt changed registration identity', async () => {
  mode = 'changed-identity';
  setup();
  await confirmDisable();
  await screen.findByText(
    'The Runner changed beyond this action. Admission may already be disabled. Refresh and review the current registration before acting again.',
  );
  expect(screen.getByText(registration.uuid)).toBeVisible();
  expect(screen.queryByText('00000000-0000-0000-0000-000000000000')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Disable native admission' })).toBeDisabled();
});
it('blocks actions against a nil retained UUID before sending any PATCH', async () => {
  current = { ...current, uuid: '00000000-0000-0000-0000-000000000000' };
  setup();
  await screen.findByText(
    'This registration has no usable retained identity. Refresh and review before acting.',
  );
  expect(screen.getByRole('button', { name: 'Disable native admission' })).toBeDisabled();
  expect(writes).toEqual([]);
});

it('does not let an earlier GET restore advertised inventory in the cache after confirmed disable', async () => {
  const client = setup();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Disable native admission' })).toBeEnabled(),
  );
  delayNextGet = true;
  const pendingRead = client.invalidateQueries({
    queryKey: getGetRunnerQueryKey('org', registration.id),
  });
  await waitFor(() => expect(releaseGet).toBeDefined());
  await confirmDisable();
  await screen.findByText('Absent, new native admission disabled');
  await act(async () => {
    releaseGet?.();
    await pendingRead;
  });
  expect(screen.getByText('Absent, new native admission disabled')).toBeVisible();
  expect(
    client.getQueryData<Runner>(getGetRunnerQueryKey('org', registration.id))?.runner_configuration,
  ).not.toHaveProperty('native_execution');
});
