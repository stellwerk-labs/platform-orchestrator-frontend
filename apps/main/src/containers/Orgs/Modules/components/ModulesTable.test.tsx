import { QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { ModulesTable } from '@src/containers/Orgs/Modules/components/ModulesTable';
import { getListModuleVersionsQueryKey } from '@src/hooks/react-query/v2/controlplane/modules/modules';
import type { CoreModuleVersionDetail, ModuleCatalogueEntry } from '@src/models/v2/controlplane';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

const mockModules: ModuleCatalogueEntry[] = [
  {
    created_at: '2025-06-27T11:01:35.631826Z',
    display_name: 'Test Module',
    description: '',
    managed_default_generation: 0,
    org_id: 'test-org',
    resource_type: 'environment',
    resource_version: 1,
    slug: 'test-module',
    status: 'active',
    tags: {},
    uuid: '267b2d99-d269-4f1a-bcb9-6cc2a7b036ea',
  },
  {
    created_at: '2025-09-05T16:09:52.201178Z',
    description: 'Test module 2',
    display_name: 'Test Module 2',
    managed_default_generation: 1,
    org_id: 'test-org',
    resource_type: 'gcs-bucket',
    resource_version: 2,
    slug: 'test-module2',
    status: 'archived',
    tags: { team: 'storage' },
    uuid: '7cc50797-a068-49eb-b57a-a175d758affc',
  },
];

const clients: QueryClient[] = [];
afterEach(async () => {
  await Promise.all(clients.map((client) => client.cancelQueries()));
  clients.splice(0).forEach((client) => client.clear());
});

const createClient = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  clients.push(client);
  return client;
};

const mockVersion = (
  uuid: string,
  semanticVersion: string,
  lifecycleStatus: CoreModuleVersionDetail['version']['lifecycle_status'],
): CoreModuleVersionDetail =>
  ({
    version: {
      org_id: 'test-org',
      module_uuid: '267b2d99-d269-4f1a-bcb9-6cc2a7b036ea',
      module_slug: 'test-module',
      uuid,
      semantic_version: semanticVersion,
      opaque_version_id: semanticVersion,
      migration_generation: 'v1',
      artifact_digest: '',
      verification_status: 'unverified',
      lifecycle_status: lifecycleStatus,
      source_revision: '',
      resource_version: 1,
      created_at: '2026-09-08T10:00:00Z',
    },
  }) as CoreModuleVersionDetail;

const seedVersionHistory = (
  client: QueryClient,
  module: ModuleCatalogueEntry,
  items: CoreModuleVersionDetail[],
) => {
  client.setQueryData(
    getListModuleVersionsQueryKey(module.org_id, module.slug, {
      include_deprecated: true,
      include_defective: true,
    }),
    { items },
  );
};

