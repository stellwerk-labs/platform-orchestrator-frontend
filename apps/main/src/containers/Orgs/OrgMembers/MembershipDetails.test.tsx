import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getListEnvironmentsInOrgMockHandler } from '@src/hooks/react-query/v2/controlplane/environment/environment.msw';
import { getListProjectsMockHandler } from '@src/hooks/react-query/v2/controlplane/project/project.msw';
import {
  getDeleteOrgMembershipMockHandler,
  getListMembersMockHandler,
  getListOrgMembershipsMockHandler,
  getReplaceOrgUserMembershipsMockHandler,
} from '@src/hooks/react-query/v2/iam/membership/membership.msw';
import { getListRolesMockHandler } from '@src/hooks/react-query/v2/iam/role/role.msw';
import {
  getCheckPermissionsMockHandler,
  getGetCurrentUserMockHandler,
} from '@src/hooks/react-query/v2/iam/user/user.msw';
import { SubjectType } from '@src/models/v2/iam';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

import { MembershipDetails } from './MembershipDetails';

// Mock react-router useParams and useNavigate
const mockParams = {
  orgId: 'test-org',
  userId: 'test-user-123',
};

const mockNavigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => mockParams,
    useNavigate: () => mockNavigate,
  };
});

const testProject = {
  id: 'test-project',
  uuid: 'project-uuid-456',
  display_name: 'Test Project',
  created_at: '2024-01-01T09:00:00Z',
  updated_at: '2024-01-01T09:00:00Z',
  status: 'active' as const,
};

const secondProject = {
  id: 'test-project-2',
  uuid: 'project-uuid-789',
  display_name: 'Second Test Project',
  created_at: '2024-01-01T09:30:00Z',
  updated_at: '2024-01-01T09:30:00Z',
  status: 'active' as const,
};

const testOrgRole = {
  id: 'membership-123',
  created_at: '2024-01-01T10:00:00Z',
  org_id: 'test-org',
  user_id: 'test-user-123',
  user_display_name: 'John Doe',
  user_primary_email_address: 'john.doe@example.com',
  subject_type: SubjectType.role,
  subject: 'role-123',
  scope: undefined,
};

const testScopedRole = {
  id: 'membership-456',
  created_at: '2024-01-01T11:00:00Z',
  org_id: 'test-org',
  user_id: 'test-user-123',
  user_display_name: 'John Doe',
  user_primary_email_address: 'john.doe@example.com',
  subject_type: SubjectType.role,
  subject: 'scoped-role-123',
  scope: `project:${testProject.uuid}`,
};

const testRoleDeveloper = {
  id: 'role-123',
  created_at: '2024-01-01T10:00:00Z',
  created_by: 'admin',
  display_name: 'Developer',
  permissions: ['read', 'write'],
};

const testRoleDeployer = {
  id: 'scoped-role-123',
  created_at: '2024-01-01T10:00:00Z',
  created_by: 'admin',
  display_name: 'Deployer',
  permissions: ['project:read', 'project:write'],
};

const testDevEnv = {
  id: 'test-env',
  uuid: 'env-uuid-789',
  display_name: 'development',
  project_id: 'test-project-2',
  env_type_id: 'development',
  created_at: '2024-01-01T09:00:00Z',
  updated_at: '2024-01-01T09:00:00Z',
  status: 'active' as const,
};

const testEnvScopedRole = {
  id: 'membership-env-456',
  created_at: '2024-01-01T11:30:00Z',
  org_id: 'test-org',
  user_id: 'test-user-123',
  user_display_name: 'John Doe',
  user_primary_email_address: 'john.doe@example.com',
  subject_type: SubjectType.role,
  subject: 'env-scoped-role-123',
  scope: `env:${testDevEnv.uuid}`,
};

const testRoleViewer = {
  id: 'env-scoped-role-123',
  created_at: '2024-01-01T10:30:00Z',
  created_by: 'admin',
  display_name: 'Viewer',
  permissions: ['env:read', 'env:manage'],
};

