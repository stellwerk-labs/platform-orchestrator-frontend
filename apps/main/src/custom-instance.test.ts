import { AxiosHeaders } from 'axios';
import { afterEach, expect, it } from 'vitest';

import { AXIOS_INSTANCE, customInstance } from './custom-instance';

const originalAdapter = AXIOS_INSTANCE.defaults.adapter;
afterEach(() => {
  AXIOS_INSTANCE.defaults.adapter = originalAdapter;
});

it('preserves generated and command headers without fabricating an authenticated identity', async () => {
  AXIOS_INSTANCE.defaults.adapter = async (config) => {
    expect(config.url).toBe('/modules');
    expect(config.method).toBe('post');
    expect(JSON.parse(config.data as string)).toEqual({ semantic_version: '1.0.0' });
    expect(config.headers.get('Idempotency-Key')).toBe('publish-once');
    expect(config.headers.get('X-Contract')).toBe('module-version');
    expect(config.headers.get('From')).toBeUndefined();
    expect(config.withCredentials).toBe(true);
    return { config, data: { published: true }, status: 201, statusText: 'Created', headers: {} };
  };

  await expect(
    customInstance(
      {
        url: '/modules',
        method: 'POST',
        data: { semantic_version: '1.0.0' },
        headers: new AxiosHeaders({ 'X-Contract': 'module-version' }),
      },
      { headers: new AxiosHeaders({ 'Idempotency-Key': 'publish-once' }) },
    ),
  ).resolves.toEqual({ published: true });
});