describe('ModulesTable', () => {
  const renderTable = (modules = mockModules, queryClient = createClient()) =>
    render(
      <MockProviders queryClient={queryClient}>
        <ModulesTable modules={modules} modulesLoading={false} />
      </MockProviders>,
    );

  it('shows stable catalogue identity, Resource Type and archive state', async () => {
    const client = createClient();
    for (const module of mockModules) seedVersionHistory(client, module, []);

    renderTable(mockModules, client);
    expect(await screen.findAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Test Module' })).toHaveAttribute(
      'href',
      '/orgs/my-org/modules/test-module/configuration',
    );
    expect(screen.getByRole('link', { name: 'gcs-bucket' })).toHaveAttribute(
      'href',
      '/orgs/my-org/resource-types/gcs-bucket',
    );
    expect(screen.getByText('archived')).toBeVisible();
    expect(await screen.findAllByText('Incomplete Module, no versions')).toHaveLength(2);
  });

  it('does not claim a readable catalogue Module is incomplete when version history is forbidden', async () => {
    const readableModule: ModuleCatalogueEntry = {
      created_at: '2025-06-27T11:01:35.631826Z',
      display_name: 'Test Module',
      description: '',
      managed_default_generation: 1,
      org_id: 'test-org',
      resource_type: 'environment',
      resource_version: 1,
      slug: 'test-module',
      status: 'active',
      tags: {},
      uuid: '267b2d99-d269-4f1a-bcb9-6cc2a7b036ea',
      current_default_version_uuid: '00000000-0000-0000-0000-000000000001',
    };
    server.use(
      http.get('http://example.com/orgs/:orgId/modules/:moduleId/versions', () =>
        HttpResponse.json(
          {
            error: 'forbidden',
            message: 'module.version.read is required',
          },
          { status: 403 },
        ),
      ),
    );

    renderTable([readableModule]);

    expect(await screen.findByText('Version history requires module.version.read')).toBeVisible();
    expect(screen.getByText('Default unavailable')).toBeVisible();
    expect(screen.getByText('Permission required')).toBeVisible();
    expect(screen.queryByText('Incomplete Module, no versions')).not.toBeInTheDocument();
    expect(screen.queryByText('Default none')).not.toBeInTheDocument();
    expect(screen.queryByText('Never')).not.toBeInTheDocument();
  });

  it('keeps lifecycle pending while version history is loading', async () => {
    let resolveVersions: () => void = () => undefined;
    const versionHistoryStarted = new Promise<void>((resolve) => {
      server.use(
        http.get('http://example.com/orgs/:orgId/modules/:moduleId/versions', async () => {
          resolve();
          await new Promise<void>((resume) => {
            resolveVersions = resume;
          });
          return HttpResponse.json({ items: [] });
        }),
      );
    });

    renderTable([mockModules[0]!]);

    await versionHistoryStarted;
    expect(await screen.findByText('Loading version history…')).toBeVisible();
    expect(screen.getByText('Loading…')).toBeVisible();

    resolveVersions();
    expect(await screen.findByText('Incomplete Module, no versions')).toBeVisible();
  });

  it('does not claim a readable catalogue Module is incomplete when version history fails', async () => {
    server.use(
      http.get('http://example.com/orgs/:orgId/modules/:moduleId/versions', () =>
        HttpResponse.json(
          {
            error: 'internal',
            message: 'version history failed',
          },
          { status: 500 },
        ),
      ),
    );

    renderTable([mockModules[0]!]);

    expect(await screen.findByText('Version history could not be loaded')).toBeVisible();
    expect(screen.getByText('Default unavailable')).toBeVisible();
    expect(screen.getByText('Unavailable')).toBeVisible();
    expect(screen.queryByText('Incomplete Module, no versions')).not.toBeInTheDocument();
    expect(screen.queryByText('Never')).not.toBeInTheDocument();
  });

  it('does not claim a Module has no versions when history contains no Default version', async () => {
    const proposedOnlyModule: ModuleCatalogueEntry = {
      created_at: '2025-06-27T11:01:35.631826Z',
      display_name: 'Test Module',
      description: '',
      managed_default_generation: 0,
      org_id: 'test-org',
      resource_type: 'environment',
      resource_version: 1,
      slug: 'test-module',
      status: 'active',
      tags: {},
      uuid: '267b2d99-d269-4f1a-bcb9-6cc2a7b036ea',
    };
    const client = createClient();
    seedVersionHistory(client, proposedOnlyModule, [
      mockVersion('00000000-0000-0000-0000-000000000001', '1.1.0-rc.1', 'proposed'),
      mockVersion('00000000-0000-0000-0000-000000000002', '1.0.0', 'deprecated'),
    ]);

    renderTable([proposedOnlyModule], client);

    expect(await screen.findByText('No Default version')).toBeVisible();
    expect(screen.getByText('Default none')).toBeVisible();
    expect(screen.getByText('Proposed 1.1.0-rc.1')).toBeVisible();
    expect(screen.getByText('08 Sep 2026, 10:00 UTC')).toBeVisible();
    expect(screen.queryByText('Incomplete Module, no versions')).not.toBeInTheDocument();
    expect(screen.queryByText('Never')).not.toBeInTheDocument();
  });
});
