import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useListActiveResourceNodes } from '@src/hooks/react-query/v2/dataplane/active-resource/active-resource';
import {
  useGetDeployment,
  useListDeploymentResourceNodes,
  useListLastDeployments,
} from '@src/hooks/react-query/v2/dataplane/deployment/deployment';
import type { ActiveResourceNode } from '@src/models/v2/dataplane';
import { MockProviders } from '@src/testing-utils/MockProviders';

import { Resources } from './Resources';

vi.mock(
  '@src/containers/Orgs/Projects/containers/Project/containers/ViewEnvironment/components/ResourceGraph/ResourceGraph',
  () => ({
    ResourceGraph: ({ resources }: { resources?: ActiveResourceNode[] }) => (
      // data-has-resources indicates whether resources were passed with any items
      <div data-testid={'resource-graph'} data-has-resources={String((resources?.length ?? 0) > 0)}>
        {'Resource Graph'}
      </div>
    ),
  }),
);

vi.mock('@src/hooks/react-query/v2/dataplane/deployment/deployment', () => ({
  useGetDeployment: vi.fn(),
  useListLastDeployments: vi.fn(),
  useListDeploymentResourceNodes: vi.fn(),
}));

vi.mock('@src/hooks/react-query/v2/dataplane/active-resource/active-resource', () => ({
  useListActiveResourceNodes: vi.fn(),
}));

const ROUTE = {
  path: '/orgs/:orgId/projects/:projectId/envs/:envId/deploys/:deployId/resources',
  url: '/orgs/test-org/projects/test-project/envs/test-env/deploys/deploy-1/resources',
};

const mockNode: ActiveResourceNode = {
  id: 'node-1',
  project_id: 'test-project',
  env_id: 'test-env',
  resource_type: 'postgres',
  resource_class: 'default',
  resource_id: 'shared.pg',
  deployment_id: 'deploy-1',
  module_id: 'my-module',
  module_version: '1.0.0',
  edges: {},
  metadata: {},
};

const mockLatestDeployment = (planOnly = false) => {
  vi.mocked(useGetDeployment).mockReturnValue({
    data: { id: 'deploy-1', plan_only: planOnly, status: 'succeeded', status_message: '' },
    isSuccess: true,
  } as any);

  // Only returns stateful deployments
  vi.mocked(useListLastDeployments).mockReturnValue({
    data: { items: [{ id: planOnly ? 'deploy-2' : 'deploy-1' }] },
    isSuccess: true,
  } as any);
};

const mockHistoricalDeployment = () => {
  vi.mocked(useGetDeployment).mockReturnValue({
    data: { id: 'deploy-1', plan_only: false, status: 'succeeded', status_message: '' },
    isSuccess: true,
  } as any);
  vi.mocked(useListLastDeployments).mockReturnValue({
    data: { items: [{ id: 'deploy-latest' }] },
    isSuccess: true,
  } as any);
};

const renderResources = () =>
  render(
    <MockProviders route={ROUTE}>
      <Resources />
    </MockProviders>,
  );

describe('Resources', () => {
  describe('latest stateful deployment', () => {
    it('renders a resource graph', () => {
      mockLatestDeployment();
      vi.mocked(useListActiveResourceNodes).mockReturnValue({ data: { items: [mockNode] } } as any);
      vi.mocked(useListDeploymentResourceNodes).mockReturnValue({ data: undefined } as any);

      renderResources();

      expect(screen.getAllByTestId('resource-graph')).toHaveLength(1);
    });

    it('renders the graph using resources from the active-resources endpoint', () => {
      mockLatestDeployment();
      vi.mocked(useListActiveResourceNodes).mockReturnValue({ data: { items: [mockNode] } } as any);
      vi.mocked(useListDeploymentResourceNodes).mockReturnValue({ data: undefined } as any);

      renderResources();

      expect(screen.getByTestId('resource-graph')).toHaveAttribute('data-has-resources', 'true');
    });
  });

  describe('plan-only deployment', () => {
    it('renders a resource graph with injected resources', () => {
      // Set latest deployment plan only
      mockLatestDeployment(true);
      vi.mocked(useListActiveResourceNodes).mockReturnValue({ data: undefined } as any);
      vi.mocked(useListDeploymentResourceNodes).mockReturnValue({
        data: { items: [mockNode] },
      } as any);

      renderResources();

      // We should override resources for plan-only
      expect(screen.getByTestId('resource-graph')).toHaveAttribute('data-has-resources', 'true');
    });
  });

  describe('historical non-latest deployment', () => {
    it('renders a resource graph with injected resources', () => {
      mockHistoricalDeployment();
      vi.mocked(useListActiveResourceNodes).mockReturnValue({ data: undefined } as any);
      vi.mocked(useListDeploymentResourceNodes).mockReturnValue({
        data: { items: [mockNode] },
      } as any);

      renderResources();

      expect(screen.getByTestId('resource-graph')).toHaveAttribute('data-has-resources', 'true');
    });

    it('does not show the old "only available for latest" message', () => {
      mockHistoricalDeployment();
      vi.mocked(useListActiveResourceNodes).mockReturnValue({ data: undefined } as any);
      vi.mocked(useListDeploymentResourceNodes).mockReturnValue({
        data: { items: [mockNode] },
      } as any);

      renderResources();

      expect(screen.queryByText(/only available for the latest/i)).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('renders nothing when deployment is not yet loaded', () => {
      vi.mocked(useGetDeployment).mockReturnValue({ data: undefined } as any);
      vi.mocked(useListLastDeployments).mockReturnValue({ data: undefined } as any);
      vi.mocked(useListActiveResourceNodes).mockReturnValue({ data: undefined } as any);
      vi.mocked(useListDeploymentResourceNodes).mockReturnValue({ data: undefined } as any);

      const { container } = renderResources();

      expect(container.firstChild).toBeNull();
    });
  });
});
