import {
  getAcceptDeviceLoginRequestMockHandler,
  getGetDeviceLoginRequestMockHandler,
  getGetDeviceLoginRequestMockHandler404,
  getRejectDeviceLoginRequestMockHandler,
} from '@src/hooks/react-query/v2/iam/device/device.msw';
import { getGetCurrentUserMockHandler } from '@src/hooks/react-query/v2/iam/user/user.msw';
import { runA11yAudit } from '@src/playwright/a11y-helpers';

import { test } from '../testFixtures';

test.describe.parallel('device login', () => {
  test('should show no login found when logged in but not valid login', async ({
    network,
    page,
  }) => {
    network.use(getGetCurrentUserMockHandler(), getGetDeviceLoginRequestMockHandler404());
    await page.goto('/devicelogins/AAA-BBB');
    await test.expect(page.getByText('This login request could not be found')).toBeVisible();
  });

  test('should be able to navigate to projects from device login page', async ({
    network,
    page,
  }) => {
    network.use(getGetCurrentUserMockHandler(), getGetDeviceLoginRequestMockHandler404());
    await page.goto('/devicelogins/AAA-BBB');
    await page.getByText('Projects').click();
    await test.expect(page).toHaveURL(/.*\/orgs\/([^/]+)\/projects$/);
  });

  test.describe('with valid device login', () => {
    test.beforeEach(async ({ network, page }) => {
      network.use(
        getGetDeviceLoginRequestMockHandler(),
        getRejectDeviceLoginRequestMockHandler(),
        getAcceptDeviceLoginRequestMockHandler(),
        getGetCurrentUserMockHandler(),
      );
      await page.goto('/devicelogins/AAA-BBB');
    });

    test('should display the login info', async ({ page }) => {
      await test
        .expect(page.getByText('A new device is attempting to authenticate with your account.'))
        .toBeVisible();

      await test.expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
      await test.expect(page.getByRole('button', { name: 'Reject' })).toBeVisible();
      await runA11yAudit(page);
    });

    test('should display rejected when rejected', async ({ page }) => {
      await page.getByRole('button', { name: 'Reject' }).click();

      await test.expect(page.getByText('You rejected this request')).toBeVisible();
    });

    test('should display accepted when accepted', async ({ page }) => {
      await page.getByRole('button', { name: 'Accept' }).click();

      await test.expect(page.getByText('You accepted this request')).toBeVisible();
    });
  });
});
