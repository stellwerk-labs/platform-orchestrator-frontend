import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getCancelDeploymentQueueItemMockHandler,
  getCancelDeploymentQueueItemMockHandler409,
  getGetDeploymentQueueItemMockHandler,
  getListDeploymentQueueItemsMockHandler,
} from '@src/hooks/react-query/v2/dataplane/deployment/deployment.msw';
import { getListOrgMembershipsMockHandler } from '@src/hooks/react-query/v2/iam/membership/membership.msw';
import { getListServiceUsersMockHandler } from '@src/hooks/react-query/v2/iam/service-user/service-user.msw';
import { DeploymentQueueItem } from '@src/models/v2/dataplane';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';
import { answerPermissionChecks } from '@src/testing-utils/permissionChecks';

import { DeploymentQueue } from './DeploymentQueue';

const environmentUuid = '0b6b3c58-63c4-4d5e-9b51-4c1a5d1f0a10';
const minute = 60_000;

const queueItem = (overrides: Partial<DeploymentQueueItem> = {}): DeploymentQueueItem => ({
  id: '7d0f6a52-5f3e-4f63-a3a4-0d6c1b0c7e01',
  org_id: 'my-org',
  project_id: 'my-project',
  env_id: 'my-env',
  mode: 'deploy',
  state: 'queued',
  position: 1,
  created_by: 'user-1',
  created_at: new Date(Date.now() - 5 * minute).toISOString(),
  expires_at: new Date(Date.now() + 180 * minute).toISOString(),
  attempts: 0,
  ...overrides,
});

const second = (overrides: Partial<DeploymentQueueItem> = {}) =>
  queueItem({
    id: '7d0f6a52-5f3e-4f63-a3a4-0d6c1b0c7e02',
    mode: 'rollback',
    position: 2,
    created_by: 'user-2',
    created_at: new Date(Date.now() - 2 * minute).toISOString(),
    ...overrides,
  });

const serveQueue = (pages: DeploymentQueueItem[][]) => {
  const requests: URL[] = [];
  server.use(
    getListDeploymentQueueItemsMockHandler(({ request }) => {
      requests.push(new URL(request.url));
      return { items: pages[Math.min(requests.length, pages.length) - 1] ?? [] };
    }),
  );
  return requests;
};

const grant = (...permissions: string[]) =>
  server.use(
    answerPermissionChecks(
      ({ resource, permission }) =>
        resource === `env:${environmentUuid}` && permissions.includes(permission),
    ),
  );

const renderQueue = () =>
  render(
    <MockProviders
      route={{
        path: '/orgs/:orgId/projects/:projectId/envs/:envId/status',
        url: '/orgs/my-org/projects/my-project/envs/my-env/status',
      }}>
      <DeploymentQueue environmentUuid={environmentUuid} />
    </MockProviders>,
  );

