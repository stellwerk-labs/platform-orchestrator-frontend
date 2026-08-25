import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getListEnvironmentsInOrgMockHandler } from '@src/hooks/react-query/v2/controlplane/environment/environment.msw';
import { getListProjectsMockHandler } from '@src/hooks/react-query/v2/controlplane/project/project.msw';
import { getListRolesMockHandler } from '@src/hooks/react-query/v2/iam/role/role.msw';
import { getListServiceUsersMockHandler } from '@src/hooks/react-query/v2/iam/service-user/service-user.msw';
import { getCheckPermissionsMockHandler } from '@src/hooks/react-query/v2/iam/user/user.msw';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

import { ServiceUserDetails } from './ServiceUserDetails';

// Mock react-router useParams and useNavigate
const mockParams = {
  orgId: 'test-org',
  serviceUserId: 'test-service-user-123',
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

const testServiceUserWithOrgRole = {
  id: 'test-service-user-123',
  generated_at: '2024-01-01T10:00:00Z',
  generated_by: 'admin-123',
  display_name: 'Test Service User',
  current_token_expires_at: '2025-01-01T10:00:00Z',
  roles: [
    {
      id: 'role-123',
      scope: undefined,
    },
  ],
};

const testServiceUserWithScopedRole = {
  id: 'test-service-user-123',
  generated_at: '2024-01-01T10:00:00Z',
  generated_by: 'admin-123',
  display_name: 'Test Service User',
  current_token_expires_at: '2025-01-01T10:00:00Z',
  roles: [
    {
      id: 'role-123',
      scope: undefined,
    },
    {
      id: 'scoped-role-123',
      scope: `project:${testProject.uuid}`,
    },
  ],
};

const testRoleDeveloper = {
  id: 'role-123',
  created_at: '2024-01-01T10:00:00Z',
  created_by: 'admin',
  display_name: 'Developer',
  is_system: false,
  permissions: ['read', 'write'],
};

const testRoleDeployer = {
  id: 'scoped-role-123',
  created_at: '2024-01-01T10:00:00Z',
  created_by: 'admin',
  display_name: 'Deployer',
  is_system: false,
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

const testServiceUserWithEnvScopedRole = {
  id: 'test-service-user-123',
  generated_at: '2024-01-01T10:00:00Z',
  generated_by: 'admin-123',
  display_name: 'Test Service User',
  current_token_expires_at: '2025-01-01T10:00:00Z',
  roles: [
    {
      id: 'role-123',
      scope: undefined,
    },
    {
      id: 'scoped-role-123',
      scope: `project:${testProject.uuid}`,
    },
    {
      id: 'env-scoped-role-123',
      scope: `env:${testDevEnv.uuid}`,
    },
  ],
};

const testRoleViewer = {
  id: 'env-scoped-role-123',
  created_at: '2024-01-01T10:30:00Z',
  created_by: 'admin',
  display_name: 'Viewer',
  is_system: false,
  permissions: ['env:read', 'env:manage'],
};

describe('ServiceUserDetails', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    server.use(
      getListServiceUsersMockHandler({
        items: [testServiceUserWithOrgRole],
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
      getCheckPermissionsMockHandler({
        items: [
          {
            allowed: true,
            permission_check: {
              permission: 'service_user_write',
              resource: 'organization:test-org',
            },
          },
        ],
      }),
    );
  });

  it('should display service user details correctly', async () => {
    render(
      <MockProviders>
        <ServiceUserDetails />
      </MockProviders>,
    );

    expect(await screen.findAllByText('Test Service User')).toHaveLength(2);
    expect(screen.getByText('Display Name')).toBeInTheDocument();

    expect(await screen.findByText('Developer')).toBeInTheDocument();
    expect(screen.getByText('Organization Roles')).toBeInTheDocument();

    expect(screen.getByText('Generated At')).toBeInTheDocument();
    expect(screen.getByText('Token Expires At')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Test Service User' })).toBeInTheDocument();
  });

  it('should show loading spinner while data is loading', async () => {
    render(
      <MockProviders>
        <ServiceUserDetails />
      </MockProviders>,
    );

    // Check loading spinner is present initially
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  it('should render empty scoped roles table', async () => {
    render(
      <MockProviders>
        <ServiceUserDetails />
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

  it('should render scoped roles table with project role', async () => {
    server.use(
      getListServiceUsersMockHandler({
        items: [testServiceUserWithScopedRole],
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
        <ServiceUserDetails />
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

  it('should handle multiple scoped roles without errors', async () => {
    const secondScopedRole = {
      id: 'test-service-user-123',
      generated_at: '2024-01-01T10:00:00Z',
      generated_by: 'admin-123',
      display_name: 'Test Service User',
      current_token_expires_at: '2025-01-01T10:00:00Z',
      roles: [
        {
          id: 'role-123',
          scope: undefined,
        },
        {
          id: 'scoped-role-123',
          scope: `project:${testProject.uuid}`,
        },
        {
          id: 'scoped-role-123',
          scope: `project:${secondProject.uuid}`,
        },
      ],
    };

    server.use(
      getListServiceUsersMockHandler({
        items: [secondScopedRole],
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
        <ServiceUserDetails />
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

  it('should render scoped roles table with mixed scoped roles without errors', async () => {
    server.use(
      getListServiceUsersMockHandler({
        items: [testServiceUserWithEnvScopedRole],
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
        <ServiceUserDetails />
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

  it('should redirect to service users page when service user is not found', async () => {
    server.use(
      getListServiceUsersMockHandler({
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
        <ServiceUserDetails />
      </MockProviders>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/orgs/test-org/service-users', { replace: true });
    });
  });
});
