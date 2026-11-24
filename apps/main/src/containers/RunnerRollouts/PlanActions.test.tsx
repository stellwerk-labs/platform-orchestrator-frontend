import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AXIOS_INSTANCE } from '@src/custom-instance';
import { server } from '@src/testing-utils/mswServer';

import { type DeploymentPipeline, pipelineQueryKey } from './deploymentPipelineApi';
import { PlanActions } from './PlanActions';

type Plan = NonNullable<DeploymentPipeline['plan']>;
const ready: Plan = { state: 'ready', subject: 'exact-subject', can_replan: false };
const originalBase = AXIOS_INSTANCE.defaults.baseURL;
let clients: QueryClient[] = [];
let responses: number[] = [];
let failureMessage = 'Request unavailable';
let received: { path?: string; body: unknown; key?: string }[] = [];
const fixture = createServer((request, response) => {
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
  });
  request.on('end', () => {
    received.push({
      path: request.url,
      body: JSON.parse(body),
      key: request.headers['idempotency-key'] as string,
    });
    response.statusCode = responses.shift() ?? 201;
    response.setHeader('Content-Type', 'application/json');
    response.end(
      JSON.stringify(response.statusCode === 201 ? { id: 'child' } : { message: failureMessage }),
    );
  });
});
beforeAll(async () => {
  await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  AXIOS_INSTANCE.defaults.baseURL = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}`;
  server.close();
});
beforeEach(() => {
  responses = [];
  received = [];
  failureMessage = 'Request unavailable';
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

const setup = (initial: Plan = ready) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(client);
  client.setQueryData(pipelineQueryKey('org', 'source'), { plan: initial });
  const page = (plan: Plan, canWrite = true) => (
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={['/orgs/org/projects/project/envs/env/deploys/source/pipeline']}>
        <Routes>
          <Route
            path={'/orgs/:orgId/projects/:projectId/envs/:envId/deploys/source/pipeline'}
            element={
              <PlanActions
                scope={{ orgId: 'org', projectId: 'project', envId: 'env' }}
                id={'source'}
                plan={plan}
                changes={{ add: 1, change: 2, remove: 0 }}
                canWrite={canWrite}
                unavailable={false}
              />
            }
          />
          <Route
            path={'/orgs/:orgId/projects/:projectId/envs/:envId/deploys/child/pipeline'}
            element={<div>Linked deployment detail</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const view = render(page(initial));
  return { client, update: (plan: Plan, allowed = true) => view.rerender(page(plan, allowed)) };
};
const confirmApply = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Apply this plan' }));
  const dialog = screen.getByRole('dialog', { name: 'Apply this saved plan?' });
  expect(within(dialog).getByText(/No new plan is generated/)).toBeVisible();
  expect(within(dialog).getByLabelText('Resource changes')).toHaveTextContent(
    '1 add2 change0 destroy',
  );
  await userEvent.click(within(dialog).getByRole('button', { name: 'Apply plan' }));
};

describe('Manual Plan actions', () => {
  it('applies the displayed exact subject and opens the one linked Deployment', async () => {
    setup();
    await confirmApply();
    expect(await screen.findByText('Linked deployment detail')).toBeVisible();
    expect(received).toEqual([
      {
        path: '/orgs/org/deployments/source/pipeline/actions/apply-plan',
        body: { subject: 'exact-subject' },
        key: expect.any(String),
      },
    ]);
  });

  it('retains the same request key after an unconfirmed response', async () => {
    responses = [503, 201];
    setup();
    await confirmApply();
    expect(await screen.findByText('Request unavailable')).toBeVisible();
    await confirmApply();
    expect(await screen.findByText('Linked deployment detail')).toBeVisible();
    expect(received).toHaveLength(2);
    expect(received[0]?.key).toBe(received[1]?.key);
  });

  it('offers a new reviewed Plan when superseded, never another automatic Apply', async () => {
    setup({
      state: 'superseded',
      current_deployment_id: 'newer',
      reason: 'The environment changed.',
      can_replan: true,
    });
    expect(screen.queryByRole('button', { name: 'Apply this plan' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View newer deployment' })).toHaveAttribute(
      'href',
      '/orgs/org/projects/project/envs/env/deploys/newer/pipeline',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create new plan' }));
    const dialog = screen.getByRole('dialog', { name: 'Create a new plan?' });
    expect(within(dialog).getByText(/Review the new plan before applying it/)).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create new plan' }));
    expect(await screen.findByText('Linked deployment detail')).toBeVisible();
    expect(received[0]).toMatchObject({
      path: '/orgs/org/deployments/source/pipeline/actions/replan',
      body: {},
    });
  });

  it('links a consumed Plan to its child without claiming that Apply succeeded', () => {
    setup({ state: 'used', apply_deployment_id: 'child', can_replan: true });
    expect(screen.getByRole('link', { name: 'View apply deployment' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Apply this plan' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create new plan' })).not.toBeInTheDocument();
    expect(screen.getByText('This plan has an apply deployment')).toBeVisible();
    expect(received).toHaveLength(0);
  });

  it('refreshes authoritative status after a conflict without silently replanning', async () => {
    responses = [409];
    failureMessage = 'Saved-plan apply is not supported by the current Runner.';
    const { client } = setup();
    await confirmApply();
    expect(await screen.findByText(failureMessage)).toBeVisible();
    expect(client.getQueryState(pipelineQueryKey('org', 'source'))?.isInvalidated).toBe(true);
    expect(received).toHaveLength(1);
  });

  it('blocks a pending confirmation after permission is revoked', async () => {
    const { update } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Apply this plan' }));
    update(ready, false);
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Apply plan' }),
    ).toBeDisabled();
    expect(received).toHaveLength(0);
  });

  it('blocks a pending confirmation when the displayed Plan becomes stale', async () => {
    const { update } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Apply this plan' }));
    update({ state: 'superseded', can_replan: true });
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Apply plan' }),
    ).toBeDisabled();
    expect(received).toHaveLength(0);
  });
});
