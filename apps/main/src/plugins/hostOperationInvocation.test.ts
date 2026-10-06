import { afterEach, describe, expect, it, vi } from 'vitest';

import { AXIOS_INSTANCE } from '@src/custom-instance';

import { invokeBridgeOperation } from './hostOperationInvocation';
import type { PluginOperationDescriptor } from './types';

const originalAdapter = AXIOS_INSTANCE.defaults.adapter;
const descriptor = (
  id: string,
  method: PluginOperationDescriptor['method'],
  mutating = false,
): PluginOperationDescriptor => ({ id, method, mutating });

afterEach(() => {
  AXIOS_INSTANCE.defaults.adapter = originalAdapter;
});

describe('allowlisted host operations', () => {
  it('executes an advertised Core read through the Console session', async () => {
    AXIOS_INSTANCE.defaults.adapter = async (config) => {
      expect(config.url).toBe('/orgs/example-org/projects');
      expect(config.method).toBe('get');
      expect(config.params).toEqual({ per_page: 100, page: 'next-page' });
      expect(config.withCredentials).toBe(true);
      return {
        config,
        data: { items: [{ id: 'payments' }] },
        status: 200,
        statusText: 'OK',
        headers: {},
      };
    };

    await expect(
      invokeBridgeOperation(
        'example-org',
        'dev.stellwerk.progressive-rollouts',
        descriptor('core.listProjects', 'GET'),
        {
          operation_id: 'core.listProjects',
          query: { per_page: ['100'], page: ['next-page'] },
        },
      ),
    ).resolves.toEqual({ status: 200, body: { items: [{ id: 'payments' }] } });
  });

  it('binds IAM checks to the active organization and current plugin namespace', async () => {
    await expect(
      invokeBridgeOperation(
        'example-org',
        'dev.stellwerk.progressive-rollouts',
        descriptor('iam.checkPermissions', 'POST'),
        {
          operation_id: 'iam.checkPermissions',
          body: [
            {
              resource: 'organization:another-org',
              permission: 'plugin.dev.stellwerk.progressive-rollouts.rollout-design',
            },
          ],
        },
      ),
    ).rejects.toThrow(/outside the plugin namespace or Core allowlist/);
    await expect(
      invokeBridgeOperation(
        'example-org',
        'dev.stellwerk.progressive-rollouts',
        descriptor('iam.checkPermissions', 'POST'),
        {
          operation_id: 'iam.checkPermissions',
          body: [{ resource: 'organization:example-org', permission: 'organization.admin' }],
        },
      ),
    ).rejects.toThrow(/outside the plugin namespace or Core allowlist/);
    await expect(
      invokeBridgeOperation(
        'example-org',
        'dev.stellwerk.progressive-rollouts',
        descriptor('iam.checkPermissions', 'POST'),
        {
          operation_id: 'iam.checkPermissions',
          body: [
            {
              resource: 'organization:example-org',
              permission: 'plugin.example.other.rollout-design',
            },
          ],
        },
      ),
    ).rejects.toThrow(/outside the plugin namespace or Core allowlist/);
  });

  it('forwards an exact capability in a different registered plugin namespace', async () => {
    AXIOS_INSTANCE.defaults.adapter = async (config) => {
      expect(config.url).toBe('/auth/check-permissions');
      expect(config.method).toBe('post');
      expect(JSON.parse(config.data as string)).toEqual([
        {
          resource: 'organization:example-org',
          permission: 'plugin.example.audit.audit-read',
        },
        {
          resource: 'organization:example-org',
          permission: 'module.version.unpin',
        },
      ]);
      return {
        config,
        data: { items: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
      };
    };

    await expect(
      invokeBridgeOperation(
        'example-org',
        'example.audit',
        descriptor('iam.checkPermissions', 'POST'),
        {
          operation_id: 'iam.checkPermissions',
          body: [
            {
              resource: 'organization:example-org',
              permission: 'plugin.example.audit.audit-read',
            },
            {
              resource: 'organization:example-org',
              permission: 'module.version.unpin',
            },
          ],
        },
      ),
    ).resolves.toEqual({ status: 200, body: { items: [] } });
  });

  it('rejects host operations for an invalid plugin identity', async () => {
    await expect(
      invokeBridgeOperation(
        'example-org',
        'invalid plugin',
        descriptor('iam.checkPermissions', 'POST'),
        {
          operation_id: 'iam.checkPermissions',
          body: [{ resource: 'organization:example-org', permission: 'module.version.unpin' }],
        },
      ),
    ).rejects.toThrow(/not registered for this plugin/);
  });

  it('enforces IAM capability slug and full permission length bounds', async () => {
    const pluginId = 'example.audit';
    const prefix = `plugin.${pluginId}.`;
    const maximumPermission = prefix + 'a'.repeat(255 - prefix.length);
    AXIOS_INSTANCE.defaults.adapter = async (config) => ({
      config,
      data: { items: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
    });

    await expect(
      invokeBridgeOperation('example-org', pluginId, descriptor('iam.checkPermissions', 'POST'), {
        operation_id: 'iam.checkPermissions',
        body: [{ resource: 'organization:example-org', permission: maximumPermission }],
      }),
    ).resolves.toEqual({ status: 200, body: { items: [] } });

    for (const permission of [`${prefix}1reader`, `${prefix}reader-`, maximumPermission + 'a']) {
      await expect(
        invokeBridgeOperation('example-org', pluginId, descriptor('iam.checkPermissions', 'POST'), {
          operation_id: 'iam.checkPermissions',
          body: [{ resource: 'organization:example-org', permission }],
        }),
      ).rejects.toThrow(/outside the plugin namespace or Core allowlist/);
    }
  });

  it('denies a same-user resource from another organization before IAM forwarding', async () => {
    const currentProject = '11111111-1111-4111-8111-111111111111';
    const currentEnvironment = '22222222-2222-4222-8222-222222222222';
    const otherOrganizationEnvironment = '33333333-3333-4333-8333-333333333333';
    const visited: string[] = [];
    AXIOS_INSTANCE.defaults.adapter = async (config) => {
      visited.push(config.url ?? '');
      if (config.url === '/orgs/current-org/projects') {
        return {
          config,
          data: { items: [{ uuid: currentProject }] },
          status: 200,
          statusText: 'OK',
          headers: {},
        };
      }
      if (config.url === '/orgs/current-org/envs') {
        return {
          config,
          data: { items: [{ uuid: currentEnvironment }] },
          status: 200,
          statusText: 'OK',
          headers: {},
        };
      }
      throw new Error(`Unexpected request ${config.url}`);
    };

    await expect(
      invokeBridgeOperation(
        'current-org',
        'dev.stellwerk.progressive-rollouts',
        descriptor('iam.checkPermissions', 'POST'),
        {
          operation_id: 'iam.checkPermissions',
          body: [
            {
              resource: `env:${otherOrganizationEnvironment}`,
              permission: 'plugin.dev.stellwerk.progressive-rollouts.rollout-control',
            },
          ],
        },
      ),
    ).rejects.toThrow(/not a member of the active organization/);
    expect(visited).toEqual(['/orgs/current-org/projects', '/orgs/current-org/envs']);
    expect(visited).not.toContain('/auth/check-permissions');
  });

  it('hardcodes Pin discard and forwards idempotency without accepting an action value', async () => {
    const pinId = '11111111-1111-4111-8111-111111111111';
    AXIOS_INSTANCE.defaults.adapter = async (config) => {
      expect(config.url).toBe(`/orgs/example-org/module-version-pins/${pinId}/actions/discard`);
      expect(config.method).toBe('post');
      expect(config.headers.get('Idempotency-Key')).toBe('discard-once');
      expect(JSON.parse(config.data as string)).toEqual({
        expected_resource_version: 4,
        reason: 'obsolete release hold',
      });
      return {
        config,
        data: { id: pinId, status: 'discarded' },
        status: 200,
        statusText: 'OK',
        headers: {},
      };
    };

    await expect(
      invokeBridgeOperation(
        'example-org',
        'dev.stellwerk.progressive-rollouts',
        descriptor('core.discardEnvironmentModuleVersionPin', 'POST', true),
        {
          operation_id: 'core.discardEnvironmentModuleVersionPin',
          path_parameters: { pinId },
          body: { expected_resource_version: 4, reason: 'obsolete release hold' },
          idempotency_key: 'discard-once',
        },
      ),
    ).resolves.toMatchObject({ status: 200, body: { status: 'discarded' } });
  });

  it('never falls reserved but unknown operations through to the plugin gateway', async () => {
    await expect(
      invokeBridgeOperation(
        'example-org',
        'dev.stellwerk.progressive-rollouts',
        descriptor('core.fetchAnything', 'GET'),
        { operation_id: 'core.fetchAnything' },
      ),
    ).rejects.toThrow(/not allowlisted/);
  });

  it('rejects a discovery descriptor that weakens a host operation contract', async () => {
    await expect(
      invokeBridgeOperation(
        'example-org',
        'dev.stellwerk.progressive-rollouts',
        descriptor('core.discardEnvironmentModuleVersionPin', 'POST', false),
        {
          operation_id: 'core.discardEnvironmentModuleVersionPin',
          path_parameters: { pinId: '11111111-1111-4111-8111-111111111111' },
          body: { expected_resource_version: 4, reason: 'obsolete release hold' },
        },
      ),
    ).rejects.toThrow(/descriptor is incompatible/);
  });

  it('presents Deployment logs in the host without returning plaintext to the plugin', async () => {
    const projectUuid = '11111111-1111-4111-8111-111111111111';
    const environmentUuid = '22222222-2222-4222-8222-222222222222';
    const deploymentId = '33333333-3333-4333-8333-333333333333';
    const plaintext = 'sensitive runner output';
    const visited: string[] = [];
    AXIOS_INSTANCE.defaults.adapter = async (config) => {
      visited.push(config.url ?? '');
      expect(config.url).toBe(
        `/orgs/material-org/plugins/dev.stellwerk.progressive-rollouts/projects/${projectUuid}/envs/${environmentUuid}/deployments/${deploymentId}/logs`,
      );
      expect(config.method).toBe('get');
      expect(config.responseType).toBe('text');
      return { config, data: plaintext, status: 200, statusText: 'OK', headers: {} };
    };
    let presented: unknown;

    const response = await invokeBridgeOperation(
      'material-org',
      'dev.stellwerk.progressive-rollouts',
      descriptor('core.getPluginDeploymentLogs', 'GET'),
      {
        operation_id: 'core.getPluginDeploymentLogs',
        path_parameters: { projectUuid, environmentUuid, deploymentId },
      },
      { presentPluginDeploymentMaterial: (material) => (presented = material) },
    );

    expect(response).toEqual({ status: 204, body: null });
    expect(JSON.stringify(response)).not.toContain(plaintext);
    expect(presented).toEqual({ kind: 'logs', deploymentId, content: plaintext });
    expect(visited).toHaveLength(1);
  });

  it('binds the material route to the active plugin', async () => {
    const projectUuid = '11111111-1111-4111-8111-111111111111';
    const environmentUuid = '22222222-2222-4222-8222-222222222222';
    const deploymentId = '33333333-3333-4333-8333-333333333333';
    AXIOS_INSTANCE.defaults.adapter = async (config) => {
      expect(config.url).toBe(
        `/orgs/material-org/plugins/example.audit/projects/${projectUuid}/envs/${environmentUuid}/deployments/${deploymentId}/outputs`,
      );
      return { config, data: 'audit output', status: 200, statusText: 'OK', headers: {} };
    };

    await expect(
      invokeBridgeOperation(
        'material-org',
        'example.audit',
        descriptor('core.getPluginDeploymentOutputs', 'GET'),
        {
          operation_id: 'core.getPluginDeploymentOutputs',
          path_parameters: { projectUuid, environmentUuid, deploymentId },
        },
        { presentPluginDeploymentMaterial: () => undefined },
      ),
    ).resolves.toEqual({ status: 204, body: null });
  });

  it('does not disclose a material transport failure to the plugin frame', async () => {
    const protectedDetail = 'upstream response contained protected material';
    const presentPluginDeploymentMaterial = vi.fn();
    AXIOS_INSTANCE.defaults.adapter = async () => {
      throw new Error(protectedDetail);
    };

    const invocation = invokeBridgeOperation(
      'material-org',
      'dev.stellwerk.progressive-rollouts',
      descriptor('core.getPluginDeploymentLogs', 'GET'),
      {
        operation_id: 'core.getPluginDeploymentLogs',
        path_parameters: {
          projectUuid: '11111111-1111-4111-8111-111111111111',
          environmentUuid: '22222222-2222-4222-8222-222222222222',
          deploymentId: '33333333-3333-4333-8333-333333333333',
        },
      },
      { presentPluginDeploymentMaterial },
    );

    await expect(invocation).rejects.toThrow(
      'Deployment logs are unavailable or access was denied.',
    );
    await expect(invocation).rejects.not.toThrow(protectedDetail);
    expect(presentPluginDeploymentMaterial).not.toHaveBeenCalled();
  });

  it('routes historical material after Environment deletion without a live membership lookup', async () => {
    const projectUuid = '44444444-4444-4444-8444-444444444444';
    const environmentUuid = '66666666-6666-4666-8666-666666666666';
    const deploymentId = '77777777-7777-4777-8777-777777777777';
    const visited: string[] = [];
    AXIOS_INSTANCE.defaults.adapter = async (config) => {
      visited.push(config.url ?? '');
      expect(config.url).toBe(
        `/orgs/material-history-org/plugins/dev.stellwerk.progressive-rollouts/projects/${projectUuid}/envs/${environmentUuid}/deployments/${deploymentId}/outputs`,
      );
      return { config, data: 'historical output', status: 200, statusText: 'OK', headers: {} };
    };

    await expect(
      invokeBridgeOperation(
        'material-history-org',
        'dev.stellwerk.progressive-rollouts',
        descriptor('core.getPluginDeploymentOutputs', 'GET'),
        {
          operation_id: 'core.getPluginDeploymentOutputs',
          path_parameters: { projectUuid, environmentUuid, deploymentId },
        },
        { presentPluginDeploymentMaterial: () => undefined },
      ),
    ).resolves.toEqual({ status: 204, body: null });
    expect(visited).toHaveLength(1);
  });

  it('rejects extra material path values before constructing a Core route', async () => {
    const visited: string[] = [];
    AXIOS_INSTANCE.defaults.adapter = async (config) => {
      visited.push(config.url ?? '');
      throw new Error(`Unexpected material request ${config.url}`);
    };

    await expect(
      invokeBridgeOperation(
        'material-org',
        'dev.stellwerk.progressive-rollouts',
        descriptor('core.getPluginDeploymentLogs', 'GET'),
        {
          operation_id: 'core.getPluginDeploymentLogs',
          path_parameters: {
            projectUuid: '11111111-1111-4111-8111-111111111111',
            environmentUuid: '22222222-2222-4222-8222-222222222222',
            deploymentId: '33333333-3333-4333-8333-333333333333',
            url: 'https://attacker.example/material',
          },
        },
        { presentPluginDeploymentMaterial: () => undefined },
      ),
    ).rejects.toThrow(/requires exact project, Environment, and Deployment UUIDs/);
    expect(visited).toHaveLength(0);
  });
});
