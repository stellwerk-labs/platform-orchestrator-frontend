import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { getListDeploymentsMockHandler } from '@src/hooks/react-query/v2/dataplane/deployment/deployment.msw';
import { getListOrgMembershipsMockHandler } from '@src/hooks/react-query/v2/iam/membership/membership.msw';
import { getListServiceUsersMockHandler } from '@src/hooks/react-query/v2/iam/service-user/service-user.msw';
import {
  ByStatusQueryParamParameterItem,
  DeploymentPage,
  DeploymentSummary,
} from '@src/models/v2/dataplane';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

import { Deploys } from './Deploys';

// Helper to create a deployment with specific status
// Note: DP converts mode: rollback_plan -> mode: rollback, plan_only: true
const createDeployment = (
  id: string,
  status: ByStatusQueryParamParameterItem,
  mode: string = 'deploy',
  planOnly: boolean = false,
): DeploymentSummary => ({
  org_id: 'my-org',
  project_id: 'my-project',
  env_id: 'my-env',
  id,
  created_at: '2024-01-15T10:00:00Z',
  created_by: 'user-1',
  mode,
  plan_only: planOnly,
  status,
  status_message: `Deployment ${status}`,
  metrics: {
    num_workloads: 1,
    num_resource_nodes: 2,
  },
});

// 4 deployments with different states
const mockDeployments: DeploymentSummary[] = [
  createDeployment('deploy-1', ByStatusQueryParamParameterItem.succeeded),
  createDeployment('deploy-2', ByStatusQueryParamParameterItem.failed),
  createDeployment('deploy-3', ByStatusQueryParamParameterItem.executing),
  createDeployment('deploy-4', ByStatusQueryParamParameterItem.succeeded, 'rollback', true),
];

const renderDeploys = () => {
  return render(
    <MockProviders
      route={{
        path: '/orgs/:orgId/projects/:projectId/envs/:envId/deploys',
        url: '/orgs/my-org/projects/my-project/envs/my-env/deploys',
      }}>
      <Deploys />
    </MockProviders>,
  );
};

