import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { createMemoryRouter, RouterProvider } from 'react-router';

import {
  getListPluginAuditEventsMockHandler,
  getListPluginPackagesMockHandler,
} from '@src/hooks/react-query/v2/controlplane/plugin-manager/plugin-manager.msw';
import { i18n } from '@src/i18n/i18n';
import type {
  PluginAuditEvent,
  PluginEnablement,
  PluginEntitlementGrant,
  PluginInstallation,
  PluginPackage,
} from '@src/models/v2/controlplane';
import { server } from '@src/testing-utils/mswServer';
import { answerPermissionChecks } from '@src/testing-utils/permissionChecks';

import { pluginManagerRoute } from './pluginManagerRoute';

export const installationId = '3f2b6a3e-0f4c-4a43-9c59-1d6c1f0a7e01';
export const digestV1 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
export const digestV2 = 'b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1';
const actor = '11111111-1111-4111-8111-111111111111';
const time = '2026-10-08T10:00:00Z';

export const pluginPackage = (overrides: Partial<PluginPackage> = {}): PluginPackage => ({
  manifest_sha256: digestV1,
  plugin_id: 'com.example.rollouts',
  version: '1.4.0',
  manifest: {},
  created_at: time,
  created_by: actor,
  ...overrides,
});

export const grant = (overrides: Partial<PluginEntitlementGrant> = {}): PluginEntitlementGrant => ({
  scope: 'installation',
  issuer: 'example-issuer',
  issuance_id: '22222222-2222-4222-8222-222222222222',
  sequence: 3,
  features: ['rollouts'],
  trust_class: 'production',
  not_before: '2026-01-01T00:00:00Z',
  expires_at: '2027-01-01T00:00:00Z',
  grace_until: '2027-02-01T00:00:00Z',
  state: 'valid',
  ...overrides,
});

export const enablement = (overrides: Partial<PluginEnablement> = {}): PluginEnablement => ({
  org_id: 'acme',
  state: 'enabled',
  timezone: 'Europe/Berlin',
  approval_policies: {},
  created_at: time,
  created_by: actor,
  updated_at: time,
  updated_by: actor,
  capability_registration: { state: 'registered' },
  ...overrides,
});

export const installation = (overrides: Partial<PluginInstallation> = {}): PluginInstallation => ({
  installation_id: installationId,
  plugin_id: 'com.example.rollouts',
  package_sha256: digestV1,
  state: 'active',
  availability: 'available',
  backend_url: 'http://rollouts.plugins.svc',
  organization_mode: 'selected',
  organization_defaults: { timezone: 'UTC', approval_policies: {} },
  organizations: [],
  created_at: time,
  created_by: actor,
  updated_at: time,
  updated_by: actor,
  ...overrides,
});

export const auditEvent = (
  id: number,
  overrides: Partial<PluginAuditEvent> = {},
): PluginAuditEvent => ({
  id,
  revision: id,
  occurred_at: time,
  actor,
  action: 'plugin_installation.activate',
  installation_id: installationId,
  reason: `reason ${id}`,
  idempotency_key_sha256: 'f'.repeat(64),
  ...overrides,
});

export const servePackages = (...items: PluginPackage[]) =>
  server.use(getListPluginPackagesMockHandler({ revision: 1, items }));

export const serveAuditTrail = (events: PluginAuditEvent[]) => {
  const requests: URL[] = [];
  server.use(
    getListPluginAuditEventsMockHandler(({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      const after = Number(url.searchParams.get('after') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 100);
      return { items: events.filter(({ id }) => id > after).slice(0, limit) };
    }),
  );
  return requests;
};

/** Answers the permission checks the Console sends: allowed only for plugin_manager_read on platform. */
export const operatorCanRead = (allowed: boolean) =>
  server.use(
    answerPermissionChecks(
      ({ resource, permission }) =>
        allowed && resource === 'platform' && permission === 'plugin_manager_read',
    ),
  );

export const renderPluginManager = (url: string) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nextProvider i18n={i18n}>
        <RouterProvider
          router={createMemoryRouter([pluginManagerRoute], { initialEntries: [url] })}
        />
      </I18nextProvider>
    </QueryClientProvider>,
  );
