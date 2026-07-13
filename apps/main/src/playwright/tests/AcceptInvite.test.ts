import {
  getGetInvitationMockHandler,
  getRedeemInvitationMockHandler,
} from '@src/hooks/react-query/v2/iam/invitation/invitation.msw.js';
import {
  getGetCurrentUserMockHandler,
  getGetCurrentUserResponseMock,
} from '@src/hooks/react-query/v2/iam/user/user.msw.js';

import { test } from '../testFixtures';

const INVITE_URL =
  'http://localhost:5200/accept-invite?orgId=testing-org&inviteId=01989e1a-e39a-7a34-8a6d-0486167b582b&redemptionToken=BqM4hZbMw6U38fsO-mla4KOvzj_e7_QO79xn3hCxxy53';

test.describe('Invites', () => {
  test("should show not logged in when there's no valid session", async ({ page }) => {
    await page.goto(INVITE_URL);
    await test.expect(page.getByText('Not logged in')).toBeVisible();
    await test.expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    await test.expect(page.getByRole('button', { name: 'Sign up' })).toBeVisible();
  });

  test('should show invite not found screen when user is logged in, but invite is not present', async ({
    page,
    network,
  }) => {
    network.use(getGetCurrentUserMockHandler());
    await page.goto(INVITE_URL);
    await test.expect(page.getByText('Invite not found')).toBeVisible();
  });

  test('should show invite when the user is logged in, and invite exists', async ({
    page,
    network,
  }) => {
    network.use(getGetCurrentUserMockHandler(), getGetInvitationMockHandler());
    await page.goto(INVITE_URL);

    await test.expect(page.getByText("You've been invited to join testing-org")).toBeVisible();
    await test.expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
  });

  test('should navigate to invited org when invite is accepted', async ({ page, network }) => {
    network.use(
      getGetCurrentUserMockHandler({
        ...getGetCurrentUserResponseMock(),
        organization_memberships: [{ id: 'org1' }, { id: 'org2' }, { id: 'org3' }],
      }),
      getGetInvitationMockHandler(),
      getRedeemInvitationMockHandler(),
    );
    await page.goto(INVITE_URL);

    await test.expect(page.getByText("You've been invited to join testing-org")).toBeVisible();

    network.use(
      getGetCurrentUserMockHandler({
        ...getGetCurrentUserResponseMock(),
        organization_memberships: [
          { id: 'org1' },
          { id: 'org2' },
          { id: 'org3' },
          { id: 'testing-org' },
        ],
      }),
    );
    await page.getByRole('button', { name: 'Accept' }).click();
    await test.expect(page).toHaveURL('/orgs/testing-org/projects');
    await test.expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  });
});
