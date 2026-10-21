import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  getListPluginInstallationsMockHandler,
  getListPluginPackagesMockHandler,
} from '@src/hooks/react-query/v2/controlplane/plugin-manager/plugin-manager.msw';
import { getCheckPermissionsMockHandler403 } from '@src/hooks/react-query/v2/iam/user/user.msw';
import { ResourcePermissionCheck } from '@src/models/v2/iam';
import { server } from '@src/testing-utils/mswServer';
import { answerPermissionChecks } from '@src/testing-utils/permissionChecks';

import {
  installation,
  installationId,
  operatorCanRead,
  renderPluginManager,
} from './pluginManagerFixtures';

const forbidden = "You don't have access to the Plugin Manager";

describe('Plugin Manager access', () => {
  afterEach(() => server.events.removeAllListeners());

  it('shows the forbidden state to a user without plugin_manager_read and sends no Plugin Manager request', async () => {
    const requested: string[] = [];
    server.events.on('request:start', ({ request }) =>
      requested.push(new URL(request.url).pathname),
    );
    operatorCanRead(false);

    renderPluginManager('/platform/plugins');

    expect(await screen.findByText(forbidden)).toBeInTheDocument();
    expect(requested.filter((path) => path.startsWith('/plugin-'))).toEqual([]);
  });

  it('shows the forbidden state on the detail URL of an installation', async () => {
    operatorCanRead(false);

    renderPluginManager(`/platform/plugins/${installationId}`);

    expect(await screen.findByText(forbidden)).toBeInTheDocument();
  });

  it('does not take an organization permission for the platform permission', async () => {
    server.use(
      answerPermissionChecks(
        ({ resource, permission }) =>
          resource.startsWith('organization:') && permission === 'plugin_manager_read',
      ),
    );

    renderPluginManager('/platform/plugins');

    expect(await screen.findByText(forbidden)).toBeInTheDocument();
  });

  it('asks for plugin_manager_read on the platform resource and shows the view when held', async () => {
    const seen: ResourcePermissionCheck[] = [];
    server.use(
      getListPluginInstallationsMockHandler({ revision: 1, items: [installation()] }),
      getListPluginPackagesMockHandler({ revision: 1, items: [] }),
      answerPermissionChecks(() => true, seen),
    );

    renderPluginManager('/platform/plugins');

    expect(await screen.findByText('com.example.rollouts')).toBeInTheDocument();
    expect(seen).toContainEqual({ resource: 'platform', permission: 'plugin_manager_read' });
    expect(screen.queryByText(forbidden)).not.toBeInTheDocument();
  });

  it('shows the forbidden state when the permission check fails', async () => {
    server.use(getCheckPermissionsMockHandler403());

    renderPluginManager('/platform/plugins');

    expect(await screen.findByText(forbidden)).toBeInTheDocument();
  });
});
