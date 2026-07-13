import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  getListEnvironmentsMockHandler,
  getListEnvironmentsResponseMock,
} from '@src/hooks/react-query/v2/controlplane/environment/environment.msw';
import {
  getListProjectsMockHandler,
  getListProjectsResponseMock,
} from '@src/hooks/react-query/v2/controlplane/project/project.msw';
import {
  getListRolesMockHandler,
  getListRolesResponseMock,
} from '@src/hooks/react-query/v2/iam/role/role.msw';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

import { AssignRolesModal } from './AssignRolesModal';

describe('AssignRolesModal', () => {
  const mockProps = {
    orgId: 'test-org',
    open: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
  };

  it('should load environments when a project is selected', async () => {
    const testProjectId = 'test-project-id';
    const testProjectUuid = 'test-project-uuid';

    // Mock project with specific data
    server.use(
      getListProjectsMockHandler(
        getListProjectsResponseMock({
          items: [
            {
              id: testProjectId,
              uuid: testProjectUuid,
              display_name: 'Test Project',
              created_at: '2023-01-01T00:00:00Z',
              updated_at: '2023-01-01T00:00:00Z',
              status: 'active',
            },
          ],
        }),
      ),
    );

    server.use(
      getListRolesMockHandler(
        getListRolesResponseMock({
          items: [
            {
              id: 'role1',
              display_name: 'Test Role',
              created_at: '2023-01-01T00:00:00Z',
              created_by: 'user1',
              permissions: ['read'],
            },
          ],
        }),
      ),
    );

    // Mock environments with exactly 3 environments for the project
    const mockEnvironmentsHandler = getListEnvironmentsMockHandler(() => {
      return getListEnvironmentsResponseMock({
        items: [
          {
            id: 'env1',
            uuid: 'env1-uuid',
            project_id: testProjectId,
            env_type_id: 'dev',
            display_name: 'Development',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            status: 'active',
          },
          {
            id: 'env2',
            uuid: 'env2-uuid',
            project_id: testProjectId,
            env_type_id: 'staging',
            display_name: 'Staging',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            status: 'active',
          },
          {
            id: 'env3',
            uuid: 'env3-uuid',
            project_id: testProjectId,
            env_type_id: 'prod',
            display_name: 'Production',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            status: 'active',
          },
        ],
      });
    });

    server.use(mockEnvironmentsHandler);

    render(
      <MockProviders>
        <AssignRolesModal {...mockProps} />
      </MockProviders>,
    );

    // Wait for the modal to be rendered and projects to load
    await waitFor(() => {
      expect(screen.getByText('Assign new scoped role')).toBeVisible();
    });

    // There should be one project select by default (no need to add)
    // Use the specific ID that we can see in the error message
    const projectSelect = screen.getByRole('combobox', { name: 'Select a project' });
    await userEvent.click(projectSelect);

    // Wait for project options to appear and select the test project
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeVisible();
    });
    await userEvent.click(screen.getByText('Test Project'));

    // Wait for environments to load and verify the environment dropdown is populated
    const environmentSelect = await screen.findByRole('combobox', {
      name: 'Select an environment',
    });
    expect(environmentSelect).toBeInTheDocument();

    // Click on the environment dropdown to see the options
    await userEvent.click(environmentSelect);

    // Verify that all 3 environments plus "all environments" option are present
    await waitFor(() => {
      // Check for all the environment options by their specific text content
      const environmentOptions = screen.getAllByText('All environments');
      expect(environmentOptions.length).toBeGreaterThan(0); // At least one "all environments" option
      expect(screen.getByText('Development')).toBeVisible();
      expect(screen.getByText('Staging')).toBeVisible();
      expect(screen.getByText('Production')).toBeVisible();
    });
  });

  it('should call the environments API with correct parameters when project is selected', async () => {
    const testProjectId = 'test-project-id';
    const testProjectUuid = 'test-project-uuid';

    // Mock project
    server.use(
      getListProjectsMockHandler(
        getListProjectsResponseMock({
          items: [
            {
              id: testProjectId,
              uuid: testProjectUuid,
              display_name: 'Test Project',
              created_at: '2023-01-01T00:00:00Z',
              updated_at: '2023-01-01T00:00:00Z',
              status: 'active',
            },
          ],
        }),
      ),
    );

    server.use(
      getListRolesMockHandler(
        getListRolesResponseMock({
          items: [
            {
              id: 'role1',
              display_name: 'Test Role',
              created_at: '2023-01-01T00:00:00Z',
              created_by: 'user1',
              permissions: ['read'],
            },
          ],
        }),
      ),
    );

    // Mock environments and capture params for verification outside the handler
    const capturedParams: { orgId?: string; projectId?: string } = {};
    const mockEnvironmentsHandler = getListEnvironmentsMockHandler((info) => {
      const { params } = info;
      capturedParams.orgId = params.orgId as string;
      capturedParams.projectId = params.projectId as string;

      return getListEnvironmentsResponseMock({
        items: [
          {
            id: 'env1',
            uuid: 'env1-uuid',
            project_id: testProjectId,
            env_type_id: 'dev',
            display_name: 'Development',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            status: 'active',
          },
        ],
      });
    });

    server.use(mockEnvironmentsHandler);

    render(
      <MockProviders>
        <AssignRolesModal {...mockProps} />
      </MockProviders>,
    );

    // Wait for modal to load
    await waitFor(() => {
      expect(screen.getByText('Assign new scoped role')).toBeVisible();
    });

    // Select the project to trigger environments API call (there's one by default)
    const projectSelect = screen.getByRole('combobox', { name: 'Select a project' });
    await userEvent.click(projectSelect);

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeVisible();
    });
    await userEvent.click(screen.getByText('Test Project'));

    // Verify environments API was called with correct parameters
    await waitFor(() => {
      expect(capturedParams.orgId).toBe('test-org');
      expect(capturedParams.projectId).toBe(testProjectId);
    });
  });
});
