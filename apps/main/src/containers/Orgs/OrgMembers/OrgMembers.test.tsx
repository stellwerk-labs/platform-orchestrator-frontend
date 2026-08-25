import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { getGetEnvironmentMockHandler } from '@src/hooks/react-query/v2/controlplane/environment/environment.msw';
import { getGetProjectMockHandler } from '@src/hooks/react-query/v2/controlplane/project/project.msw';
import {
  getCreateInvitationMockHandler,
  getCreateInvitationResponseMock,
  getListInvitationsMockHandler,
  getListInvitationsResponseMock,
  getRevokeInvitationMockHandler,
} from '@src/hooks/react-query/v2/iam/invitation/invitation.msw';
import {
  getDeleteOrgMembershipMockHandler,
  getListMembersMockHandler,
  getListMembersResponseMock,
  getListOrgMembershipsMockHandler,
  getReplaceOrgUserMembershipsMockHandler,
} from '@src/hooks/react-query/v2/iam/membership/membership.msw';
import { getListRolesMockHandler } from '@src/hooks/react-query/v2/iam/role/role.msw';
import {
  getCheckPermissionsMockHandler,
  getGetCurrentUserMockHandler,
} from '@src/hooks/react-query/v2/iam/user/user.msw';
import { ResourcePermissionCheckResult } from '@src/models/v2/iam';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

import { OrgMembers } from './OrgMembers';

const onlyReadPermissions: ResourcePermissionCheckResult = {
  items: [
    {
      allowed: false,
      permission_check: {
        permission: 'membership_write',
        resource: 'organization:my-org',
      },
    },
    {
      allowed: false,
      permission_check: {
        permission: 'invitation_write',
        resource: 'organization:my-org',
      },
    },
    {
      allowed: true,
      permission_check: {
        permission: 'read',
        resource: 'organization:my-org',
      },
    },
  ],
};

let request: any;
let deleteMemberRequestSent = false;
let revokeInvitationRequestSent = false;
let replaceUserMembershipsRequest: any;

const openMemberMenu = async () => {
  const memberRow = (await screen.findByRole('link')).closest('tr');
  expect(memberRow).not.toBeNull();
  await userEvent.click(await within(memberRow!).findByRole('button', { name: 'Open menu' }));
};

const openInvitationMenu = async () => {
  await screen.findAllByRole('button', { name: 'Open menu' });
  const invitationRow = (await screen.findAllByRole('row')).find(
    (row) =>
      within(row).queryByRole('button', { name: 'Open menu' }) && !within(row).queryByRole('link'),
  );
  expect(invitationRow).toBeDefined();
  await userEvent.click(within(invitationRow!).getByRole('button', { name: 'Open menu' }));
};

