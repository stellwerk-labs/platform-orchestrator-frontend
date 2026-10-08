import { describe, expect, it } from 'vitest';

import type { CoreModuleVersion } from '@src/models/v2/controlplane';

import { resolveModuleVersionContextualActions } from './contextualActions';
import { isPluginDescriptor } from './pluginValidation';
import type { PluginDescriptor } from './types';

const plugin: PluginDescriptor = {
  id: 'dev.stellwerk.progressive-rollouts',
  display_name: 'Progressive Rollouts',
  state: 'available',
  mode: 'full',
  ui: {
    sdk_version: '1',
    origin: 'https://rollouts.plugins.example.com',
    entrypoint: '/embed',
    route_prefix: 'rollouts',
    navigation_label: 'Rollouts',
    contextual_actions: [
      {
        id: 'progressive-rollouts.create',
        resource_type: 'module_version',
        label: 'Create Progressive Rollout',
        required_operation_id: 'createProgressiveRollout',
        route: {
          path: 'new',
          query: { module: '$module_id', version: '$semantic_version' },
        },
        when: {
          lifecycle_status: ['proposed'],
          semantic_version_required: true,
        },
        primary: true,
      },
    ],
  },
  operations: [
    { id: 'listProgressiveRollouts', method: 'GET', mutating: false },
    { id: 'createProgressiveRollout', method: 'POST', mutating: true },
  ],
};

const version = (lifecycle_status: CoreModuleVersion['lifecycle_status'], semantic?: string) =>
  ({
    uuid: '11111111-1111-4111-8111-111111111111',
    lifecycle_status,
    semantic_version: semantic,
  }) as CoreModuleVersion;

const resolve = (
  descriptor: unknown,
  moduleVersion = version('proposed', '1.2.0-rc.1'),
  apiBaseUrl = 'https://api.example.com',
) =>
  resolveModuleVersionContextualActions(
    [descriptor],
    { orgId: 'atlas', moduleId: 'redis', version: moduleVersion },
    { consoleOrigin: 'https://console.example.com', apiBaseUrl },
  );

describe('module version contextual plugin actions', () => {
  it('resolves a validated relative route from closed context substitutions', () => {
    expect(isPluginDescriptor(plugin)).toBe(true);
    expect(resolve(plugin)).toEqual([
      {
        id: 'dev.stellwerk.progressive-rollouts:progressive-rollouts.create',
        label: 'Create Progressive Rollout',
        href: '/orgs/atlas/rollouts/new?module=redis&version=1.2.0-rc.1',
        primary: true,
      },
    ]);
  });

  it.each([
    'https://attacker.example.com/new',
    '/orgs/atlas/another-plugin/new',
    '../another-plugin',
    'new?next=https://attacker.example.com',
  ])('rejects a route outside the registered plugin mount: %s', (path) => {
    const candidate = {
      ...plugin,
      ui: {
        ...plugin.ui!,
        contextual_actions: [{ ...plugin.ui!.contextual_actions![0], route: { path } }],
      },
    };
    expect(isPluginDescriptor(candidate)).toBe(false);
    expect(resolve(candidate)).toEqual([]);
  });

  it('rejects unknown query substitutions and lifecycle values', () => {
    const unknownContext = {
      ...plugin,
      ui: {
        ...plugin.ui!,
        contextual_actions: [
          {
            ...plugin.ui!.contextual_actions![0],
            route: { path: 'new', query: { module: '$access_token' } },
          },
        ],
      },
    };
    const unknownLifecycle = {
      ...plugin,
      ui: {
        ...plugin.ui!,
        contextual_actions: [
          {
            ...plugin.ui!.contextual_actions![0],
            when: { lifecycle_status: ['running'], semantic_version_required: true },
          },
        ],
      },
    };
    expect(isPluginDescriptor(unknownContext)).toBe(false);
    expect(isPluginDescriptor(unknownLifecycle)).toBe(false);
  });

  it('requires the named plugin operation and full availability mode', () => {
    const withoutOperation = {
      ...plugin,
      operations: [{ id: 'listProgressiveRollouts', method: 'GET', mutating: false }],
    };
    expect(isPluginDescriptor(withoutOperation)).toBe(false);
    expect(resolve(withoutOperation)).toEqual([]);
    for (const mode of ['read_only', 'safety_only', 'hidden'] as const) {
      expect(resolve({ ...plugin, mode })).toEqual([]);
    }
    expect(resolve({ ...plugin, state: 'unavailable' })).toEqual([]);
  });

  it('enforces lifecycle and semantic-version conditions', () => {
    expect(resolve(plugin, version('default', '1.2.0'))).toEqual([]);
    expect(resolve(plugin, version('proposed'))).toEqual([]);
  });

  it('offers no action into a plugin UI that receives the session cookie', () => {
    expect(resolve(plugin, undefined, 'https://plugins.example.com')).toEqual([]);
  });
});