describe('DeploymentQueue', () => {
  beforeEach(() => {
    server.use(
      getListOrgMembershipsMockHandler({
        items: [
          {
            id: 'membership-1',
            created_at: '2026-01-01T00:00:00Z',
            user_id: 'user-1',
            user_display_name: 'Ada Admin',
            subject_type: 'role',
            subject: 'role-1',
          },
          {
            id: 'membership-2',
            created_at: '2026-01-01T00:00:00Z',
            user_id: 'user-2',
            user_display_name: 'Bob Builder',
            subject_type: 'role',
            subject: 'role-1',
          },
        ],
      }),
      getListServiceUsersMockHandler({ items: [] }),
    );
    grant();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks only for the queued requests of this Environment and shows an empty state', async () => {
    const requests = serveQueue([[]]);
    renderQueue();

    expect(await screen.findByText('No deployment requests are waiting.')).toBeInTheDocument();
    expect(requests).toHaveLength(1);
    const [request] = requests as [URL];
    expect(request.pathname).toBe('/orgs/my-org/deployment-queue');
    expect(Object.fromEntries(request.searchParams)).toMatchObject({
      project_id: 'my-project',
      env_id: 'my-env',
      state: 'queued',
    });
  });

  it('shows position, requester, age, TTL and retry state in queue order without Cancel for readers', async () => {
    serveQueue([[queueItem(), second({ attempts: 2, last_error: 'Core is unavailable' })]]);
    renderQueue();

    const rows = (await screen.findAllByRole('row')).slice(1);
    expect(rows).toHaveLength(2);
    const [head, next] = rows as [HTMLElement, HTMLElement];
    expect(within(head).getByText('1')).toBeInTheDocument();
    expect(within(head).getByText('deploy')).toBeInTheDocument();
    expect(await within(head).findByText('Ada Admin')).toBeInTheDocument();
    expect(within(head).getByText('5 minutes')).toBeInTheDocument();
    expect(within(head).getByText('in 3 hours')).toBeInTheDocument();
    expect(within(head).getByText('Waiting')).toBeInTheDocument();
    expect(within(next).getByText('2')).toBeInTheDocument();
    expect(within(next).getByText('rollback')).toBeInTheDocument();
    expect(within(next).getByText('Bob Builder')).toBeInTheDocument();
    expect(within(next).getByText('2 minutes')).toBeInTheDocument();
    expect(
      within(next).getByText('Retrying after 2 failed attempt(s): Core is unavailable'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('lets an Environment writer cancel and reports who cancelled', async () => {
    grant('deployment_write');
    const requests = serveQueue([[queueItem()], []]);
    let cancelled: string | undefined;
    server.use(
      getCancelDeploymentQueueItemMockHandler(({ params }) => {
        cancelled = String(params.queueItemId);
        return queueItem({
          state: 'cancelled',
          position: 0,
          reason_code: 'cancelled',
          settled_by: 'user-2',
        });
      }),
    );
    renderQueue();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel request' }));

    expect(
      await screen.findByText('Queued deploy requested by Ada Admin was cancelled by Bob Builder.'),
    ).toBeInTheDocument();
    expect(cancelled).toBe(queueItem().id);
    expect(await screen.findByText('No deployment requests are waiting.')).toBeInTheDocument();
    expect(requests.length).toBeGreaterThanOrEqual(2);
  });

  it.each([
    ['queue_item_dispatching', 'The request is starting right now and can no longer be cancelled.'],
    ['queue_item_settled', 'The request already left the queue.'],
  ])('explains the %s refusal and refreshes the queue', async (code, explanation) => {
    grant('deployment_write');
    const requests = serveQueue([[queueItem()]]);
    server.use(
      getCancelDeploymentQueueItemMockHandler409({ error: code, message: 'raw server text' }),
    );
    renderQueue();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel request' }));

    expect(await screen.findByText(explanation)).toBeInTheDocument();
    await waitFor(() => expect(requests).toHaveLength(2));
  });

  it('refreshes while requests wait and links the Deployment a promoted request became', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const deploymentId = '3c9d2b7e-1a4f-4d8b-9e6a-5f2c1b0a9d33';
    const requests = serveQueue([[second()], []]);
    server.use(
      getGetDeploymentQueueItemMockHandler(({ params }) =>
        second({
          id: String(params.queueItemId),
          state: 'dispatched',
          position: 0,
          deployment_id: deploymentId,
        }),
      ),
    );
    renderQueue();

    expect(await screen.findByText('Bob Builder')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(5_000));

    expect(
      await screen.findByText('Queued rollback requested by Bob Builder started.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: `Open Deployment ${deploymentId}` })).toHaveAttribute(
      'href',
      `/orgs/my-org/projects/my-project/envs/my-env/deploys/${deploymentId}/resources`,
    );
    expect(screen.getByText('No deployment requests are waiting.')).toBeInTheDocument();

    // An empty queue stops polling.
    await act(() => vi.advanceTimersByTimeAsync(15_000));
    expect(requests).toHaveLength(2);
  });

  it('turns rejection codes into the next step', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serveQueue([[queueItem()], []]);
    server.use(
      getGetDeploymentQueueItemMockHandler(
        queueItem({
          state: 'rejected',
          position: 0,
          reason_code: 'outcome_unreconciled',
          reason_message: 'failed plugin-dispatched Deployment may still have an active Runner',
        }),
      ),
    );
    renderQueue();

    expect(await screen.findByText('Ada Admin')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(5_000));

    expect(
      await screen.findByText(
        'Queued deploy requested by Ada Admin was rejected (outcome_unreconciled).',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Someone allowed to acknowledge its outcome must do so/),
    ).toHaveTextContent('may still have an active Runner');
  });

  it('says when a request expired without repeating its code', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serveQueue([[queueItem()], []]);
    server.use(
      getGetDeploymentQueueItemMockHandler(
        queueItem({ state: 'expired', position: 0, reason_code: 'expired' }),
      ),
    );
    renderQueue();

    expect(await screen.findByText('Ada Admin')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(5_000));

    expect(
      await screen.findByText('Queued deploy requested by Ada Admin expired.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/waited longer than its time limit/)).toBeInTheDocument();
  });
});