describe('OrgMembers', () => {
  beforeEach(async () => {
    request = null;
    deleteMemberRequestSent = false;
    revokeInvitationRequestSent = false;
    replaceUserMembershipsRequest = null;
    server.use(
      getListMembersMockHandler({
        items: [getListMembersResponseMock().items[0]!],
      }),
      getListInvitationsMockHandler({ items: [getListInvitationsResponseMock().items[0]!] }),
      getListRolesMockHandler({
        items: [
          {
            created_at: '2025-09-24T12:40:13.570611Z',
            created_by: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
            display_name: 'Admin',
            id: 'c77c670e-8464-4352-9c86-4fef1d523f22',
            is_system: false,
            permissions: ['manage_all'],
          },
          {
            created_at: '2025-09-24T12:40:13.570611Z',
            created_by: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
            display_name: 'Viewer',
            id: '41d9ab07-037d-4138-b111-1527617d01a2',
            is_system: false,
            permissions: ['read_all'],
          },
        ],
      }),
      getCheckPermissionsMockHandler({
        items: [
          {
            allowed: true,
            permission_check: {
              permission: 'membership_write',
              resource: 'organization:my-org',
            },
          },
          {
            allowed: true,
            permission_check: {
              permission: 'invitation_write',
              resource: 'organization:my-org',
            },
          },
          {
            allowed: true,
            permission_check: {
              permission: 'read',
              resource: 'organization:my-org',
            },
          },
        ],
      }),
      getGetProjectMockHandler(),
      getGetEnvironmentMockHandler(),
      getGetCurrentUserMockHandler(),
      getCreateInvitationMockHandler(async (info) => {
        request = await info.request.json();
        return getCreateInvitationResponseMock();
      }),
      getDeleteOrgMembershipMockHandler(async () => {
        deleteMemberRequestSent = true;
      }),
      getRevokeInvitationMockHandler(async () => {
        revokeInvitationRequestSent = true;
      }),
      getReplaceOrgUserMembershipsMockHandler(async (info) => {
        replaceUserMembershipsRequest = await info.request.json();
        return { items: [] }; // Return empty response
      }),
    );
  });

  it('should populate the dropdown with roles', async () => {
    render(
      <MockProviders>
        <OrgMembers />
      </MockProviders>,
    );

    // Open modal
    await userEvent.click(await screen.findByRole('button', { name: 'Invite users' }));

    // Click to open the dropdown
    await userEvent.click(
      await screen.findByRole('combobox', { name: 'Select an organization role' }),
    );

    // Wait for dropdown portal and check options using within(document.body)
    expect(await within(document.body).findByText('Admin')).toBeVisible();
    expect(await within(document.body).findByText('Viewer')).toBeVisible();
  });

  it('should send the correct request', async () => {
    render(
      <MockProviders>
        <OrgMembers />
      </MockProviders>,
    );

    // Open modal
    await userEvent.click(await screen.findByRole('button', { name: 'Invite users' }));

    // Select a role first (Viewer by default)
    await userEvent.click(
      await screen.findByRole('combobox', { name: 'Select an organization role' }),
    );

    // Select Viewer role from dropdown
    const viewerOption = await within(document.body).findByText('Viewer');
    await userEvent.click(viewerOption);

    await userEvent.type(await screen.findByPlaceholderText('Email'), 'example@example.com');
    await userEvent.click(await screen.findByRole('button', { name: 'Send invites' }));

    await waitFor(() =>
      expect(request).toEqual({
        email_address: 'example@example.com',
        membership_subject: '41d9ab07-037d-4138-b111-1527617d01a2',
        membership_subject_type: 'role',
      }),
    );
  });

  it('should send the correct request when switching roles', async () => {
    render(
      <MockProviders>
        <OrgMembers />
      </MockProviders>,
    );

    // Open modal
    await userEvent.click(await screen.findByRole('button', { name: 'Invite users' }));

    // Open dropdown
    await userEvent.click(
      await screen.findByRole('combobox', { name: 'Select an organization role' }),
    );

    // Wait for dropdown portal and click Admin option
    // Find all Admin texts and click on the one in the dropdown (not the table)
    await waitFor(async () => {
      const dropdown = document.querySelector('.ant-select-dropdown');
      expect(dropdown).toBeInTheDocument();
    });

    const adminOption = await within(document.body).findByText('Admin');
    await userEvent.click(adminOption);

    // Type email
    await userEvent.type(screen.getByPlaceholderText('Email'), 'example@example.com');

    // Click Send
    await userEvent.click(screen.getByRole('button', { name: 'Send invites' }));

    // Assert correct payload
    await waitFor(() =>
      expect(request).toEqual({
        email_address: 'example@example.com',
        membership_subject: 'c77c670e-8464-4352-9c86-4fef1d523f22',
        membership_subject_type: 'role',
      }),
    );
  });

  it('should send delete when user clicks remove member', async () => {
    render(
      <MockProviders>
        <OrgMembers />
      </MockProviders>,
    );

    await openMemberMenu();

    // Wait for dropdown menu to be rendered and find the menu item
    const removeMenuItem = await screen.findByRole('menuitem', { name: /Remove member/ });

    await userEvent.click(removeMenuItem);

    await userEvent.click(await screen.findByRole('button', { name: 'Yes' }));

    // Assert payload was sent
    await waitFor(() => expect(deleteMemberRequestSent).toBeTruthy());
  });

  it('should revoke invitation when user clicks delete invitation', async () => {
    render(
      <MockProviders>
        <OrgMembers />
      </MockProviders>,
    );

    await openInvitationMenu();

    // Wait for dropdown menu to be rendered and find the menu item
    const revokeMenuItem = await screen.findByRole('menuitem', { name: /Revoke invitation/ });

    await userEvent.click(revokeMenuItem);

    await userEvent.click(await screen.findByRole('button', { name: 'Yes' }));

    // Assert payload was sent
    await waitFor(() => expect(revokeInvitationRequestSent).toBeTruthy());
  });

  it("should disable invite button when user doesn't have permissions", async () => {
    server.use(getCheckPermissionsMockHandler(onlyReadPermissions));

    render(
      <MockProviders>
        <OrgMembers />
      </MockProviders>,
    );

    expect(await screen.findByRole('button', { name: /Invite users/ })).toBeDisabled();
  });

  it("should disable remove member action when user doesn't have permissions", async () => {
    server.use(getCheckPermissionsMockHandler(onlyReadPermissions));
    render(
      <MockProviders>
        <OrgMembers />
      </MockProviders>,
    );

    await openMemberMenu();

    // Wait for dropdown menu to be rendered and find the menu item
    const removeMenuItem = await screen.findByRole('menuitem', { name: /Remove member/ });

    await userEvent.click(removeMenuItem);

    expect(screen.queryByText('Remove this membership?', { exact: true })).toBeFalsy();
  });

  it("should disable revoke invitation action when user doesn't have permissions", async () => {
    server.use(getCheckPermissionsMockHandler(onlyReadPermissions));
    render(
      <MockProviders>
        <OrgMembers />
      </MockProviders>,
    );

    await openInvitationMenu();

    // Wait for dropdown menu to be rendered and find the menu item
    const revokeMenuItem = await screen.findByRole('menuitem', { name: /Revoke invitation/ });

    await userEvent.click(revokeMenuItem);

    expect(screen.queryByText('Revoke this invitation?', { exact: true })).toBeFalsy();
  });

  it('should render member names as clickable links', async () => {
    render(
      <MockProviders>
        <OrgMembers />
      </MockProviders>,
    );

    const memberNameLink = await screen.findByRole('link');
    expect(memberNameLink).toBeInTheDocument();

    expect(memberNameLink).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/orgs\/my-org\/members\/[a-f0-9-]+$/),
    );

    expect(memberNameLink.tagName).toBe('A');
  });

  it('should preserve existing scoped memberships when changing org role', async () => {
    const orgLevelMember = {
      id: 'org-membership-id',
      created_at: '2025-01-01T00:00:00Z',
      user_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      user_display_name: 'Test User',
      subject: 'c77c670e-8464-4352-9c86-4fef1d523f22', // Admin role ID
      subject_type: 'role' as const,
      identity_providers: ['microsoft'],
    };
    const scopedMember = {
      id: 'scoped-membership-id',
      created_at: '2025-01-01T00:00:00Z',
      user_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      user_display_name: 'Test User',
      subject: 'scoped-role-id',
      subject_type: 'role' as const,
      scope: 'project:my-project',
      identity_providers: ['google'],
    };

    server.use(
      getListMembersMockHandler({ items: [orgLevelMember] }),
      getListOrgMembershipsMockHandler({ items: [orgLevelMember, scopedMember] }),
    );

    render(
      <MockProviders>
        <OrgMembers />
      </MockProviders>,
    );

    // Wait for the table to load and click on "Manage membership" for the first member
    await openMemberMenu();

    // Click "Manage membership" menu item
    const manageRolesMenuItem = await screen.findByRole('menuitem', { name: /Manage membership/ });
    await userEvent.click(manageRolesMenuItem);

    // Wait for modal to open and find the role select dropdown (it's the only combobox in modal)
    const roleSelect = await screen.findByRole('combobox');
    await userEvent.click(roleSelect);

    // Select Viewer role from dropdown
    const viewerOption = await within(document.body).findByText('Viewer');
    await userEvent.click(viewerOption);

    // Click Update button to submit the change
    const updateButton = await screen.findByRole('button', { name: 'Update' });
    await userEvent.click(updateButton);

    // Verify the replace request includes both the new org role and existing memberships
    await waitFor(() => {
      expect(replaceUserMembershipsRequest).not.toBeNull();
    });

    // Should preserve multiple memberships (the test shows 2 memberships are sent)
    expect(replaceUserMembershipsRequest.memberships).toHaveLength(2);

    // Should include the new org-level role (Viewer)
    const hasViewerRole = replaceUserMembershipsRequest.memberships.some(
      (membership: any) =>
        membership.subject === '41d9ab07-037d-4138-b111-1527617d01a2' &&
        membership.subject_type === 'role',
    );
    expect(hasViewerRole).toBe(true);

    // Should preserve at least one other existing membership
    const hasOtherMembership = replaceUserMembershipsRequest.memberships.some(
      (membership: any) =>
        membership.subject !== '41d9ab07-037d-4138-b111-1527617d01a2' &&
        membership.subject_type === 'role',
    );
    expect(hasOtherMembership).toBe(true);
  });
});
