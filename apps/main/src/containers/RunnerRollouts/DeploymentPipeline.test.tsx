import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { getGetEnvironmentQueryKey } from '@src/hooks/react-query/v2/controlplane/environment/environment';
import { getCheckPermissionsQueryKey } from '@src/hooks/react-query/v2/iam/user/user';
import { RBACPermission } from '@src/hooks/useRBAC';

import { DeploymentPipeline } from './DeploymentPipeline';
import { type DeploymentPipeline as Execution, pipelineQueryKey } from './deploymentPipelineApi';

describe('Pipeline detail reconciliation', () => {
  it('keeps one source-plan action card after status updates and child navigation', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const source: Execution = {
      definition: { id: 'default', version: 1, name: 'Plan', strategy: 'plan', steps: [] },
      progress: {
        id: 'source',
        environment_id: 'environment',
        revision: 1,
        created_at: '',
        phase: 'completed',
        subject: 'subject',
        infrastructure_applied: false,
      },
      plan: { state: 'ready', subject: 'subject', can_replan: false },
    };
    const child: Execution = {
      definition: {
        id: 'apply-plan',
        version: 1,
        name: 'Apply saved plan',
        strategy: 'apply_saved',
        steps: [],
      },
      progress: { ...source.progress, id: 'child', infrastructure_applied: true },
      source_plan_id: 'source',
    };
    client.setQueryData(pipelineQueryKey('org', 'source'), source);
    client.setQueryData(pipelineQueryKey('org', 'child'), child);
    client.setQueryData(getGetEnvironmentQueryKey('org', 'project', 'env'), {
      uuid: 'environment',
    });
    const checks = [
      RBACPermission.DEPLOYMENT_WRITE,
      RBACPermission.DEPLOYMENT_LOGS_READ,
      RBACPermission.DEPLOYMENT_READ,
    ].map((permission) => ({ resource: 'env:environment', permission }));
    client.setQueryData(getCheckPermissionsQueryKey(checks), {
      items: checks.map((permission_check) => ({ permission_check, allowed: true })),
    });
    const { unmount } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter
          initialEntries={['/orgs/org/projects/project/envs/env/deploys/source/pipeline']}>
          <Routes>
            <Route
              path={'/orgs/:orgId/projects/:projectId/envs/:envId/deploys/:deployId/pipeline'}
              element={<DeploymentPipeline />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    try {
      expect(screen.getAllByRole('button', { name: 'Apply this plan' })).toHaveLength(1);
      await act(async () => {
        client.setQueryData(pipelineQueryKey('org', 'source'), {
          ...source,
          plan: { state: 'used', apply_deployment_id: 'child', can_replan: false },
        });
      });
      for (let visit = 0; visit < 2; visit += 1) {
        expect(await screen.findByText('This plan has an apply deployment')).toBeVisible();
        expect(screen.getAllByText('This plan has an apply deployment')).toHaveLength(1);
        expect(screen.getAllByRole('link', { name: 'View apply deployment' })).toHaveLength(1);
        expect(screen.queryByRole('button', { name: 'Apply this plan' })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('link', { name: 'View apply deployment' }));
        expect(await screen.findByRole('link', { name: 'View source plan' })).toBeVisible();
        expect(screen.queryByText('This plan has an apply deployment')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('link', { name: 'View source plan' }));
      }
      expect(await screen.findByText('This plan has an apply deployment')).toBeVisible();
      expect(screen.getAllByText('This plan has an apply deployment')).toHaveLength(1);
    } finally {
      unmount();
      client.clear();
    }
  });
});
