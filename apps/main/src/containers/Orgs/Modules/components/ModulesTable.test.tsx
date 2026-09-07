import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { ModulesTable } from '@src/containers/Orgs/Modules/components/ModulesTable';
import { getListModuleVersionsMockHandler } from '@src/hooks/react-query/v2/controlplane/modules/modules.msw';
import { ModuleCatalogueEntry } from '@src/models/v2/controlplane';
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
describe('ModulesTable', () => {
  beforeEach(() => {
    server.use(getListModuleVersionsMockHandler({ items: [] }));
    render(
      <MockProviders>
        <ModulesTable modules={mockModules} modulesLoading={false} />
      </MockProviders>,
    );
  });
  it('shows stable catalogue identity, Resource Type and archive state', async () => {
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
    expect(screen.getAllByText('Incomplete Module, no versions')).toHaveLength(2);
  });
});
