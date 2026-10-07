import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getGetEnvironmentMockHandler,
  getGetEnvironmentResponseMock,
} from '@src/hooks/react-query/v2/controlplane/environment/environment.msw';
import {
  getListDeploymentQueueItemsMockHandler,
  getListLastDeploymentsMockHandler,
} from '@src/hooks/react-query/v2/dataplane/deployment/deployment.msw';
import { getListOrgMembershipsMockHandler } from '@src/hooks/react-query/v2/iam/membership/membership.msw';
import { getListServiceUsersMockHandler } from '@src/hooks/react-query/v2/iam/service-user/service-user.msw';
import { DeploymentSummary, EnvironmentFence } from '@src/models/v2/dataplane';
import { ResourcePermissionCheck } from '@src/models/v2/iam';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';
import { answerPermissionChecks } from '@src/testing-utils/permissionChecks';

import { EnvStatus } from './EnvStatus';

// The graph has its own data and layout; these tests cover what surrounds it.
vi.mock('../ResourceGraph/ResourceGraph', () => ({ ResourceGraph: () => 'Resource graph' }));

const environmentUuid = '0b6b3c58-63c4-4d5e-9b51-4c1a5d1f0a10';

const failedHead: DeploymentSummary = {
  org_id: 'my-org',
  project_id: 'my-project',
  env_id: 'my-env',
  id: '5e8a1c3d-2b4f-4a6e-8d9c-1f0e2d3c4b5a',
  created_at: '2026-10-07T08:00:00Z',
  created_by: 'user-1',
  mode: 'deploy',
  plan_only: false,
  status: 'failed',
  status_message: 'Runner dispatch timed out',
  metrics: { num_workloads: 0, num_resource_nodes: 0 },
};

const fence: EnvironmentFence = {
  code: 'outcome_unreconciled',
  deployment_id: failedHead.id,
  since: '2026-10-07T08:00:00Z',
  remedy: 'acknowledge-outcome',
  remedy_available_at: '2026-10-07T09:00:00Z',
};

const fencedHead: DeploymentSummary = { ...failedHead, environment_fence: fence };

const checked: ResourcePermissionCheck[] = [];

const renderStatus = () =>
  render(
    <MockProviders
      route={{
        path: '/orgs/:orgId/projects/:projectId/envs/:envId/status',
        url: '/orgs/my-org/projects/my-project/envs/my-env/status',
      }}>
      <EnvStatus />
    </MockProviders>,
  );

describe('EnvStatus', () => {
  beforeEach(() => {
    checked.length = 0;
    server.use(
      getGetEnvironmentMockHandler(
        getGetEnvironmentResponseMock({
          id: 'my-env',
          project_id: 'my-project',
          uuid: environmentUuid,
        }),
      ),
      getListOrgMembershipsMockHandler({ items: [] }),
      getListServiceUsersMockHandler({ items: [] }),
      getListDeploymentQueueItemsMockHandler({ items: [] }),
      answerPermissionChecks(() => true, checked),
    );
  });

  it('offers queue and outcome actions against the Environment UUID next to a fenced head', async () => {
    server.use(getListLastDeploymentsMockHandler({ items: [fencedHead] }));
    renderStatus();

    expect(await screen.findByText('Last deployment')).toBeInTheDocument();
    expect(screen.getByText('Resource graph')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Acknowledge outcome' })).toBeInTheDocument();
    expect(await screen.findByText('No deployment requests are waiting.')).toBeInTheDocument();
    await waitFor(() =>
      expect(checked).toEqual(
        expect.arrayContaining([
          { resource: `env:${environmentUuid}`, permission: 'deployment_write' },
          { resource: `env:${environmentUuid}`, permission: 'deployment.outcome.acknowledge' },
        ]),
      ),
    );
  });

  it('explains the fence and shows when acknowledging becomes available', async () => {
    server.use(
      getListLastDeploymentsMockHandler({
        items: [
          {
            ...failedHead,
            environment_fence: { ...fence, remedy_available_at: '2999-01-01T12:30:00Z' },
          },
        ],
      }),
    );
    renderStatus();

    expect(await screen.findByText(/outcome_unreconciled/)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`Deployment ${failedHead.id} failed on`)),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Acknowledging becomes available at/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acknowledge outcome' })).not.toBeInTheDocument();
  });

  it('offers no outcome action on a failed head without a fence', async () => {
    server.use(getListLastDeploymentsMockHandler({ items: [failedHead] }));
    renderStatus();

    expect(await screen.findByText('Last deployment')).toBeInTheDocument();
    expect(await screen.findByText('No deployment requests are waiting.')).toBeInTheDocument();
    expect(screen.queryByText(/outcome_unreconciled/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acknowledge outcome' })).not.toBeInTheDocument();
    expect(checked).not.toContainEqual({
      resource: `env:${environmentUuid}`,
      permission: 'deployment.outcome.acknowledge',
    });
  });

  it('hides the outcome action from users without the permission', async () => {
    server.use(
      getListLastDeploymentsMockHandler({ items: [fencedHead] }),
      answerPermissionChecks(
        ({ permission }) => permission !== 'deployment.outcome.acknowledge',
        checked,
      ),
    );
    renderStatus();

    expect(await screen.findByText(/outcome_unreconciled/)).toBeInTheDocument();
    await waitFor(() =>
      expect(checked).toContainEqual({
        resource: `env:${environmentUuid}`,
        permission: 'deployment.outcome.acknowledge',
      }),
    );
    expect(screen.queryByRole('button', { name: 'Acknowledge outcome' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Acknowledging becomes available at/)).not.toBeInTheDocument();
  });

  it('shows the queue before the first Deployment exists', async () => {
    server.use(getListLastDeploymentsMockHandler({ items: [] }));
    renderStatus();

    expect(
      await screen.findByText('Nothing has been deployed to this environment.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('No deployment requests are waiting.')).toBeInTheDocument();
    expect(screen.queryByText('Active resources')).not.toBeInTheDocument();
  });
});
