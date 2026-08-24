import { getListProjectsMockHandler } from '@src/hooks/react-query/v2/controlplane/project/project.msw';
import {
  getCreateServiceUserMockHandler,
  getListServiceUsersMockHandler,
  getRegenerateServiceUserMockHandler,
} from '@src/hooks/react-query/v2/iam/service-user/service-user.msw';
import {
  getCheckPermissionsMockHandler,
  getGetCurrentUserMockHandler,
} from '@src/hooks/react-query/v2/iam/user/user.msw';
import { runA11yAudit } from '@src/playwright/a11y-helpers';

import { test } from '../testFixtures';

test.describe('service users', () => {
  test('should list all available service users', async ({ page, network }) => {
    network.use(
      getGetCurrentUserMockHandler(),
      getListServiceUsersMockHandler(),
      getCreateServiceUserMockHandler(),
      getCheckPermissionsMockHandler({
        items: [
          {
            permission_check: {
              resource: 'organization:playwright-org',
              permission: 'service_user_write',
            },
            allowed: true,
          },
          {
            permission_check: {
              resource: 'organization:playwright-org',
              permission: 'read',
            },
            allowed: true,
          },
          {
            permission_check: {
              resource: 'organization:playwright-org',
              permission: 'manage',
            },
            allowed: true,
          },
        ],
      }),
    );

    await page.goto('/');
    await page.getByText('Service users').click();
    await test.expect(page.getByRole('table', { name: 'Service users' })).toBeVisible();

    const createButton = page.getByRole('button', { name: 'Create service user' });
    await test.expect(createButton).toBeEnabled();
    await createButton.click();

    await test.expect(page.getByRole('dialog', { name: 'Create service user' })).toBeVisible();

    await page.getByRole('textbox', { name: '* Name' }).fill('User 1');
    await page.getByLabel('Expiry in days').fill('25');

    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await test.expect(page.getByRole('dialog', { name: 'Create service user' })).not.toBeVisible();

    await test
      .expect(
        page.getByText(
          "Here's your token. This will not be shown again, so make sure to copy and store it securely.",
        ),
      )
      .toBeVisible();

    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await test.expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test.skip('should be able to regenerate a service user token', async ({ page, network }) => {
    network.use(
      getListProjectsMockHandler(),
      getGetCurrentUserMockHandler(),
      getListServiceUsersMockHandler(),
      getRegenerateServiceUserMockHandler(),
    );

    await page.goto('/');
    await page.getByText('Service users').click();
    await test.expect(page.getByRole('table', { name: 'Service users' })).toBeVisible();
    await runA11yAudit(page);
    await page.getByRole('button', { name: 'Actions' }).nth(1).click();
    await page.getByRole('menuitem', { name: 'Regenerate token' }).click();

    await test
      .expect(page.getByText('Are you sure you revoke and regenerate this service user token?'))
      .toBeVisible();

    await page.getByRole('button', { name: 'Yes' }).click();
    await test.expect(page.getByText(/Token for service user .* regenerated/)).toBeVisible();
  });
});
