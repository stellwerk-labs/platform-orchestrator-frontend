import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hasValue } from './features';

describe('hasValue', () => {
  it('returns false for undefined', () => expect(hasValue(undefined)).toBe(false));
  it('returns false for empty string', () => expect(hasValue('')).toBe(false));
  it('returns false for whitespace-only string', () => expect(hasValue('  ')).toBe(false));
  it('returns true for a non-empty string', () => expect(hasValue('token')).toBe(true));
  it('returns true for a string with surrounding whitespace', () =>
    expect(hasValue(' token ')).toBe(true));
});

describe('isSaaS and isSelfHosted', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('are both false when DEPLOYMENT_MODE is not set', async () => {
    vi.doMock('@src/config/environment', () => ({ windowEnv: {} }));
    const { isSelfHosted, isSaaS } = await import('./features');
    expect(isSelfHosted).toBe(false);
    expect(isSaaS).toBe(false);
  });

  it('correctly set on self-hosted', async () => {
    vi.doMock('@src/config/environment', () => ({ windowEnv: { DEPLOYMENT_MODE: 'self-hosted' } }));
    const { isSelfHosted, isSaaS } = await import('./features');
    expect(isSelfHosted).toBe(true);
    expect(isSaaS).toBe(false);
  });

  it('correctly set on saas', async () => {
    vi.doMock('@src/config/environment', () => ({ windowEnv: { DEPLOYMENT_MODE: 'saas' } }));
    const { isSelfHosted, isSaaS } = await import('./features');
    expect(isSelfHosted).toBe(false);
    expect(isSaaS).toBe(true);
  });
});

describe('features', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('disables all SaaS-only features when self-hosted', async () => {
    vi.doMock('@src/config/environment', () => ({ windowEnv: { DEPLOYMENT_MODE: 'self-hosted' } }));
    const { features } = await import('./features');
    expect(features).toEqual({
      configCat: false,
      amplitude: false,
      socialLogins: false,
      invites: false,
      datadog: false,
    });
  });

  it('enables all features when saas and production', async () => {
    vi.doMock('@src/config/environment', () => ({
      windowEnv: {
        AMPLITUDE_API_KEY: 'amplitude',
        DEPLOYMENT_MODE: 'saas',
        ENVIRONMENT_NAME: 'production',
        CONFIG_CAT_SDK_KEY: 'key',
        MICROSOFT_CLIENT_ID: 'ms-id',
        GOOGLE_CLIENT_ID: 'google-id',
        DATADOG_CLIENT_TOKEN: 'token',
        DATADOG_APPLICATION_ID: 'app-id',
        DATADOG_SERVICE: 'service',
        DATADOG_SITE: 'datadoghq.eu',
      },
    }));
    const { features } = await import('./features');
    expect(features).toEqual({
      configCat: true,
      amplitude: true,
      socialLogins: true,
      invites: true,
      datadog: true,
    });
  });

  it('disables amplitude when saas but not production', async () => {
    vi.doMock('@src/config/environment', () => ({
      windowEnv: {
        DEPLOYMENT_MODE: 'saas',
        ENVIRONMENT_NAME: 'development',
        AMPLITUDE_API_KEY: 'amplitude',
      },
    }));
    const { features } = await import('./features');
    expect(features.amplitude).toBe(false);
  });

  it('disables datadog when environment is local', async () => {
    vi.doMock('@src/config/environment', () => ({
      windowEnv: {
        DEPLOYMENT_MODE: 'saas',
        ENVIRONMENT_NAME: 'local',
        DATADOG_CLIENT_TOKEN: 'token',
        DATADOG_APPLICATION_ID: 'app-id',
        DATADOG_SERVICE: 'service',
        DATADOG_SITE: 'datadoghq.eu',
      },
    }));
    const { features } = await import('./features');
    expect(features.datadog).toBe(false);
  });

  it('disables datadog when token is not specified', async () => {
    vi.doMock('@src/config/environment', () => ({
      windowEnv: {
        DEPLOYMENT_MODE: 'saas',
        ENVIRONMENT_NAME: 'production',
        DATADOG_CLIENT_TOKEN: '',
        DATADOG_APPLICATION_ID: 'app-id',
        DATADOG_SERVICE: 'service',
        DATADOG_SITE: 'datadoghq.eu',
      },
    }));
    const { features } = await import('./features');
    expect(features.datadog).toBe(false);
  });

  it('disables datadog when application id is not specified', async () => {
    vi.doMock('@src/config/environment', () => ({
      windowEnv: {
        DEPLOYMENT_MODE: 'saas',
        ENVIRONMENT_NAME: 'production',
        DATADOG_CLIENT_TOKEN: 'token',
        DATADOG_APPLICATION_ID: '',
        DATADOG_SERVICE: 'service',
        DATADOG_SITE: 'datadoghq.eu',
      },
    }));
    const { features } = await import('./features');
    expect(features.datadog).toBe(false);
  });

  it('disables datadog when token is empty', async () => {
    vi.doMock('@src/config/environment', () => ({
      windowEnv: {
        DEPLOYMENT_MODE: 'saas',
        ENVIRONMENT_NAME: 'production',
        DATADOG_CLIENT_TOKEN: ' ',
        DATADOG_APPLICATION_ID: 'app-id',
        DATADOG_SERVICE: 'service',
        DATADOG_SITE: 'datadoghq.eu',
      },
    }));
    const { features } = await import('./features');
    expect(features.datadog).toBe(false);
  });

  it('disables config cat when sdk key is not specified', async () => {
    vi.doMock('@src/config/environment', () => ({
      windowEnv: {
        DEPLOYMENT_MODE: 'saas',
        CONFIG_CAT_SDK_KEY: '',
      },
    }));
    const { features } = await import('./features');
    expect(features.configCat).toBe(false);
  });
});
