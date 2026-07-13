import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { ModulesTable } from '@src/containers/Orgs/Modules/components/ModulesTable';
import { ModuleSummary } from '@src/models/v2/controlplane';
import { MockProviders } from '@src/testing-utils/MockProviders';

const mockModules: ModuleSummary[] = [
  {
    created_at: '2025-06-27T11:01:35.631826Z',
    id: 'test-module',
    module_source: 'git::https://example.com/test-module',
    org_id: 'test-org',
    provider_mapping: {},
    resource_type: 'environment',
    updated_at: '2025-06-27T11:39:24.042292Z',
    version_id: '267b2d99-d269-4f1a-bcb9-6cc2a7b036ea',
  },
  {
    created_at: '2025-09-05T16:09:52.201178Z',
    description: 'Test module 2',
    id: 'test-module2',
    module_source: 'https://example.com/test-module2',
    org_id: 'test-org',
    provider_mapping: {
      google: 'google.default',
    },
    resource_type: 'gcs-bucket',
    updated_at: '2025-09-05T16:11:25.751602Z',
    version_id: '7cc50797-a068-49eb-b57a-a175d758affc',
  },
];
describe('ModulesTable', () => {
  beforeEach(() => {
    render(
      <MockProviders>
        <ModulesTable modules={mockModules} modulesLoading={false} />
      </MockProviders>,
    );
  });
  it('should display the module source and provider links correctly', async () => {
    expect(await screen.findAllByRole('row')).toHaveLength(3);
    expect(screen.getAllByRole('link', { name: 'Source' })[0]).toHaveAttribute(
      'href',
      'https://example.com/test-module',
    );
    expect(screen.getAllByRole('link', { name: 'Source' })[1]).toHaveAttribute(
      'href',
      'https://example.com/test-module2',
    );
    expect(screen.getByRole('link', { name: 'google.default' })).toHaveAttribute(
      'href',
      '/orgs/my-org/providers/google/default',
    );
    expect(screen.getByText('-')).toBeVisible();
  });
});
