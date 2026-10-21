import { afterEach, describe, expect, it } from 'vitest';

import { AXIOS_INSTANCE } from '@src/custom-instance';

import { invokePluginOperation } from './pluginInvocation';

const originalAdapter = AXIOS_INSTANCE.defaults.adapter;

afterEach(() => {
  AXIOS_INSTANCE.defaults.adapter = originalAdapter;
});

describe('plugin operation invocation', () => {
  it('uses the fixed Core invocation endpoint and exact registered-operation envelope', async () => {
    AXIOS_INSTANCE.defaults.adapter = async (config) => {
      expect(config.url).toBe('/orgs/org-one/plugins/dev.stellwerk.progressive-rollouts/invoke');
      expect(config.method).toBe('post');
      expect(JSON.parse(config.data as string)).toEqual({
        operation_id: 'commandProgressiveRollout',
        path_parameters: { rolloutId: 'rollout-one', rolloutCommand: 'pause' },
        body: { reason: 'operator request' },
        idempotency_key: 'pause-once',
      });
      return {
        config,
        data: { status: 200, body: { state: 'Paused' } },
        status: 200,
        statusText: 'OK',
        headers: {},
      };
    };

    await expect(
      invokePluginOperation('org-one', 'dev.stellwerk.progressive-rollouts', {
        operation_id: 'commandProgressiveRollout',
        path_parameters: { rolloutId: 'rollout-one', rolloutCommand: 'pause' },
        body: { reason: 'operator request' },
        idempotency_key: 'pause-once',
      }),
    ).resolves.toEqual({ status: 200, body: { state: 'Paused' } });
  });
});
