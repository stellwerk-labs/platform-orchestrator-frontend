import { ConfigCatWebProvider } from '@openfeature/config-cat-web-provider';
import { InMemoryProvider } from '@openfeature/react-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('provider selection', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('uses InMemoryProvider when self-hosted', async () => {
    vi.doMock('@src/config/environment', () => ({ windowEnv: { DEPLOYMENT_MODE: 'self-hosted' } }));
    const { provider } = await import('./openfeature');
    expect(provider).toBeInstanceOf(InMemoryProvider);
  });

  it('uses ConfigCatWebProvider when saas and SDK key is set', async () => {
    vi.doMock('@src/config/environment', () => ({
      windowEnv: { DEPLOYMENT_MODE: 'saas', CONFIG_CAT_SDK_KEY: 'test-key' },
    }));
    const { provider } = await import('./openfeature');
    expect(provider).toBeInstanceOf(ConfigCatWebProvider);
  });
});
