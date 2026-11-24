import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AXIOS_INSTANCE } from '@src/custom-instance';
import { server } from '@src/testing-utils/mswServer';

import {
  applySavedPlan,
  createPipelineControl,
  createPipelineDeployment,
  getDeploymentPipeline,
  getPipelineControl,
  listDeploymentPipelines,
  replanDeployment,
} from './deploymentPipelineApi';

const original = AXIOS_INSTANCE.defaults.baseURL;
let received: { path?: string; body?: unknown; key?: string };
let respond: (request: IncomingMessage, response: ServerResponse) => void;
const fixture = createServer((request, response) => {
  received.path = request.url;
  received.key = request.headers['idempotency-key'] as string | undefined;
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
  });
  request.on('end', () => {
    received.body = body ? JSON.parse(body) : undefined;
    response.setHeader('Content-Type', 'application/json');
    respond(request, response);
  });
});
beforeAll(async () => {
  await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  AXIOS_INSTANCE.defaults.baseURL = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}`;
  server.close();
});
beforeEach(() => {
  received = {};
  respond = (_request, response) => response.end(JSON.stringify({ id: 'canonical-deployment' }));
});
afterAll(async () => {
  AXIOS_INSTANCE.defaults.baseURL = original;
  server.listen();
  fixture.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    fixture.close((error) => (error ? reject(error) : resolve())),
  );
});

describe('canonical deployment pipeline API', () => {
  it('posts only exact typed control authority through the normal Deployment API', async () => {
    const signal = new AbortController().signal;
    await createPipelineControl(
      'org/one',
      'deployment?two',
      {
        action: 'repair',
        failed_step: 'database',
        revision: 17,
      },
      'control-key',
      signal,
    );
    expect(received).toEqual({
      path: '/orgs/org%2Fone/deployments/deployment%3Ftwo/pipeline/controls',
      body: { action: 'repair', failed_step: 'database', revision: 17 },
      key: 'control-key',
    });
    await getPipelineControl('org/one', 'deployment?two', 'control#three', signal);
    expect(received.path).toBe(
      '/orgs/org%2Fone/deployments/deployment%3Ftwo/pipeline/controls/control%23three',
    );
  });

  it('binds saved Apply to the exact source subject and stable request key', async () => {
    await applySavedPlan('org/one', 'source?two', 'exact-subject', 'apply-key');
    expect(received).toEqual({
      path: '/orgs/org%2Fone/deployments/source%3Ftwo/pipeline/actions/apply-plan',
      key: 'apply-key',
      body: { subject: 'exact-subject' },
    });
  });

  it('requests a fresh Plan without carrying an approval or replacement manifest', async () => {
    await replanDeployment('org', 'source', 'replan-key');
    expect(received).toEqual({
      path: '/orgs/org/deployments/source/pipeline/actions/replan',
      key: 'replan-key',
      body: {},
    });
  });
  it('submits the normal Deployment with its exact recipe and idempotency key', async () => {
    const body = {
      project_id: 'project',
      env_id: 'env',
      mode: 'deploy' as const,
      manifest: { workloads: {} },
      pipeline: { id: 'default', version: 1 },
      managed_logs: true,
    };
    const deployment = await createPipelineDeployment('org', body, 'same-request');
    expect(received).toEqual({ path: '/orgs/org/deployments', key: 'same-request', body });
    expect(deployment.id).toBe('canonical-deployment');
    expect(received.body).not.toHaveProperty('approval_mode');
  });

  it('loads the catalogue from the selected normal environment', async () => {
    respond = (_request, response) => response.end('{"items":[]}');
    await listDeploymentPipelines({
      orgId: 'org/one',
      projectId: 'project?two',
      envId: 'env#three',
    });
    expect(received.path).toBe(
      '/orgs/org%2Fone/projects/project%3Ftwo/envs/env%23three/deployment-pipelines',
    );
  });

  it('recognizes pre-pipeline history without hiding authorization refusal', async () => {
    respond = (_request, response) => {
      response.statusCode = 404;
      response.end('{}');
    };
    expect(await getDeploymentPipeline('org', 'old')).toBeNull();
    respond = (_request, response) => {
      response.statusCode = 403;
      response.end('{}');
    };
    await expect(getDeploymentPipeline('org', 'private')).rejects.toMatchObject({
      response: { status: 403 },
    });
  });
});
