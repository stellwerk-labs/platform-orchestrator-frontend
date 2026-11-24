import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';

import { AXIOS_INSTANCE } from '@src/custom-instance';
import {
  createRunner,
  deleteRunner,
  getRunner,
  updateRunner,
} from '@src/hooks/react-query/v2/controlplane/runner/runner';
import type { Runner, RunnerCreateBody } from '@src/models/v2/controlplane';
import { server } from '@src/testing-utils/mswServer';

const publicKey =
  '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=\n-----END PUBLIC KEY-----';
const create: RunnerCreateBody = {
  id: 'native-pool',
  runner_configuration: {
    type: 'native-agent',
    key: publicKey,
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
  state_storage_configuration: { type: 's3', bucket: 'runner-state' },
};
const registration: Runner = {
  ...create,
  org_id: 'org',
  uuid: '11223344-5566-4788-99aa-bbccddeeff00',
  created_at: '2026-11-20T00:00:00Z',
  updated_at: '2026-11-20T00:00:00Z',
};
const disabled: Runner = {
  ...registration,
  runner_configuration: {
    type: 'native-agent',
    key: publicKey,
    max_parallel_jobs: 2,
  },
};
const previousBase = AXIOS_INSTANCE.defaults.baseURL;
let received: { method: string; path: string; body: unknown }[] = [];
const fixture = createServer((request, response) => {
  let raw = '';
  request.on('data', (chunk) => {
    raw += chunk;
  });
  request.on('end', () => {
    received.push({
      method: request.method ?? '',
      path: request.url ?? '',
      body: raw ? JSON.parse(raw) : undefined,
    });
    response.setHeader('Content-Type', 'application/json');
    response.statusCode = request.method === 'DELETE' ? 409 : request.method === 'POST' ? 201 : 200;
    response.end(
      JSON.stringify(
        request.method === 'DELETE'
          ? { message: 'Registration retains authority' }
          : request.method === 'POST'
            ? registration
            : disabled,
      ),
    );
  });
});
beforeAll(async () => {
  await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  AXIOS_INSTANCE.defaults.baseURL = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}`;
  server.close();
});
beforeEach(() => {
  received = [];
});
afterAll(async () => {
  AXIOS_INSTANCE.defaults.baseURL = previousBase;
  server.listen();
  fixture.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    fixture.close((error) => (error ? reject(error) : resolve())),
  );
});

it('uses the normal typed client for UUID-bound native create, absent reads and explicit null clear', async () => {
  const created = await createRunner('org', create);
  expect(created.uuid).toBe(registration.uuid);
  expect(received[0]).toEqual({ method: 'POST', path: '/orgs/org/runners', body: create });
  const cleared = await updateRunner('org', create.id, {
    runner_configuration: { type: 'native-agent', native_execution: null },
  });
  expect(cleared.uuid).toBe(registration.uuid);
  expect(received[1]?.body).toEqual({
    runner_configuration: { type: 'native-agent', native_execution: null },
  });
  const read = await getRunner('org', create.id);
  expect(read.runner_configuration).toEqual(disabled.runner_configuration);
  expect(read.runner_configuration).not.toHaveProperty('native_execution');
});

it('does not turn a protected native DELETE response into success', async () => {
  await expect(deleteRunner('org', create.id)).rejects.toMatchObject({ response: { status: 409 } });
  expect(received).toEqual([
    { method: 'DELETE', path: '/orgs/org/runners/native-pool', body: undefined },
  ]);
});
