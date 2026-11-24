import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { Breadcrumbs } from '@src/components/shared/Breadcrumbs/Breadcrumbs';

import { getSharedBreadcrumbs } from './breadcrumbs-utils';

describe('Deployment return navigation', () => {
  it('keeps Deployments linked before the current Deployment data has loaded', async () => {
    const match = {
      id: 'deployment',
      pathname: '/orgs/org/projects/project/envs/env/deploys/source',
      params: { orgId: 'org', projectId: 'project', envId: 'env', deployId: 'source' },
      data: undefined,
      loaderData: undefined,
      handle: undefined,
    };
    render(
      <MemoryRouter initialEntries={[`${match.pathname}/pipeline`]}>
        <Routes>
          <Route
            path={'/orgs/:orgId/projects/:projectId/envs/:envId/deploys/:deployId/pipeline'}
            element={<Breadcrumbs crumbs={getSharedBreadcrumbs(match)} />}
          />
          <Route
            path={'/orgs/:orgId/projects/:projectId/envs/:envId/deploys'}
            element={<div>Deployment overview</div>}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('source')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Deployments' })).toHaveAttribute(
      'href',
      '/orgs/org/projects/project/envs/env/deploys',
    );
    await userEvent.click(screen.getByRole('link', { name: 'Deployments' }));
    expect(screen.getByText('Deployment overview')).toBeVisible();
  });
});
