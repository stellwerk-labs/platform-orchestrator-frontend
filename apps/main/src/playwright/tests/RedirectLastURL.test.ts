import { getListProjectsMockHandler } from '@src/hooks/react-query/v2/controlplane/project/project.msw';
import { getListSandboxesMockHandler } from '@src/hooks/react-query/v2/controlplane/sandboxes/sandboxes.msw';
import { getGetInvitationMockHandler } from '@src/hooks/react-query/v2/iam/invitation/invitation.msw';
import {
  getGetCurrentUserMockHandler,
  getGetCurrentUserResponseMock,
} from '@src/hooks/react-query/v2/iam/user/user.msw';

import { test } from '../testFixtures';

test.describe('with localstorage already set', () => {
  const url =
    '/accept-invite?orgId=testing-org&inviteId=0198eb99-26e9-76fc-ba54-b3865b3c0062&redemptionToken=ciOolBsZtggv0euKhDTsS8hLx2NkuLh0LTuq88ict7BS';
  test.use({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:5200',
          localStorage: [
            {
              name: 'lastVisitedURL',
              value: url,
            },
          ],
        },
      ],
    },
  });
  test('should redirect to URL when visiting public route', async ({ page, network }) => {
    network.use(
      getGetCurrentUserMockHandler({
        ...getGetCurrentUserResponseMock(),
        organization_memberships: [],
      }),
      getGetInvitationMockHandler(),
    );

    await page.goto('/auth/register');

    await test.expect(page.getByText("You've been invited to join testing-org")).toBeVisible();
    await test.expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
  });
});

test('should not save last visited url if the route does not exist', async ({ page, network }) => {
  network.use(
    getGetCurrentUserMockHandler({
      ...getGetCurrentUserResponseMock(),
      organization_memberships: [{ id: 'org1' }],
      dismissed_prompts: ['welcome-page'],
    }),
    getListProjectsMockHandler(),
    getListSandboxesMockHandler({ items: [] }),
  );

  // Navigate to a non-existent route (will be handled by wildcard)
  await page.goto('/runners');

  // Wait for the wildcard redirect to complete and end up at the projects page
  await test.expect(page).toHaveURL('/orgs/org1/projects');

  // Navigate to register page - since user is logged in, should redirect to projects (not back to /runners)
  await page.goto('/auth/register');

  // Verify redirect goes to projects page (not /runners, proving lastVisitedURL wasn't saved)
  await test.expect(page).toHaveURL('/orgs/org1/projects');
  await test.expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
});
