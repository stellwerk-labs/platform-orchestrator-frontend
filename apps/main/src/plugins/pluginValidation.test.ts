import { describe, expect, it } from 'vitest';

import {
  coreOrgRoute,
  findPluginForOrgPath,
  isExpectedPluginReadyEvent,
  isPluginDescriptor,
  pluginHostRoute,
  validatePluginBridgeRequest,
  validatePluginFrameUrl,
} from './pluginValidation';
import type { PluginBridgeSession, PluginDescriptor } from './types';

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
    core_operations: [
      { id: 'core.listProjects', method: 'GET', mutating: false },
      { id: 'iam.checkPermissions', method: 'POST', mutating: false },
    ],
  },
  operations: [
    { id: 'listProgressiveRollouts', method: 'GET', mutating: false },
    { id: 'commandProgressiveRollout', method: 'POST', mutating: true },
  ],
};

const session: PluginBridgeSession = { nonce: 'session-nonce', orgId: 'org-one', plugin };

describe('plugin registration validation', () => {
  it('accepts bounded server entitlement projections and rejects malformed claims', () => {
    const feature = {
      state: 'valid',
      trust_class: 'development',
      forward: true,
      read: true,
      safety: true,
      expires_at: '2026-10-02T12:00:00Z',
    };
    const descriptor = { ...plugin, entitlement: { features: { example: feature } } };
    expect(isPluginDescriptor(descriptor)).toBe(true);
    expect(isPluginDescriptor({ ...plugin, entitlement: { features: {} } })).toBe(true);
    for (const badFeature of [
      { ...feature, trust_class: 'trusted-by-plugin' },
      { ...feature, forward: 'true' },
      { ...feature, read: undefined },
      { ...feature, safety: undefined },
      { ...feature, expires_at: 'not-a-date' },
    ]) {
      expect(
        isPluginDescriptor({ ...plugin, entitlement: { features: { example: badFeature } } }),
      ).toBe(false);
    }
    expect(
      isPluginDescriptor({ ...plugin, entitlement: { features: { 'core.admin': feature } } }),
    ).toBe(false);
    expect(
      isPluginDescriptor({
        ...plugin,
        entitlement: {
          features: Object.fromEntries(
            Array.from({ length: 65 }, (_, i) => [`feature-${i}`, feature]),
          ),
        },
      }),
    ).toBe(false);
  });

  it('accepts a canonical different-origin HTTPS frame', () => {
    expect(validatePluginFrameUrl(plugin.ui!, 'https://console.example.com').toString()).toBe(
      'https://rollouts.plugins.example.com/embed',
    );
    expect(isPluginDescriptor(plugin)).toBe(true);
  });

  it('rejects same-host cookies across ports, origin escapes and unsupported SDK versions', () => {
    expect(() =>
      validatePluginFrameUrl(
        { ...plugin.ui!, origin: 'https://console.example.com' },
        'https://console.example.com',
      ),
    ).toThrow(/different hostname/);
    expect(() =>
      validatePluginFrameUrl(
        { ...plugin.ui!, origin: 'https://console.example.com:8443' },
        'https://console.example.com:443',
      ),
    ).toThrow(/different hostname/);
    expect(() =>
      validatePluginFrameUrl(
        { ...plugin.ui!, entrypoint: 'https://attacker.example.com/embed' },
        'https://console.example.com',
      ),
    ).toThrow(/registered origin/);
    expect(isPluginDescriptor({ ...plugin, ui: { ...plugin.ui, sdk_version: '2' } })).toBe(false);
  });

  it('separates host operations from plugin operations and rejects collisions', () => {
    expect(
      isPluginDescriptor({
        ...plugin,
        operations: [{ id: 'core.listProjects', method: 'GET', mutating: false }],
      }),
    ).toBe(false);
    expect(
      isPluginDescriptor({
        ...plugin,
        ui: {
          ...plugin.ui!,
          core_operations: [{ id: 'listProgressiveRollouts', method: 'GET', mutating: false }],
        },
      }),
    ).toBe(false);
    expect(
      isPluginDescriptor({
        ...plugin,
        ui: {
          ...plugin.ui!,
          core_operations: [
            { id: 'core.listProjects', method: 'GET', mutating: false },
            { id: 'core.listProjects', method: 'GET', mutating: false },
          ],
        },
      }),
    ).toBe(false);
  });

  it('matches the longest visible registered route and ignores hidden plugins', () => {
    const detail = {
      ...plugin,
      id: 'dev.stellwerk.progressive-rollouts.detail',
      ui: { ...plugin.ui!, route_prefix: 'rollouts/detail' },
    };
    const hidden = { ...detail, id: 'dev.stellwerk.hidden', mode: 'hidden' as const };
    expect(findPluginForOrgPath([plugin, detail, hidden], 'rollouts/detail/123')?.id).toBe(
      detail.id,
    );
    expect(findPluginForOrgPath([hidden], 'rollouts/detail/123')).toBeUndefined();
  });
});

