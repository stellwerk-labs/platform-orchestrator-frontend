import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  getCheckPermissionsMockHandler403,
  getGetCurrentUserMockHandler,
} from '@src/hooks/react-query/v2/iam/user/user.msw';
import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';
import { answerPermissionChecks } from '@src/testing-utils/permissionChecks';

import { NavigationBar } from './NavigationBar';

const renderNavigation = () =>
  render(
    <MockProviders route={{ path: '/orgs/:orgId/projects', url: '/orgs/my-org/projects' }}>
      <NavigationBar />
    </MockProviders>,
  );

describe('NavigationBar', () => {
  beforeEach(() =>
    server.use(
      getGetCurrentUserMockHandler(),
      http.get('http://example.com/orgs/:orgId/plugins', () => HttpResponse.json({ items: [] })),
    ),
  );

  it('links Administration for a platform operator holding plugin_manager_read', async () => {
    server.use(
      answerPermissionChecks(
        ({ resource, permission }) =>
          resource === 'platform' && permission === 'plugin_manager_read',
      ),
    );

    renderNavigation();

    expect(await screen.findByRole('link', { name: 'Administration' })).toHaveAttribute(
      'href',
      '/platform',
    );
  });

  it('links Administration for an installation settings operator', async () => {
    server.use(
      answerPermissionChecks(
        ({ resource, permission }) =>
          resource === 'platform' && permission === 'platform_settings_read',
      ),
    );
    renderNavigation();
    expect(await screen.findByRole('link', { name: 'Administration' })).toHaveAttribute(
      'href',
      '/platform',
    );
    expect(screen.queryByRole('link', { name: 'Plugin Manager' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Installation settings' })).not.toBeInTheDocument();
  });

  it('hides Administration from everyone else', async () => {
    server.use(answerPermissionChecks(({ resource }) => resource !== 'platform'));

    renderNavigation();

    expect(await screen.findByRole('link', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument();
  });

  it('hides Administration when the permission check fails', async () => {
    server.use(getCheckPermissionsMockHandler403());

    renderNavigation();

    expect(await screen.findByRole('link', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument();
  });
});
