import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';

import { AXIOS_INSTANCE } from '@src/custom-instance';
import { getGetRunnerQueryKey } from '@src/hooks/react-query/v2/controlplane/runner/runner';
import type { Runner, RunnerCreateBody } from '@src/models/v2/controlplane';
import { server } from '@src/testing-utils/mswServer';
import { generateRunnerDetailUrl } from '@src/utilities/navigation';

import type { NativeRunnerEditorValues } from './useNativeRunnerDocument';
import { useNativeRunnerSave } from './useNativeRunnerSave';

const originalBase = AXIOS_INSTANCE.defaults.baseURL;
const document: RunnerCreateBody & NativeRunnerEditorValues = {
  id: 'new-pool',
  runner_configuration: {
    type: 'native-agent',
    key: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=\n-----END PUBLIC KEY-----',
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
  state_storage_configuration: { type: 's3', bucket: 'state' },
};
let mode: 'normal' | 'unexpected-field' | 'wrong-scope' = 'normal';
let writes: unknown[];
let clients: QueryClient[] = [];
const fixture = createServer((request, response) => {
  let raw = '';
  request.on('data', (chunk) => {
    raw += chunk;
  });
  request.on('end', () => {
    const body = JSON.parse(raw);
    writes.push(body);
    const actual: Runner = {
      ...body,
      org_id: 'org',
      uuid: '11223344-5566-4788-99aa-bbccddeeff00',
      created_at: '2026-11-20T00:00:00Z',
      updated_at: '2026-11-20T00:00:00Z',
    };
    if (mode === 'unexpected-field') actual.description = 'Unexpected server amendment';
    const answer =
      mode === 'wrong-scope' ? { ...actual, id: 'other-pool', org_id: 'other-org' } : actual;
    response.statusCode = 201;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(answer));
  });
});
beforeAll(async () => {
  await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  AXIOS_INSTANCE.defaults.baseURL = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}`;
  server.close();
});
beforeEach(() => {
  mode = 'normal';
  writes = [];
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
const setup = (allowed = true, positiveDocument: NativeRunnerEditorValues | null = document) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/authoring']}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  const view = renderHook(
    ({ canEdit }) => ({
      mutation: useNativeRunnerSave('org', undefined, canEdit, () => positiveDocument ?? undefined),
      location: useLocation(),
    }),
    { wrapper, initialProps: { canEdit: allowed } },
  );
  return { ...view, client };
};

it('does not write without the caller’s current positively validated document', async () => {
  const { result } = setup(true, null);
  await act(() => result.current.mutation.save());
  expect(writes).toEqual([]);
});
it('refuses a previously captured Save handler after write permission is revoked', async () => {
  const { result, rerender } = setup();
  const oldSave = result.current.mutation.save;
  rerender({ canEdit: false });
  await act(() => oldSave());
  expect(writes).toEqual([]);
});
it('sends the public create document and only adopts confirmed identity after an expected response', async () => {
  const { result, client } = setup();
  await act(() => result.current.mutation.save());
  expect(writes).toEqual([document]);
  expect(result.current.location.pathname).toBe(generateRunnerDetailUrl('org', document.id));
  expect(client.getQueryData<Runner>(getGetRunnerQueryKey('org', document.id))?.uuid).toBe(
    '11223344-5566-4788-99aa-bbccddeeff00',
  );
});
it.each(['unexpected-field', 'wrong-scope'] as const)(
  'retains the input and scopes the review link to the requested record after %s',
  async (responseMode) => {
    mode = responseMode;
    const untouched = structuredClone(document);
    const { result, client } = setup();
    await act(() => result.current.mutation.save());
    expect(result.current.mutation.attention?.reviewUrl).toBe(
      generateRunnerDetailUrl('org', document.id),
    );
    expect(result.current.mutation.disabled).toBe(true);
    expect(result.current.location.pathname).toBe('/authoring');
    expect(client.getQueryData(getGetRunnerQueryKey('org', document.id))).toBeUndefined();
    expect(document).toEqual(untouched);
    await act(() => result.current.mutation.save());
    expect(writes).toHaveLength(1);
  },
);
