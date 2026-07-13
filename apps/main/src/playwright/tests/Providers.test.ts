import { faker } from '@faker-js/faker';

import {
  getGetModuleProviderMockHandler,
  getListModuleProvidersMockHandler,
} from '@src/hooks/react-query/v2/controlplane/providers/providers.msw';
import { getGetCurrentUserMockHandler } from '@src/hooks/react-query/v2/iam/user/user.msw';
import { ModuleProvider } from '@src/models/v2/controlplane';
import { runA11yAudit } from '@src/playwright/a11y-helpers';
import { test } from '@src/playwright/testFixtures';

test.describe('Service providers', () => {
  test('list and details providers', async ({ page, network }) => {
    const mockProvider: ModuleProvider = {
      org_id: faker.string.alpha({ length: { min: 10, max: 20 } }),
      provider_type: faker.string.alpha({ length: { min: 10, max: 20 } }),
      id: 'mock-provider',
      description: 'mock-description',
      source: faker.string.alpha({ length: { min: 10, max: 20 } }),
      created_at: `${faker.date.past().toISOString().split('.')[0]}Z`,
      version_constraint: '',
      configuration: {
        configA: 'test',
      },
    };
    network.use(
      getGetCurrentUserMockHandler(),
      getListModuleProvidersMockHandler({
        items: [mockProvider],
      }),
      getGetModuleProviderMockHandler(mockProvider),
    );
    await test.step('should navigate to providers', async () => {
      await page.goto('/');
      await page.getByRole('menuitem', { name: 'Providers' }).click();
      await test.expect(page.getByRole('heading', { name: 'Providers' })).toBeVisible();
      await runA11yAudit(page);
      await test.expect(page.getByText('mock-provider')).toBeVisible();
    });
    await test.step('Should see the provider details', async () => {
      await page.getByText('mock-provider').click();
      await test.expect(page.getByText('mock-description')).toBeVisible();
      await test.expect(page.getByText('configA')).toBeVisible();
    });
  });

  test('should filter correctly', async ({ network, page }) => {
    network.use(
      getGetCurrentUserMockHandler(),
      getListModuleProvidersMockHandler({
        items: [
          {
            created_at: '2025-08-25T10:28:53.88241Z',
            description: 'Provider using default runner environment variables for Google',
            id: 'custom',
            org_id: 'htc-demo-00-gcp',
            provider_type: 'google',
            source: 'hashicorp/google',
          },
          {
            created_at: '2025-07-29T17:29:42.892856Z',
            id: 'default',
            org_id: 'htc-demo-00-gcp',
            provider_type: 'google',
            source: 'hashicorp/google',
          },
          {
            created_at: '2025-07-29T10:57:50.555891Z',
            id: 'default',
            org_id: 'htc-demo-00-gcp',
            provider_type: 'kubernetes',
            source: 'hashicorp/kubernetes',
          },
        ],
      }),
    );

    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Providers' }).click();

    await test.expect(page.getByRole('row')).toHaveCount(4);

    await page.getByPlaceholder('Filter providers').fill('default');

    await test.expect(page.getByRole('row')).toHaveCount(3);

    await page.getByPlaceholder('Filter providers').fill('');

    await test.expect(page.getByRole('row')).toHaveCount(4);
  });
});
