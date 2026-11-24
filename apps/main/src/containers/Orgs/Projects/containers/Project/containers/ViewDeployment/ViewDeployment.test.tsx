import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { getGetDeploymentMockHandler } from '@src/hooks/react-query/v2/dataplane/deployment/deployment.msw';
import { getListOrgMembershipsMockHandler } from '@src/hooks/react-query/v2/iam/membership/membership.msw';
import { getListServiceUsersMockHandler } from '@src/hooks/react-query/v2/iam/service-user/service-user.msw';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

import { ViewDeployment } from './ViewDeployment';

it.each([
  [
    'executing',
    'A worker refused a delivery attempt (capability_refused). Execution may still be running.',
    true,
  ],
  ['executing', 'Deploying...', false],
  ['succeeded', 'OLD_HISTORICAL_NOTICE', false],
] as const)(
  'renders historical delivery information only for an executing deployment (%s, %s)',
  async (status, statusMessage, visible) => {
    server.use(
      getListOrgMembershipsMockHandler({ items: [] }),
      getListServiceUsersMockHandler({ items: [] }),
      getGetDeploymentMockHandler({
        org_id: 'my-org',
        project_id: 'my-project',
        env_id: 'my-env',
        id: 'execution',
        created_at: '2026-11-22T10:00:00Z',
        created_by: 'user-1',
        mode: 'observation',
        plan_only: false,
        status,
        status_message: statusMessage,
        runner_id: 'site',
        manifest: { workloads: {} },
        metrics: { num_workloads: 1, num_resource_nodes: 2 },
      }),
    );
    render(
      <MockProviders
        route={{
          path: '/orgs/:orgId/projects/:projectId/envs/:envId/deploys/:deployId/resources',
          url: '/orgs/my-org/projects/my-project/envs/my-env/deploys/execution/resources',
        }}>
        <ViewDeployment />
      </MockProviders>,
    );
    expect(await screen.findByRole('heading', { name: 'execution' })).toBeVisible();
    if (visible) expect(screen.getByRole('alert')).toHaveTextContent(statusMessage);
    else expect(screen.queryByText(statusMessage)).not.toBeInTheDocument();
  },
);