describe('Deploys', () => {
  beforeEach(() => {
    server.use(
      getListOrgMembershipsMockHandler({
        items: [
          {
            id: 'membership-1',
            created_at: '2024-01-01T00:00:00Z',
            user_id: 'user-1',
            user_display_name: 'Test User',
            subject_type: 'role',
            subject: 'role-1',
          },
        ],
      }),
      getListServiceUsersMockHandler({ items: [] }),
    );
  });

  it('should render empty table when no deployments', async () => {
    const emptyResponse: DeploymentPage = {
      items: [],
      next_page_token: undefined,
    };
    server.use(getListDeploymentsMockHandler(emptyResponse));

    renderDeploys();

    // Wait for table to render
    expect(await screen.findByRole('table')).toBeInTheDocument();

    // Check empty state message
    expect(screen.getByText('Nothing has been deployed to this environment.')).toBeInTheDocument();

    // Verify column headers are present
    expect(screen.getByRole('columnheader', { name: 'ID' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Status/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Mode/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Deployed At' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Created By' })).toBeInTheDocument();
  });

  it('should display 4 deployments with different states', async () => {
    const responseWithDeployments: DeploymentPage = {
      items: mockDeployments,
      next_page_token: undefined,
    };
    server.use(getListDeploymentsMockHandler(responseWithDeployments));

    renderDeploys();

    // Wait for table to render with data - find the first deployment link
    expect(await screen.findByRole('link', { name: 'deploy-1' })).toBeInTheDocument();

    // Verify all 4 deployment IDs are shown (header row + 4 data rows)
    expect(screen.getAllByRole('row')).toHaveLength(5);

    // Verify each deployment ID is displayed as a link
    expect(screen.getByRole('link', { name: 'deploy-2' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'deploy-3' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'deploy-4' })).toBeInTheDocument();

    // Verify different statuses are displayed (using display values from getDeploymentStatus)
    expect(screen.getAllByText('Successful')).toHaveLength(2);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    // 'executing' status has no display text in getDeploymentStatus, just shows the loading icon

    // Verify different modes are displayed
    expect(screen.getAllByText('deploy')).toHaveLength(3);
    expect(screen.getByText('rollback')).toBeInTheDocument();

    // Verify plan_only tag is shown for rollback plan deployment
    expect(screen.getByText('plan only')).toBeInTheDocument();
  });

  it('should filter deployments by status with multiselect and reset', async () => {
    // Track the filter parameters sent to the API
    let lastByStatus: string[] | undefined;

    server.use(
      getListDeploymentsMockHandler((info) => {
        const url = new URL(info.request.url);
        lastByStatus = url.searchParams.getAll('by_status');

        // Return filtered results based on the status filter
        let filteredItems = mockDeployments;
        if (lastByStatus && lastByStatus.length > 0) {
          filteredItems = mockDeployments.filter((d) => lastByStatus!.includes(d.status));
        }

        return {
          items: filteredItems,
          next_page_token: undefined,
        };
      }),
    );

    renderDeploys();

    // Wait for initial render with all deployments
    expect(await screen.findByRole('table')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(5);
    });

    // Open the Status column filter dropdown
    const statusColumnHeader = screen.getByRole('columnheader', { name: /Status/ });
    const filterTrigger = within(statusColumnHeader).getByRole('button');
    await userEvent.click(filterTrigger);

    // Wait for filter dropdown to appear (antd renders it in a portal)
    // Select "succeeded" checkbox by finding its label text
    const succeededOption = await screen.findByText('succeeded', {
      selector: '.ant-table-filter-dropdown span',
    });
    await userEvent.click(succeededOption);

    // Click OK to apply filter
    const okButton = await screen.findByRole('button', { name: 'OK' });
    await userEvent.click(okButton);

    // Verify API was called with the filter
    await waitFor(() => {
      expect(lastByStatus).toContain('succeeded');
    });

    // Verify only succeeded deployments are shown (2 rows + header)
    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(3);
    });

    // Open filter again and add another status (multiselect)
    await userEvent.click(filterTrigger);

    // Select "failed" to add to the filter
    const failedOption = await screen.findByText('failed', {
      selector: '.ant-table-filter-dropdown span',
    });
    await userEvent.click(failedOption);

    // Click OK to apply filter
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    // Verify API was called with both filters
    await waitFor(() => {
      expect(lastByStatus).toEqual(expect.arrayContaining(['succeeded', 'failed']));
    });

    // Verify succeeded + failed deployments are shown (3 rows + header)
    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(4);
    });

    // Open filter again and reset
    await userEvent.click(filterTrigger);

    // Click Reset to clear all selections, then OK to apply
    const resetButton = await screen.findByRole('button', { name: 'Reset' });
    await userEvent.click(resetButton);

    // Click OK to apply the cleared filters
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    // Verify API was called without filters
    await waitFor(() => {
      expect(lastByStatus).toEqual([]);
    });

    // Verify all deployments are shown again (4 rows + header)
    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(5);
    });
  });

  it('should filter by mode and send correct API params including plan variants', async () => {
    // Track the filter parameters sent to the API
    let lastByMode: string[] | undefined;

    server.use(
      getListDeploymentsMockHandler((info) => {
        const url = new URL(info.request.url);
        lastByMode = url.searchParams.getAll('by_mode');

        // Return filtered results based on the mode filter
        let filteredItems = mockDeployments;
        if (lastByMode && lastByMode.length > 0) {
          // Simulate API behavior: plan_only and rollback_plan are query params,
          // but response has mode: deploy/rollback with plan_only: true
          filteredItems = mockDeployments.filter((d) => {
            if (lastByMode!.includes(d.mode)) return true;
            if (lastByMode!.includes('plan_only') && d.mode === 'deploy' && d.plan_only)
              return true;
            if (lastByMode!.includes('rollback_plan') && d.mode === 'rollback' && d.plan_only)
              return true;
            return false;
          });
        }

        return {
          items: filteredItems,
          next_page_token: undefined,
        };
      }),
    );

    renderDeploys();

    // Wait for initial render with all deployments
    expect(await screen.findByRole('table')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(5);
    });

    // Open the Mode column filter dropdown
    const modeColumnHeader = screen.getByRole('columnheader', { name: /Mode/ });
    const filterTrigger = within(modeColumnHeader).getByRole('button');
    await userEvent.click(filterTrigger);

    // Select "deploy" - should only show deploy, rollback, destroy options (not plan_only/rollback_plan)
    const deployOption = await screen.findByText('deploy', {
      selector: '.ant-table-filter-dropdown span',
    });
    await userEvent.click(deployOption);

    // Click OK to apply filter
    const okButton = await screen.findByRole('button', { name: 'OK' });
    await userEvent.click(okButton);

    // Verify API was called with both 'deploy' AND 'plan_only' params
    // This ensures plan-only deploys are included when filtering by 'deploy'
    await waitFor(() => {
      expect(lastByMode).toEqual(expect.arrayContaining(['deploy', 'plan_only']));
    });

    // Open filter again and test rollback
    await userEvent.click(filterTrigger);

    // Reset first
    const resetButton = await screen.findByRole('button', { name: 'Reset' });
    await userEvent.click(resetButton);
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    // Open filter and select rollback
    await userEvent.click(filterTrigger);
    const rollbackOption = await screen.findByText('rollback', {
      selector: '.ant-table-filter-dropdown span',
    });
    await userEvent.click(rollbackOption);
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    // Verify API was called with both 'rollback' AND 'rollback_plan' params
    await waitFor(() => {
      expect(lastByMode).toEqual(expect.arrayContaining(['rollback', 'rollback_plan']));
    });

    // Verify the rollback deployment (which is a plan-only rollback) is shown
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'deploy-4' })).toBeInTheDocument();
    });
  });

  describe('pagination', () => {
    it('should not show page 2 button when there is no next page token', async () => {
      const responseWithoutNextPage: DeploymentPage = {
        items: mockDeployments,
        next_page_token: undefined,
      };
      server.use(getListDeploymentsMockHandler(responseWithoutNextPage));

      renderDeploys();

      // Wait for table to render with data
      expect(await screen.findByRole('link', { name: 'deploy-1' })).toBeInTheDocument();

      // Verify page 1 is shown (current page)
      const pagination = screen.getByRole('list');
      expect(within(pagination).getByText('1')).toBeInTheDocument();

      // Verify page 2 button does not exist
      expect(within(pagination).queryByText('2')).not.toBeInTheDocument();

      // Verify next button is disabled
      const nextButton = within(pagination).getByRole('listitem', { name: /next/i });
      expect(nextButton).toHaveClass('ant-pagination-disabled');
    });

    it('should navigate between pages when next page token is provided', async () => {
      // 8 deployments total, 5 per page = 2 pages
      const page1Deployments = [
        createDeployment('deploy-1', ByStatusQueryParamParameterItem.succeeded),
        createDeployment('deploy-2', ByStatusQueryParamParameterItem.succeeded),
        createDeployment('deploy-3', ByStatusQueryParamParameterItem.succeeded),
        createDeployment('deploy-4', ByStatusQueryParamParameterItem.succeeded),
        createDeployment('deploy-5', ByStatusQueryParamParameterItem.succeeded),
      ];

      const page2Deployments = [
        createDeployment('deploy-6', ByStatusQueryParamParameterItem.failed),
        createDeployment('deploy-7', ByStatusQueryParamParameterItem.failed),
        createDeployment('deploy-8', ByStatusQueryParamParameterItem.failed),
      ];

      const PAGE_2_TOKEN = 'page-2-token';

      server.use(
        getListDeploymentsMockHandler((info) => {
          const url = new URL(info.request.url);
          const pageToken = url.searchParams.get('page');

          // Return page 2 if token matches
          if (pageToken === PAGE_2_TOKEN) {
            return {
              items: page2Deployments,
              next_page_token: undefined, // No more pages
            };
          }

          // Return page 1 with next page token
          return {
            items: page1Deployments,
            next_page_token: PAGE_2_TOKEN,
          };
        }),
      );

      renderDeploys();

      // Wait for page 1 to render
      expect(await screen.findByRole('link', { name: 'deploy-1' })).toBeInTheDocument();

      // Verify page 1 shows 5 deployments (header + 5 rows)
      expect(screen.getAllByRole('row')).toHaveLength(6);

      // Verify page 2 button exists (because next_page_token was returned)
      const pagination = screen.getByRole('list');
      const page2Button = within(pagination).getByText('2');
      expect(page2Button).toBeInTheDocument();

      // Click page 2
      await userEvent.click(page2Button);

      // Wait for page 2 to load - deploy-6 should appear
      expect(await screen.findByRole('link', { name: 'deploy-6' })).toBeInTheDocument();

      // Verify page 2 shows 3 deployments (header + 3 rows)
      expect(screen.getAllByRole('row')).toHaveLength(4);

      // Verify page 1 deployments are no longer visible
      expect(screen.queryByRole('link', { name: 'deploy-1' })).not.toBeInTheDocument();

      // Click page 1 to go back
      const page1Button = within(pagination).getByText('1');
      await userEvent.click(page1Button);

      // Wait for page 1 to load again
      expect(await screen.findByRole('link', { name: 'deploy-1' })).toBeInTheDocument();

      // Verify page 1 shows 5 deployments again
      expect(screen.getAllByRole('row')).toHaveLength(6);

      // Verify page 2 deployments are no longer visible
      expect(screen.queryByRole('link', { name: 'deploy-6' })).not.toBeInTheDocument();
    });
  });
});