describe('plugin bridge validation', () => {
  it('requires the exact source window, origin and nonce during handshake', () => {
    const source = {} as Window;
    const ready = {
      type: 'stellwerk.plugin.ready',
      sdk_version: '1',
      nonce: session.nonce,
    };
    expect(
      isExpectedPluginReadyEvent(
        { source, origin: plugin.ui!.origin, data: ready },
        source,
        plugin.ui!.origin,
        session.nonce,
      ),
    ).toBe(true);
    expect(
      isExpectedPluginReadyEvent(
        { source: {} as Window, origin: plugin.ui!.origin, data: ready },
        source,
        plugin.ui!.origin,
        session.nonce,
      ),
    ).toBe(false);
    expect(
      isExpectedPluginReadyEvent(
        { source, origin: 'https://attacker.example.com', data: ready },
        source,
        plugin.ui!.origin,
        session.nonce,
      ),
    ).toBe(false);
    expect(
      isExpectedPluginReadyEvent(
        { source, origin: plugin.ui!.origin, data: { ...ready, nonce: 'stale' } },
        source,
        plugin.ui!.origin,
        session.nonce,
      ),
    ).toBe(false);
  });

  it('rejects stale organizations, unknown operations and non-idempotent mutations', () => {
    const request = {
      type: 'stellwerk.plugin.operation.request',
      sdk_version: '1',
      nonce: session.nonce,
      request_id: 'request-one',
      org_id: session.orgId,
      operation_id: 'commandProgressiveRollout',
      body: { command: 'pause' },
    };
    expect(validatePluginBridgeRequest({ ...request, org_id: 'org-two' }, session)).toMatchObject({
      ok: false,
      error: expect.stringContaining('cross-organization'),
    });
    expect(
      validatePluginBridgeRequest({ ...request, operation_id: 'arbitraryCoreFetch' }, session),
    ).toMatchObject({ ok: false, error: expect.stringContaining('not registered') });
    expect(validatePluginBridgeRequest(request, session)).toMatchObject({
      ok: false,
      error: expect.stringContaining('Idempotency Key'),
    });
  });

  it('rejects malformed Idempotency Keys before forwarding any operation', () => {
    const read = {
      type: 'stellwerk.plugin.operation.request',
      sdk_version: '1',
      nonce: session.nonce,
      request_id: 'request-three',
      org_id: session.orgId,
      operation_id: 'listProgressiveRollouts',
    };
    expect(validatePluginBridgeRequest(read, session)).toMatchObject({ ok: true });
    for (const idempotencyKey of ['', 42, null, { key: 'value' }, ['key']]) {
      for (const operationId of ['listProgressiveRollouts', 'commandProgressiveRollout']) {
        expect(
          validatePluginBridgeRequest(
            { ...read, operation_id: operationId, idempotency_key: idempotencyKey },
            session,
          ),
        ).toMatchObject({
          ok: false,
          requestId: 'request-three',
          error: expect.stringContaining('Idempotency Key'),
        });
      }
    }
  });

  it('forwards only the registered envelope and snapshots its JSON body', () => {
    const body = { command: 'pause', nested: { reason: 'operator request' } };
    const result = validatePluginBridgeRequest(
      {
        type: 'stellwerk.plugin.operation.request',
        sdk_version: '1',
        nonce: session.nonce,
        request_id: 'request-two',
        org_id: session.orgId,
        operation_id: 'commandProgressiveRollout',
        path_parameters: { rolloutId: 'rollout-one', rolloutCommand: 'pause' },
        query: { state: ['Running', 'Paused'] },
        body,
        idempotency_key: 'pause-once',
        url: 'https://attacker.example.com',
        method: 'DELETE',
      },
      session,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    body.nested.reason = 'mutated later';
    expect(result.invocation).toEqual({
      operation_id: 'commandProgressiveRollout',
      path_parameters: { rolloutId: 'rollout-one', rolloutCommand: 'pause' },
      query: { state: ['Running', 'Paused'] },
      body: { command: 'pause', nested: { reason: 'operator request' } },
      idempotency_key: 'pause-once',
    });
    expect(result.invocation).not.toHaveProperty('url');
    expect(result.invocation).not.toHaveProperty('method');
  });

  it('keeps child navigation inside the registered mount', () => {
    expect(pluginHostRoute('org-one', 'rollouts', '/new?module=payments')).toBe(
      '/orgs/org-one/rollouts/new?module=payments',
    );
    expect(pluginHostRoute('org-one', 'rollouts', '//attacker.example.com/escape')).toBe(
      '/orgs/org-one/rollouts/escape',
    );
    expect(coreOrgRoute('org-one', '/modules/payments?pin=pin-one')).toBe(
      '/orgs/org-one/modules/payments?pin=pin-one',
    );
    expect(coreOrgRoute('org-one', '/../../auth/login')).toBe('/orgs/org-one/auth/login');
    expect(
      validatePluginBridgeRequest(
        {
          type: 'stellwerk.plugin.navigate-core',
          sdk_version: '1',
          nonce: session.nonce,
          route: '//attacker.example.com/escape',
        },
        session,
      ),
    ).toMatchObject({ ok: false, error: expect.stringContaining('same-origin') });
  });
});
