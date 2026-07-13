import { getListProjectsMockHandler } from '@src/hooks/react-query/v2/controlplane/project/project.msw';
import {
  getGetCurrentUserMockHandler,
  getGetCurrentUserResponseMock,
} from '@src/hooks/react-query/v2/iam/user/user.msw';

import { test } from '../testFixtures';

test.describe('Switch Organization', () => {
  test('should navigate to selected organization', async ({ page, network }) => {
    network.use(
      getGetCurrentUserMockHandler({
        ...getGetCurrentUserResponseMock(),
        display_name: 'User 1',
        organization_memberships: [{ id: 'org1' }, { id: 'org2' }],
      }),
      getListProjectsMockHandler(),
    );
    await page.goto('/orgs/org1/projects');
    await page.getByText('User 1').click();
    await page.getByRole('menuitem', { name: 'org2' }).click();
    await test.expect(page).toHaveURL(`/orgs/org2/projects`);
  });
});
