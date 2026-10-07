import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  getAcknowledgeDeploymentOutcomeMockHandler,
  getAcknowledgeDeploymentOutcomeMockHandler409,
} from '@src/hooks/react-query/v2/controlplane/environment/environment.msw';
import { DeploymentSummary, EnvironmentFence } from '@src/models/v2/dataplane';
import { ResourcePermissionCheck } from '@src/models/v2/iam';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';
import { answerPermissionChecks } from '@src/testing-utils/permissionChecks';

import { AcknowledgeOutcome } from './AcknowledgeOutcome';

const environmentUuid = '0b6b3c58-63c4-4d5e-9b51-4c1a5d1f0a10';
const deploymentId = '5e8a1c3d-2b4f-4a6e-8d9c-1f0e2d3c4b5a';

const failedHead: DeploymentSummary = {
  org_id: 'my-org',
  project_id: 'my-project',
  env_id: 'my-env',
  id: deploymentId,
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
  deployment_id: deploymentId,
  since: '2026-10-07T08:00:00Z',
  remedy: 'acknowledge-outcome',
  remedy_available_at: '2026-10-07T09:00:00Z',
};

const permissionChecks: ResourcePermissionCheck[] = [];

const grant = (...permissions: string[]) =>
  server.use(
    answerPermissionChecks(
      ({ resource, permission }) =>
        resource === `env:${environmentUuid}` && permissions.includes(permission),
      permissionChecks,
    ),
  );

const renderAction = (environmentFence: EnvironmentFence = fence) =>
  render(
    <MockProviders>
      <AcknowledgeOutcome
        deployment={failedHead}
        fence={environmentFence}
        environmentUuid={environmentUuid}
      />
    </MockProviders>,
  );

const openDialog = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Acknowledge outcome' }));
  return screen.findByRole('dialog');
};

const confirm = async () =>
  userEvent.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: 'Acknowledge outcome' }),
  );

describe('AcknowledgeOutcome', () => {
  beforeEach(() => {
    permissionChecks.length = 0;
  });

  it('stays hidden without deployment.outcome.acknowledge on the Environment', async () => {
    grant('deployment_write');
    renderAction();

    await waitFor(() => expect(permissionChecks).toHaveLength(1));
    expect(permissionChecks).toEqual([
      { resource: `env:${environmentUuid}`, permission: 'deployment.outcome.acknowledge' },
    ]);
    expect(screen.queryByRole('button', { name: 'Acknowledge outcome' })).not.toBeInTheDocument();
  });

  it('shows when the action becomes available instead of the action before that time', async () => {
    grant('deployment.outcome.acknowledge');
    renderAction({ ...fence, remedy_available_at: '2999-01-01T12:30:00Z' });

    expect(await screen.findByText(/Acknowledging becomes available at/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acknowledge outcome' })).not.toBeInTheDocument();
  });

  it('turns the waiting state into the action once the dispatch window ends', async () => {
    grant('deployment.outcome.acknowledge');
    renderAction({ ...fence, remedy_available_at: new Date(Date.now() + 1000).toISOString() });

    expect(await screen.findByText(/Acknowledging becomes available at/)).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Acknowledge outcome' }, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Acknowledging becomes available at/)).not.toBeInTheDocument();
  });

  it('is offered at once when the fence carries no dispatch window', async () => {
    grant('deployment.outcome.acknowledge');
    renderAction({ ...fence, remedy_available_at: undefined });

    expect(await screen.findByRole('button', { name: 'Acknowledge outcome' })).toBeInTheDocument();
  });

  it('requires a reason and sends it trimmed for the exact Deployment', async () => {
    grant('deployment.outcome.acknowledge');
    const sent: { url: string; body: unknown }[] = [];
    server.use(
      getAcknowledgeDeploymentOutcomeMockHandler(async ({ request }) => {
        sent.push({ url: new URL(request.url).pathname, body: await request.json() });
        return {
          deployment_id: deploymentId,
          environment_id: environmentUuid,
          plugin_id: 'dev.example.plugin',
          operation_ref: 'rollout',
          actor_id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
          reason: 'Runner job deleted after node loss',
          acknowledged_at: '2026-10-07T09:00:00Z',
          replayed: false,
        };
      }),
    );
    renderAction();

    await openDialog();
    await confirm();
    expect(
      await screen.findByText('Say why the Runner can no longer change the Environment.'),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Reason'), '   ');
    await confirm();
    expect(sent).toHaveLength(0);

    await userEvent.type(screen.getByLabelText('Reason'), 'Runner job deleted after node loss  ');
    await confirm();

    expect(await screen.findByText(/Outcome acknowledged\./)).toBeInTheDocument();
    expect(sent).toEqual([
      {
        url: `/orgs/my-org/projects/my-project/envs/my-env/deployments/${deploymentId}/actions/acknowledge-outcome`,
        body: { reason: 'Runner job deleted after node loss' },
      },
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows the server diagnostics when the Data Plane refuses', async () => {
    grant('deployment.outcome.acknowledge');
    server.use(
      getAcknowledgeDeploymentOutcomeMockHandler409({
        error: 'HTTP-409',
        message: 'the Runner dispatch window is open until 2026-10-07T10:00:00Z',
      }),
    );
    renderAction();

    const dialog = await openDialog();
    await userEvent.type(screen.getByLabelText('Reason'), 'Job is gone');
    await confirm();

    expect(
      await screen.findByText('the Runner dispatch window is open until 2026-10-07T10:00:00Z'),
    ).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
    expect(screen.queryByText(/Outcome acknowledged\./)).not.toBeInTheDocument();
  });
});