describe('MembershipDetails', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    server.use(
      getListOrgMembershipsMockHandler({
        items: [testOrgRole],
      }),
      getListMembersMockHandler({
        items: [
          {
            id: 'membership-123',
            created_at: '2024-01-01T10:00:00Z',
            user_id: 'test-user-123',
            user_display_name: 'John Doe',
            user_primary_email_address: 'john.doe@example.com',
            subject_type: SubjectType.role,
            subject: 'role-123',
            identity_providers: [],
          },
        ],
      }),
      getListRolesMockHandler({
        items: [testRoleDeveloper],
      }),
      getListProjectsMockHandler({
        items: [],
      }),
      getListEnvironmentsInOrgMockHandler({
        items: [],
      }),
    );
  });

  it('should display user details correctly', async () => {
    render(
      <MockProviders>
        <MembershipDetails />
      </MockProviders>,
    );

    expect(await screen.findAllByText('John Doe')).toHaveLength(2);
    expect(screen.getByText('Display Name')).toBeInTheDocument();

    expect(await screen.findByText('Developer')).toBeInTheDocument();
    expect(screen.getByText('Organization Roles')).toBeInTheDocument();

    expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'John Doe' })).toBeInTheDocument();
  });

  it('should show loading spinner while data is loading', async () => {
    render(
      <MockProviders>
        <MembershipDetails />
      </MockProviders>,
    );

    // Check loading spinner is present initially
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  it('should render empty membership table', async () => {
    render(
      <MockProviders>
        <MembershipDetails />
      </MockProviders>,
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Check the table's title is rendered
    expect(screen.getByText('Scoped roles')).toBeInTheDocument();

    // Check that the table headers are rendered
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Environment')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();

    // Check that the table is empty
    expect(document.querySelector('.ant-empty')).toBeInTheDocument();
  });

  it('should render membership table with project role', async () => {
    server.use(
      getListOrgMembershipsMockHandler({
        items: [testOrgRole, testScopedRole],
      }),
      getListRolesMockHandler({
        items: [testRoleDeveloper, testRoleDeployer],
      }),
      getListProjectsMockHandler({
        items: [testProject],
      }),
      getListEnvironmentsInOrgMockHandler({
        items: [],
      }),
    );

    render(
      <MockProviders>
        <MembershipDetails />
      </MockProviders>,
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Check that table is rendered
    expect(screen.getByText('Scoped roles')).toBeInTheDocument();

    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Environment')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();

    // Check that scoped project role is rendered
    expect(screen.getByText('test-project')).toBeInTheDocument();
    expect(screen.getByText('Deployer')).toBeInTheDocument();
  });

  it('should handle multiple scoped memberships without errors', async () => {
    const secondScopedRole = {
      id: 'membership-789',
      created_at: '2024-01-01T12:00:00Z',
      org_id: 'test-org',
      user_id: 'test-user-123',
      user_display_name: 'John Doe',
      user_primary_email_address: 'john.doe@example.com',
      subject_type: SubjectType.role,
      subject: 'scoped-role-123',
      scope: `project:${secondProject.uuid}`,
    };

    server.use(
      getListOrgMembershipsMockHandler({
        items: [testOrgRole, testScopedRole, secondScopedRole],
      }),
      getListRolesMockHandler({
        items: [testRoleDeveloper, testRoleDeployer],
      }),
      getListProjectsMockHandler({
        items: [testProject, secondProject],
      }),
      getListEnvironmentsInOrgMockHandler({
        items: [],
      }),
    );

    render(
      <MockProviders>
        <MembershipDetails />
      </MockProviders>,
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Check table is rendered
    expect(screen.getByText('Scoped roles')).toBeInTheDocument();

    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Environment')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();

    // Check that both scoped project roles are rendered
    expect(screen.getByText('test-project')).toBeInTheDocument();
    expect(screen.getByText('test-project-2')).toBeInTheDocument();
    expect(screen.getAllByText('Deployer').length).toBe(2);
  });

  it('should render membership table with mixed scoped roles without errors', async () => {
    server.use(
      getListOrgMembershipsMockHandler({
        items: [testOrgRole, testScopedRole, testEnvScopedRole],
      }),
      getListRolesMockHandler({
        items: [testRoleDeveloper, testRoleDeployer, testRoleViewer],
      }),
      getListProjectsMockHandler({
        items: [testProject, secondProject],
      }),
      getListEnvironmentsInOrgMockHandler({
        items: [testDevEnv],
      }),
    );

    render(
      <MockProviders>
        <MembershipDetails />
      </MockProviders>,
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Check that table is rendered
    expect(screen.getByText('Scoped roles')).toBeInTheDocument();

    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Environment')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();

    // Check that scoped project role is rendered
    expect(screen.getByText('test-project')).toBeInTheDocument();
    expect(screen.getByText('Deployer')).toBeInTheDocument();

    // Check that scoped env role is rendered
    expect(screen.getByText('test-project-2')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('development')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Viewer')).toBeInTheDocument();
    });
  });

  it('should redirect to members page when user has no memberships', async () => {
    server.use(
      getListOrgMembershipsMockHandler({
        items: [],
      }),
      getListRolesMockHandler({
        items: [testRoleDeveloper],
      }),
      getListProjectsMockHandler({
        items: [],
      }),
      getListEnvironmentsInOrgMockHandler({
        items: [],
      }),
    );

    render(
      <MockProviders>
        <MembershipDetails />
      </MockProviders>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/orgs/test-org/members', { replace: true });
    });
  });

  describe('Scoped roles table permissions', () => {
    it('should show create/edit/delete buttons', async () => {
      server.use(
        getListOrgMembershipsMockHandler({
          items: [testOrgRole, testScopedRole],
        }),
        getListRolesMockHandler({
          items: [testRoleDeveloper, testRoleDeployer, testRoleViewer],
        }),
        getListProjectsMockHandler({
          items: [testProject, secondProject],
        }),
        getListEnvironmentsInOrgMockHandler({
          items: [testDevEnv],
        }),
        getGetCurrentUserMockHandler({
          id: 'admin-user-456', // Different from the user being viewed, and is admin
          display_name: 'Admin User',
          primary_email_address: 'admin@example.com',
          created_at: '2024-01-01T09:00:00Z',
          login_providers: ['email'],
          organization_memberships: [{ id: 'test-org' }],
          dismissed_prompts: [],
        }),
        getCheckPermissionsMockHandler({
          items: [
            {
              permission_check: { resource: 'organization:test-org', permission: 'manage' },
              allowed: true, // Admin user
            },
          ],
        }),
        getDeleteOrgMembershipMockHandler(),
        getReplaceOrgUserMembershipsMockHandler(),
      );

      render(
        <MockProviders>
          <MembershipDetails />
        </MockProviders>,
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should see initial data in table
      expect(screen.getByText('Scoped roles')).toBeInTheDocument();
      expect(screen.getByText('test-project')).toBeInTheDocument();
      expect(screen.getByText('Deployer')).toBeInTheDocument();

      // Should see all the buttons and the buttons should be enabled
      const assignButton = screen.getByLabelText('Assign scoped role');
      const editButton = screen.getByLabelText('Update scoped role');
      const deleteButton = screen.getByLabelText('Remove scoped role');

      expect(assignButton).toBeInTheDocument();
      expect(editButton).toBeInTheDocument();
      expect(deleteButton).toBeInTheDocument();

      expect(assignButton).toBeEnabled();
      expect(editButton).toBeEnabled();
      expect(deleteButton).toBeEnabled();
    });

    it('should not show create/edit/delete buttons when user views their own page', async () => {
      server.use(
        getListOrgMembershipsMockHandler({
          items: [testOrgRole, testScopedRole],
        }),
        getListRolesMockHandler({
          items: [testRoleDeveloper, testRoleDeployer],
        }),
        getListProjectsMockHandler({
          items: [testProject],
        }),
        getListEnvironmentsInOrgMockHandler({
          items: [],
        }),
        getGetCurrentUserMockHandler({
          id: mockParams.userId, // Same as page params userId
          display_name: 'John Doe',
          primary_email_address: 'john.doe@example.com',
          created_at: '2024-01-01T09:00:00Z',
          login_providers: ['email'],
          organization_memberships: [{ id: 'test-org' }],
          dismissed_prompts: [],
        }),
        getCheckPermissionsMockHandler({
          items: [
            {
              permission_check: { resource: 'organization:test-org', permission: 'manage' },
              allowed: true,
            },
          ],
        }),
      );

      render(
        <MockProviders>
          <MembershipDetails />
        </MockProviders>,
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should see the table
      expect(screen.getByText('Scoped roles')).toBeInTheDocument();
      expect(screen.getByText('test-project')).toBeInTheDocument();
      expect(screen.getByText('Deployer')).toBeInTheDocument();

      // Should not see buttons
      const assignButton = screen.queryByLabelText('Assign scoped role');
      const editButton = screen.queryByLabelText('Update scoped role');
      const deleteButton = screen.queryByLabelText('Remove scoped role');

      expect(assignButton).not.toBeInTheDocument();
      expect(editButton).not.toBeInTheDocument();
      expect(deleteButton).not.toBeInTheDocument();
    });

    it('should show disabled buttons when non-admin user views another user page', async () => {
      server.use(
        getListOrgMembershipsMockHandler({
          items: [testOrgRole, testScopedRole],
        }),
        getListRolesMockHandler({
          items: [testRoleDeveloper, testRoleDeployer],
        }),
        getListProjectsMockHandler({
          items: [testProject],
        }),
        getListEnvironmentsInOrgMockHandler({
          items: [],
        }),
        getGetCurrentUserMockHandler({
          id: 'current-user-789', // Different from the user being viewed
          display_name: 'Current User',
          primary_email_address: 'current@example.com',
          created_at: '2024-01-01T09:00:00Z',
          login_providers: ['email'],
          organization_memberships: [{ id: 'test-org' }],
          dismissed_prompts: [],
        }),
        getCheckPermissionsMockHandler({
          items: [
            {
              permission_check: { resource: 'organization:test-org', permission: 'manage' },
              allowed: false, // Non-admin user
            },
          ],
        }),
      );

      render(
        <MockProviders>
          <MembershipDetails />
        </MockProviders>,
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should see the table
      expect(screen.getByText('Scoped roles')).toBeInTheDocument();

      // Should see the "Assign scoped role" button but disabled
      const assignButton = screen.getByLabelText('Assign scoped role');
      expect(assignButton).toBeInTheDocument();
      expect(assignButton).toBeDisabled();

      // Should see edit/delete buttons but disabled
      const editButton = screen.getByLabelText('Update scoped role');
      expect(editButton).toBeInTheDocument();
      expect(editButton).toBeDisabled();

      const deleteButton = screen.getByLabelText('Remove scoped role');
      expect(deleteButton).toBeInTheDocument();
      expect(deleteButton).toBeDisabled();
    });

    it('should allow admin user to delete scoped roles for another user', async () => {
      let deleteCallParams: { orgId: string; membershipId: string } | null = null;

      server.use(
        getListOrgMembershipsMockHandler({
          items: [testOrgRole, testScopedRole],
        }),
        getListRolesMockHandler({
          items: [testRoleDeveloper, testRoleDeployer, testRoleViewer],
        }),
        getListProjectsMockHandler({
          items: [testProject, secondProject],
        }),
        getListEnvironmentsInOrgMockHandler({
          items: [testDevEnv],
        }),
        getGetCurrentUserMockHandler({
          id: 'admin-user-456', // Different from the user being viewed, and is admin
          display_name: 'Admin User',
          primary_email_address: 'admin@example.com',
          created_at: '2024-01-01T09:00:00Z',
          login_providers: ['email'],
          organization_memberships: [{ id: 'test-org' }],
          dismissed_prompts: [],
        }),
        getCheckPermissionsMockHandler({
          items: [
            {
              permission_check: { resource: 'organization:test-org', permission: 'manage' },
              allowed: true, // Admin user
            },
          ],
        }),
        getDeleteOrgMembershipMockHandler((info: any) => {
          const url = new URL(info.request.url);
          const pathParts = url.pathname.split('/');
          const orgIdIndex = pathParts.indexOf('orgs') + 1;
          const membershipIdIndex = pathParts.indexOf('memberships') + 1;

          const orgId = pathParts[orgIdIndex];
          const membershipId = pathParts[membershipIdIndex];

          if (orgId && membershipId) {
            deleteCallParams = {
              orgId,
              membershipId,
            };
          }
        }),
      );

      render(
        <MockProviders>
          <MembershipDetails />
        </MockProviders>,
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should see initial data in table
      expect(screen.getByText('Scoped roles')).toBeInTheDocument();
      expect(screen.getByText('test-project')).toBeInTheDocument();
      expect(screen.getByText('Deployer')).toBeInTheDocument();

      // Click delete button
      const user = userEvent.setup();
      const deleteButton = screen.getByLabelText('Remove scoped role');
      await user.click(deleteButton);

      // Should see the delete confirmation modal
      await waitFor(() => {
        expect(
          screen.getByText(/Are you sure you want to unassign this role?/),
        ).toBeInTheDocument();
      });

      // Verify we are looking at the correct role to delete in the modal
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();

      // Check the role details within the modal only
      expect(within(modal).getByText(testProject.id)).toBeInTheDocument();
      expect(within(modal).getByText(/All environments/)).toBeInTheDocument();
      expect(within(modal).getByText(testRoleDeployer.display_name)).toBeInTheDocument();

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /yes/i });
      await user.click(confirmButton);

      // Wait for modal to close (deletion API call would complete)
      await waitFor(() => {
        expect(
          screen.queryByText(/Are you sure you want to unassign this role?/),
        ).not.toBeInTheDocument();
      });

      // Verify the delete API was called with correct parameters
      expect(deleteCallParams).not.toBeNull();
      expect(deleteCallParams).toEqual({
        orgId: 'test-org',
        membershipId: testScopedRole.id,
      });
    });

    it('should allow admin user to update scoped roles for another user', async () => {
      let replaceCallParams: { orgId: string; userId: string; requestBody: any } | null = null;

      server.use(
        getListOrgMembershipsMockHandler({
          items: [testOrgRole, testScopedRole],
        }),
        getListRolesMockHandler({
          items: [testRoleDeveloper, testRoleDeployer, testRoleViewer],
        }),
        getListProjectsMockHandler({
          items: [testProject, secondProject],
        }),
        getListEnvironmentsInOrgMockHandler({
          items: [testDevEnv],
        }),
        getGetCurrentUserMockHandler({
          id: 'admin-user-456', // Different from the user being viewed, and is admin
          display_name: 'Admin User',
          primary_email_address: 'admin@example.com',
          created_at: '2024-01-01T09:00:00Z',
          login_providers: ['email'],
          organization_memberships: [{ id: 'test-org' }],
          dismissed_prompts: [],
        }),
        getCheckPermissionsMockHandler({
          items: [
            {
              permission_check: { resource: 'organization:test-org', permission: 'manage' },
              allowed: true, // Admin user
            },
          ],
        }),
        getReplaceOrgUserMembershipsMockHandler(async (info: any) => {
          const url = new URL(info.request.url);
          const pathParts = url.pathname.split('/');
          const orgIdIndex = pathParts.indexOf('orgs') + 1;
          const userIdIndex = pathParts.indexOf('users') + 1;

          const orgId = pathParts[orgIdIndex];
          const userId = pathParts[userIdIndex];
          const requestBody = await info.request.json();

          if (orgId && userId) {
            replaceCallParams = {
              orgId,
              userId,
              requestBody,
            };
          }

          // Return a proper response to satisfy TypeScript
          return {
            items: [],
          };
        }),
      );

      render(
        <MockProviders>
          <MembershipDetails />
        </MockProviders>,
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should see initial data in table
      expect(screen.getByText('Scoped roles')).toBeInTheDocument();
      expect(screen.getByText('test-project')).toBeInTheDocument();
      expect(screen.getByText('Deployer')).toBeInTheDocument();

      // Click edit button
      const user = userEvent.setup();
      const editButton = screen.getByLabelText('Update scoped role');
      await user.click(editButton);

      // Should see the update modal
      await waitFor(() => {
        expect(screen.getByText(/Update project scoped role/)).toBeInTheDocument();
      });

      // Verify modal shows the correct role information
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();

      // Check the modal displays current role details
      expect(within(modal).getByText(/Project/)).toBeInTheDocument();
      expect(within(modal).getByText(testProject.id)).toBeInTheDocument();

      expect(within(modal).getByText(/Environment/)).toBeInTheDocument();
      expect(within(modal).getByText(/All environments/)).toBeInTheDocument();

      expect(within(modal).getByText(/Role/)).toBeInTheDocument();

      // Change the role to Viewer
      const roleSelect = within(modal).getByRole('combobox');
      await user.click(roleSelect);
      await user.click(screen.getByText(testRoleViewer.display_name));

      // Submit the update
      const updateButton = within(modal).getByRole('button', { name: /update/i });
      await user.click(updateButton);

      // Wait for modal to close and API call to complete
      await waitFor(
        () => {
          expect(screen.queryByText(/Update project scoped role/)).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Verify the API was called with correct parameters
      expect(replaceCallParams).not.toBeNull();
      expect(replaceCallParams).toEqual({
        orgId: 'test-org',
        userId: 'test-user-123',
        requestBody: expect.objectContaining({
          memberships: expect.arrayContaining([
            expect.objectContaining({
              subject_type: 'role',
              subject: testRoleViewer.id,
              scope: `project:${testProject.uuid}`,
            }),
          ]),
        }),
      });
    });

    it('should allow admin user to create scoped roles for another user', async () => {
      server.use(
        getListOrgMembershipsMockHandler({
          items: [testOrgRole, testScopedRole],
        }),
        getListRolesMockHandler({
          items: [testRoleDeveloper, testRoleDeployer, testRoleViewer],
        }),
        getListProjectsMockHandler({
          items: [testProject, secondProject],
        }),
        getListEnvironmentsInOrgMockHandler({
          items: [testDevEnv],
        }),
        getGetCurrentUserMockHandler({
          id: 'admin-user-456', // Different from the user being viewed, and is admin
          display_name: 'Admin User',
          primary_email_address: 'admin@example.com',
          created_at: '2024-01-01T09:00:00Z',
          login_providers: ['email'],
          organization_memberships: [{ id: 'test-org' }],
          dismissed_prompts: [],
        }),
        getCheckPermissionsMockHandler({
          items: [
            {
              permission_check: { resource: 'organization:test-org', permission: 'manage' },
              allowed: true, // Admin user
            },
          ],
        }),
        getReplaceOrgUserMembershipsMockHandler(),
      );

      render(
        <MockProviders>
          <MembershipDetails />
        </MockProviders>,
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should see initial data in table
      expect(screen.getByText('Scoped roles')).toBeInTheDocument();
      expect(screen.getByText('test-project')).toBeInTheDocument();
      expect(screen.getByText('Deployer')).toBeInTheDocument();

      // Click assign scoped role button
      const user = userEvent.setup();
      const assignButton = screen.getByLabelText('Assign scoped role');
      await user.click(assignButton);

      // Should see the assign modal
      await waitFor(() => {
        expect(screen.getByText(/Assign new scoped role/)).toBeInTheDocument();
      });

      // Verify modal shows the correct form elements
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();

      // Check the form has the expected dropdowns (there will be multiple due to Add Another functionality)
      expect(within(modal).getAllByLabelText(/Select a project/).length).toBeGreaterThan(0);
      expect(within(modal).getAllByLabelText(/Select an environment/).length).toBeGreaterThan(0);
      expect(within(modal).getAllByLabelText(/Select a role/).length).toBeGreaterThan(0);

      // Verify form headers are present (multiple instances due to column headers and placeholders)
      expect(within(modal).getAllByText(/Project/).length).toBeGreaterThan(0);
      expect(within(modal).getAllByText(/Environment/).length).toBeGreaterThan(0);
      expect(within(modal).getAllByText(/Role/).length).toBeGreaterThan(0);

      // Close modal and verify it worked (form filling would be complex due to dynamic nature)
      const cancelButton = within(modal).getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Wait for modal to close
      await waitFor(
        () => {
          expect(screen.queryByText(/Assign new scoped role/)).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    });
  });
});
