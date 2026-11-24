import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { windowEnv } from '@src/config/environment';
import {
  type DeploymentPipeline,
  pipelineQueryKey,
} from '@src/containers/RunnerRollouts/deploymentPipelineApi';
import type { NativeLogProgress } from '@src/containers/RunnerRollouts/NativePhaseLogs';
import { getGetEnvironmentQueryKey } from '@src/hooks/react-query/v2/controlplane/environment/environment';
import { getCheckPermissionsQueryKey } from '@src/hooks/react-query/v2/iam/user/user';
import { RBACPermission } from '@src/hooks/useRBAC';
import { server } from '@src/testing-utils/mswServer';

import { Logs } from './Logs';

const firstLog = 'deployment completed <img src=x onerror=alert(1)>';
let origin: string;
let respond: (request: IncomingMessage, response: ServerResponse) => void;
let requests = 0;
let clients: QueryClient[] = [];
const originalBaseURL = windowEnv.BASE_URL;
const originalPipelineFlag = windowEnv.RUNNER_ROLLOUTS;
const fixture = createServer((request, response) => {
  response.setHeader('Connection', 'close');
  requests += 1;
  respond(request, response);
});

beforeAll(async () => {
  await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}`;
  server.close();
  windowEnv.BASE_URL = origin;
});
beforeEach(() => {
  requests = 0;
  respond = (_request, response) => response.end(firstLog);
});
afterEach(() => {
  windowEnv.RUNNER_ROLLOUTS = originalPipelineFlag;
  clients.forEach((client) => client.clear());
  clients = [];
});
afterAll(async () => {
  windowEnv.BASE_URL = originalBaseURL;
  server.listen();
  fixture.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    fixture.close((error) => (error ? reject(error) : resolve())),
  );
});

const renderLogs = (
  orgAllowed = true,
  envAllowed = false,
  execution?: DeploymentPipeline & { native_logs?: boolean; progress: NativeLogProgress },
  readAllowed = true,
) => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  clients.push(client);
  client.setQueryData(pipelineQueryKey('atlas', 'first'), execution ?? null);
  client.setQueryData(pipelineQueryKey('second-org', 'second'), null);
  for (const orgId of ['atlas', 'second-org']) {
    client.setQueryData(getGetEnvironmentQueryKey(orgId, 'project', 'env'), {
      uuid: 'environment-id',
    });
    const checks = [
      { resource: `organization:${orgId}`, permission: RBACPermission.DEPLOYMENT_LOGS_READ },
      { resource: 'env:environment-id', permission: RBACPermission.DEPLOYMENT_LOGS_READ },
      { resource: `organization:${orgId}`, permission: RBACPermission.DEPLOYMENT_READ },
      { resource: 'env:environment-id', permission: RBACPermission.DEPLOYMENT_READ },
    ];
    client.setQueryData(getCheckPermissionsQueryKey(checks), {
      items: checks.map((permission_check, index) => ({
        permission_check,
        allowed: (index < 2 || readAllowed) && (index % 2 === 0 ? orgAllowed : envAllowed),
      })),
    });
  }
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/orgs/atlas/projects/project/envs/env/deploys/first/logs']}>
        <Link to={'/orgs/second-org/projects/project/envs/env/deploys/second/logs'}>
          Next deployment
        </Link>
        <Routes>
          <Route
            path={'/orgs/:orgId/projects/:projectId/envs/:envId/deploys/:deployId/logs'}
            element={<Logs />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
};

const openPendingStream = () => {
  let closed = false;
  let finish!: () => void;
  respond = (_request, response) => {
    response.once('close', () => {
      closed = true;
    });
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.write('pending private content');
    finish = () => response.end('late result');
  };
  return { isClosed: () => closed, finish: () => finish() };
};

describe('Deployment Logs', () => {
  it('does not label saved-plan fallback content as Apply logs before Apply starts', () => {
    windowEnv.RUNNER_ROLLOUTS = 'true';
    renderLogs(true, false, {
      definition: { id: 'reviewed', version: 1, name: 'Reviewed', strategy: 'reviewed', steps: [] },
      progress: {
        id: 'first',
        environment_id: 'environment-id',
        revision: 1,
        created_at: '',
        phase: 'awaiting_approval',
        infrastructure_applied: false,
      },
    });
    expect(screen.getByText('Plan logs')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it('shows distinct Apply logs when a post task failed after infrastructure applied', async () => {
    windowEnv.RUNNER_ROLLOUTS = 'true';
    renderLogs(true, false, {
      definition: { id: 'reviewed', version: 1, name: 'Reviewed', strategy: 'reviewed', steps: [] },
      progress: {
        id: 'first',
        environment_id: 'environment-id',
        revision: 1,
        created_at: '',
        phase: 'post_failed',
        infrastructure_applied: true,
      },
    });
    expect(screen.getByRole('radio', { name: 'Plan logs' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Apply logs' })).toBeChecked();
    expect(await screen.findByText(firstLog)).toBeVisible();
    expect(requests).toBe(1);
  });

  it('loads automatically without a key form, renders inert text, and excludes logs from the query cache', async () => {
    const { client } = renderLogs();
    expect(await screen.findByText(firstLog)).toBeVisible();
    expect(screen.queryByLabelText('Log decryption key')).not.toBeInTheDocument();
    expect(within(screen.getByLabelText('Runner logs')).queryByRole('img')).not.toBeInTheDocument();
    const privacy = screen.getByLabelText('Runner logs').closest('.amp-block');
    expect(privacy).toHaveAttribute('data-amp-mask');
    expect(privacy).toHaveAttribute('data-dd-privacy', 'hidden');
    const cached = JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((query) => query.state),
    );
    expect(cached).not.toContain(firstLog);
    expect(requests).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: 'Clear logs' }));
    expect(screen.queryByText(firstLog)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reload logs' }));
    expect(await screen.findByText(firstLog)).toBeVisible();
    expect(requests).toBe(2);
  });

  it('accepts a dedicated environment grant without an organization grant', async () => {
    renderLogs(false, true);
    expect(await screen.findByText(firstLog)).toBeVisible();
    expect(requests).toBe(1);
  });

  it('shows a fixed legacy-key message without rendering ciphertext or a backend body', async () => {
    respond = (_request, response) => {
      response.writeHead(409);
      response.end('sensitive backend body');
    };
    renderLogs();
    expect(await screen.findByText(/This deployment uses a caller-managed log key/)).toBeVisible();
    expect(screen.queryByText('sensitive backend body')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Log decryption key')).not.toBeInTheDocument();
  });

  it('aborts a pending request when cleared and ignores its late result', async () => {
    const pending = openPendingStream();
    renderLogs();
    await waitFor(() => expect(requests).toBe(1));
    await userEvent.click(screen.getByRole('button', { name: 'Clear logs' }));
    await waitFor(() => expect(pending.isClosed()).toBe(true));
    pending.finish();
    expect(screen.queryByLabelText('Runner logs')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('removes old plaintext and automatically fetches the new deployment on navigation', async () => {
    renderLogs();
    await screen.findByText(firstLog);
    respond = (_request, response) => response.end('second deployment');
    await userEvent.click(screen.getByRole('link', { name: 'Next deployment' }));
    expect(screen.queryByText(firstLog)).not.toBeInTheDocument();
    expect(await screen.findByText('second deployment')).toBeVisible();
    expect(requests).toBe(2);
  });

  it('aborts a pending stream on unmount', async () => {
    const pending = openPendingStream();
    const { unmount } = renderLogs();
    await waitFor(() => expect(requests).toBe(1));
    unmount();
    await waitFor(() => expect(pending.isClosed()).toBe(true));
    pending.finish();
  });

  it('denies without the dedicated log permission and never requests log data', () => {
    renderLogs(false);
    expect(
      screen.getByText('You do not have permission to read these deployment logs.'),
    ).toBeVisible();
    expect(requests).toBe(0);
  });
});

it('requires deployment read as well as log read before mounting any private viewer', () => {
  renderLogs(true, false, undefined, false);
  expect(
    screen.getByText('You do not have permission to read these deployment logs.'),
  ).toBeVisible();
  expect(requests).toBe(0);
});
