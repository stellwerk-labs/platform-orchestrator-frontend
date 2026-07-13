import { getListProjectsMockHandler } from '@src/hooks/react-query/v2/controlplane/project/project.msw';
import { getGetCurrentUserMockHandler } from '@src/hooks/react-query/v2/iam/user/user.msw';
import { runA11yAudit } from '@src/playwright/a11y-helpers';

import { test } from '../testFixtures';

test.describe('a11y - WCAG 2.1 AA', () => {
  test('Projects should meet a11y standards', async ({ page, network }) => {
    network.use(getGetCurrentUserMockHandler(), getListProjectsMockHandler());
    await page.goto('/');
    await page.getByRole('link', { name: 'Projects' }).click();
    await test.expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
    await runA11yAudit(page);
  });
});
