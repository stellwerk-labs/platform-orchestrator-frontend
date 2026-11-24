import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AXIOS_INSTANCE } from '@src/custom-instance';
import { getGetCurrentUserQueryKey } from '@src/hooks/react-query/v2/iam/user/user';
import { server } from '@src/testing-utils/mswServer';

import type {
  DeploymentPipeline,
  PipelineControlIntent,
  PipelineControlReceipt,
} from './deploymentPipelineApi';
import { NativePipelineControls } from './NativePipelineControls';

const originalBase = AXIOS_INSTANCE.defaults.baseURL;
const subject = 'a'.repeat(64);
const execution: DeploymentPipeline = {
  definition: { id: 'reviewed', name: 'Reviewed', version: 1, strategy: 'reviewed', steps: [] },
  available_controls: ['approve', 'deny', 'cancel'],
  progress: {
    id: 'deployment',
    environment_id: 'environment',
    phase: 'awaiting_approval',
    created_at: '',
    revision: 7,
    subject,
    infrastructure_applied: false,
    plan_changes: { add: 1, change: 2, remove: 0 },
  },
};
const receipt: PipelineControlReceipt = {
  id: 'control',
  deployment_id: 'deployment',
  actor_id: 'actor',
  action: 'approve',
  status: 'pending',
  created_at: '2026-11-21T00:00:00Z',
  expires_at: '2026-11-21T00:01:00Z',
};
let clients: QueryClient[] = [];
let received: { path?: string; method?: string; intent?: PipelineControlIntent; key?: string }[];
let postStatus: number;
let current: PipelineControlReceipt;
let reads: number;
const fixture = createServer((request, response) => {
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
  });
  request.on('end', () => {
    received.push({
      path: request.url,
      method: request.method,
      intent: body ? JSON.parse(body) : undefined,
      key: request.headers['idempotency-key'] as string | undefined,
    });
    if (request.method === 'GET') reads += 1;
    response.statusCode = request.method === 'POST' ? postStatus : 200;
    response.setHeader('Content-Type', 'application/json');
    response.end(
      JSON.stringify(
        response.statusCode === 202 || response.statusCode === 200
          ? current
          : { message: 'private backend payload must not appear' },
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
  sessionStorage.clear();
  received = [];
  postStatus = 202;
  current = { ...receipt };
  reads = 0;
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
const setup = (initial = execution) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(client);
  client.setQueryData(getGetCurrentUserQueryKey(), { id: 'actor' });
  const page = (pipeline = initial, canWrite = true, id = 'deployment') => (
    <QueryClientProvider client={client}>
      <NativePipelineControls
        orgId={'org'}
        id={id}
        pipeline={pipeline}
        canWrite={canWrite}
        unavailable={false}
        onResolved={() => undefined}
      />
    </QueryClientProvider>
  );
  const view = render(page());
  return {
    ...view,
    update: (pipeline = initial, canWrite = true, id = 'deployment') =>
      view.rerender(page(pipeline, canWrite, id)),
  };
};
const confirm = async (name = 'Approve local plan') => {
  await userEvent.click(screen.getByRole('button', { name }));
  const dialog = screen.getByRole('dialog', { name: 'Confirm Native pipeline control' });
  await userEvent.click(within(dialog).getByRole('button', { name: 'Send request' }));
};
const resolveControl = (action: PipelineControlReceipt['action'] = 'approve', code = '') => {
  current = {
    ...receipt,
    action,
    status: 'resolved',
    result: {
      version: 'stellwerk.pipeline.control-result/v1',
      control_id: 'control',
      rollout_id: 'deployment',
      request_digest: 'b'.repeat(64),
      execution_digest: 'c'.repeat(64),
      outcome: code ? 'refused' : 'applied',
      code,
      phase: 'approved',
      revision: 8,
    },
  };
};

describe('Native control delivery receipts (frontend wire fixtures only)', () => {
  it('keeps 202 pending and blocks conflicting actions without claiming infrastructure success', async () => {
    const view = setup();
    await confirm();
    expect(await screen.findByText('Request accepted, awaiting site confirmation')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Deny local plan' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel deployment' })).toBeDisabled();
    expect(screen.queryByText('Approval decision confirmed')).not.toBeInTheDocument();
    expect(screen.getByText(/Expiry or silence does not establish refusal/)).toBeVisible();
    expect(received.filter((request) => request.method === 'POST')).toEqual([
      {
        path: '/orgs/org/deployments/deployment/pipeline/controls',
        method: 'POST',
        intent: { action: 'approve', subject },
        key: expect.any(String),
      },
    ]);
    resolveControl();
    expect(
      await screen.findByText('Approval decision confirmed', {}, { timeout: 3000 }),
    ).toBeVisible();
    expect(
      screen.getByText(/Deployment progress reports the infrastructure outcome/),
    ).toBeVisible();
    const completedReads = reads;
    await new Promise((done) => setTimeout(done, 1100));
    expect(reads).toBe(completedReads);
    view.unmount();
  });

  it('reuses the exact key after an unknown response and page remount', async () => {
    postStatus = 503;
    const view = setup();
    await confirm();
    expect(await screen.findByText(/request or receipt could not be confirmed/)).toBeVisible();
    expect(screen.queryByText(/private backend payload/)).not.toBeInTheDocument();
    view.unmount();
    setup();
    expect(screen.getByText('Control request is unconfirmed')).toBeVisible();
    postStatus = 202;
    await userEvent.click(screen.getByRole('button', { name: 'Retry same request' }));
    expect(await screen.findByText('Request accepted, awaiting site confirmation')).toBeVisible();
    const posts = received.filter((request) => request.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[1]).toEqual(posts[0]);
  });

  it('shows a safe coded refusal and gives an explicit new decision a fresh identity', async () => {
    resolveControl('approve', 'approval_subject_conflict');
    setup();
    await confirm();
    expect(await screen.findByText('Control request refused')).toBeVisible();
    expect(screen.getByText('The site is no longer awaiting this exact plan.')).toBeVisible();
    const firstKey = received[0]?.key;
    current = { ...receipt, action: 'deny' };
    await confirm('Deny local plan');
    expect(await screen.findByText('Request accepted, awaiting site confirmation')).toBeVisible();
    const posts = received.filter((request) => request.method === 'POST');
    expect(posts[1]?.key).not.toBe(firstKey);
    expect(posts[1]?.intent).toEqual({ action: 'deny', subject });
  });

  it('hides unknown site refusal codes behind safe copy', async () => {
    resolveControl('approve', 'PRIVATE SITE PAYLOAD');
    setup();
    await confirm();
    expect(await screen.findByText('Control request refused')).toBeVisible();
    expect(
      screen.getByText(/The site refused this control. Reload deployment progress/),
    ).toBeVisible();
    expect(screen.queryByText('PRIVATE SITE PAYLOAD')).not.toBeInTheDocument();
  });

  it('binds repair to the failed occurrence and blocks a stale confirmation', async () => {
    const failed = {
      ...execution,
      available_controls: ['repair' as const],
      progress: {
        ...execution.progress,
        phase: 'post_failed',
        failed_step: 'database',
        revision: 17,
      },
    };
    current = { ...receipt, action: 'repair' };
    const view = setup(failed);
    await userEvent.click(screen.getByRole('button', { name: 'Retry failed task' }));
    view.update({ ...failed, progress: { ...failed.progress, revision: 18 } });
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Send request' }),
    ).toBeDisabled();
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    );
    await confirm('Retry failed task');
    expect(await screen.findByText('Request accepted, awaiting site confirmation')).toBeVisible();
    expect(received[0]?.intent).toEqual({
      action: 'repair',
      failed_step: 'database',
      revision: 18,
    });
  });

  it('clears state on permission loss, aborts polling, and isolates navigation', async () => {
    const view = setup();
    await confirm();
    await waitFor(() => expect(reads).toBeGreaterThan(0));
    view.update(execution, false);
    expect(
      screen.queryByText('Request accepted, awaiting site confirmation'),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(sessionStorage.length).toBe(0));
    const stoppedReads = reads;
    await act(async () => {
      await new Promise((done) => setTimeout(done, 1100));
    });
    expect(reads).toBe(stoppedReads);
    view.update(execution, true, 'another-deployment');
    expect(screen.queryByText('Control request is unconfirmed')).not.toBeInTheDocument();
  });

  it('describes confirmed cancellation without a process-kill guarantee', async () => {
    resolveControl('cancel');
    setup();
    await confirm('Cancel deployment');
    expect(await screen.findByText('Cancellation state confirmed')).toBeVisible();
    expect(
      screen.getByText(/does not confirm a stopped process or absence of effects/),
    ).toBeVisible();
  });
});
