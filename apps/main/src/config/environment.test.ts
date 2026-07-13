import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('windowEnv defaults', () => {
  beforeEach(() => {
    vi.resetModules();
    (import.meta.env as any).DEV = false;
  });

  // PRODUCT_NAME has a default; BASE_URL does not

  it('env wins when both default and env are set', async () => {
    (window as any).env = { PRODUCT_NAME: 'Custom Product' };
    const { windowEnv } = await import('./environment');
    expect(windowEnv.PRODUCT_NAME).toBe('Custom Product');
  });

  it('default wins when env value is missing', async () => {
    (window as any).env = {};
    const { windowEnv } = await import('./environment');
    expect(windowEnv.PRODUCT_NAME).toBe('Platform Orchestrator');
  });

  it('env wins when no default is defined', async () => {
    (window as any).env = { BASE_URL: 'https://example.com' };
    const { windowEnv } = await import('./environment');
    expect(windowEnv.BASE_URL).toBe('https://example.com');
  });

  it('value is undefined when neither default nor env are set', async () => {
    (window as any).env = {};
    const { windowEnv } = await import('./environment');
    expect(windowEnv.BASE_URL).toBeUndefined();
  });
});
