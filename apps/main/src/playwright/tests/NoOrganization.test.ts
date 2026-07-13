import {
  getCreateOrganizationMockHandler,
  getCreateOrganizationMockHandler403,
  getCreateOrganizationResponseMock,
} from '@src/hooks/react-query/v2/controlplane/organization/organization.msw';
import { getListProjectsMockHandler } from '@src/hooks/react-query/v2/controlplane/project/project.msw';
import { getListSandboxesMockHandler } from '@src/hooks/react-query/v2/controlplane/sandboxes/sandboxes.msw';
import {
  getGetCurrentUserMockHandler,
  getGetCurrentUserResponseMock,
} from '@src/hooks/react-query/v2/iam/user/user.msw';

import { test } from '../testFixtures';

test('auto-creates an organization when user has none and redirects to it', async ({
  page,
  network,
}) => {
  const createdOrg = getCreateOrganizationResponseMock({ id: 'created-org' });
  let orgCreated = false;

  network.use(
    getGetCurrentUserMockHandler(() => {
      if (orgCreated) {
        return {
          ...getGetCurrentUserResponseMock(),
          organization_memberships: [{ id: createdOrg.id }],
          dismissed_prompts: ['welcome-page'],
        };
      }
      return { ...getGetCurrentUserResponseMock(), organization_memberships: [] };
    }),
    getCreateOrganizationMockHandler(() => {
      orgCreated = true;
      return createdOrg;
    }),
    getListProjectsMockHandler(),
    getListSandboxesMockHandler({ items: [] }),
  );

  await page.goto('/');

  await test.expect(page).toHaveURL('/orgs/created-org/projects');
});

test('shows an error when organization creation fails', async ({ page, network }) => {
  network.use(
    getGetCurrentUserMockHandler({
      ...getGetCurrentUserResponseMock(),
      organization_memberships: [],
    }),
    getCreateOrganizationMockHandler403(),
  );

  await page.goto('/');

  await test.expect(page.getByText('Failed to create organization')).toBeVisible();
});
