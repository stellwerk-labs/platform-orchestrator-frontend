import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  getListPluginInstallationsMockHandler,
  getListPluginInstallationsMockHandler403,
  getListPluginInstallationsMockHandler404,
  getListPluginPackagesMockHandler,
} from '@src/hooks/react-query/v2/controlplane/plugin-manager/plugin-manager.msw';
import { server } from '@src/testing-utils/mswServer';

import {
  digestV1,
  digestV2,
  enablement,
  grant,
  installation,
  installationId,
  operatorCanRead,
  pluginPackage,
  renderPluginManager,
  servePackages,
} from './pluginManagerFixtures';

const serveInstallations = (...items: ReturnType<typeof installation>[]) =>
  server.use(getListPluginInstallationsMockHandler({ revision: 7, items }));

const rowOf = async (pluginId: string) =>
  (await screen.findByText(pluginId)).closest('tr') as HTMLElement;

describe('PluginInstallations', () => {
  it('lists the installation with package, state, mode, enabled organizations and licence', async () => {
    operatorCanRead(true);
    servePackages(pluginPackage());
    serveInstallations(
      installation({
        organization_mode: 'all',
        organizations: [
          enablement({ org_id: 'acme' }),
          enablement({ org_id: 'beta' }),
          enablement({ org_id: 'gamma', state: 'disabled' }),
        ],
        entitlement: {
          enabled_organizations: 2,
          installation_grant: grant({ organization_limit: 10 }),
        },
      }),
    );

    renderPluginManager('/platform/plugins');

    const row = await rowOf('com.example.rollouts');
    expect(await within(row).findByText('1.4.0')).toBeInTheDocument();
    expect(within(row).getByTitle(digestV1)).toHaveTextContent(digestV1.slice(0, 12));
    expect(within(row).getByText('active')).toBeInTheDocument();
    expect(within(row).getByText('all')).toBeInTheDocument();
    expect(within(row).getByText('2')).toBeInTheDocument();
    expect(within(row).getByText('valid')).toBeInTheDocument();
    expect(within(row).getByText('2 of 10 organizations')).toBeInTheDocument();
    expect(within(row).getByText('None')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'com.example.rollouts' })).toHaveAttribute(
      'href',
      `/platform/plugins/${installationId}`,
    );
  });

  it('flags organizations whose capability registration failed or is pending', async () => {
    operatorCanRead(true);
    servePackages(pluginPackage());
    serveInstallations(
      installation({
        organizations: [
          enablement({
            org_id: 'acme',
            capability_registration: { state: 'failed', detail: 'IAM' },
          }),
          enablement({ org_id: 'beta', capability_registration: { state: 'failed' } }),
          enablement({ org_id: 'gamma', capability_registration: { state: 'pending' } }),
          enablement({
            org_id: 'delta',
            state: 'disabled',
            capability_registration: { state: 'pending' },
          }),
          enablement({ org_id: 'omega' }),
        ],
        diagnostic: { code: 'plugin_package_digest_mismatch', message: 'wrong package' },
      }),
    );

    renderPluginManager('/platform/plugins');

    const row = await rowOf('com.example.rollouts');
    expect(within(row).getByText('2 failed')).toBeInTheDocument();
    expect(within(row).getByText('2 pending')).toBeInTheDocument();
    expect(within(row).getByText('plugin_package_digest_mismatch')).toBeInTheDocument();
    expect(within(row).getByText('4')).toBeInTheDocument();
  });

  it('summarises the licence of an installation without an installation grant and of one without a licence', async () => {
    operatorCanRead(true);
    servePackages(pluginPackage());
    serveInstallations(
      installation({
        entitlement: { enabled_organizations: 1 },
        organizations: [enablement()],
      }),
      installation({
        installation_id: '9c1e6b0a-0000-4000-8000-000000000002',
        plugin_id: 'com.example.free',
      }),
    );

    renderPluginManager('/platform/plugins');

    const licensed = await rowOf('com.example.rollouts');
    expect(within(licensed).getByText('No installation grant')).toBeInTheDocument();
    expect(within(licensed).getByText('1 enabled')).toBeInTheDocument();
    const free = await rowOf('com.example.free');
    expect(within(free).getByText('No licence required')).toBeInTheDocument();
  });

  it('shows a grant in grace and a grant without an organization limit', async () => {
    operatorCanRead(true);
    servePackages(pluginPackage());
    serveInstallations(
      installation({
        entitlement: { enabled_organizations: 4, installation_grant: grant({ state: 'grace' }) },
      }),
    );

    renderPluginManager('/platform/plugins');

    const row = await rowOf('com.example.rollouts');
    expect(within(row).getByText('grace')).toBeInTheDocument();
    expect(within(row).getByText('No organization limit')).toBeInTheDocument();
  });

  it('names a pending upgrade and sorts installations by plugin ID', async () => {
    operatorCanRead(true);
    servePackages(pluginPackage(), pluginPackage({ manifest_sha256: digestV2, version: '1.5.0' }));
    serveInstallations(
      installation({
        installation_id: '9c1e6b0a-0000-4000-8000-000000000003',
        plugin_id: 'com.example.zeta',
      }),
      installation({ target_package_sha256: digestV2 }),
    );

    renderPluginManager('/platform/plugins');

    const row = await rowOf('com.example.rollouts');
    expect(await within(row).findByText(/Upgrade pending: 1.5.0/)).toBeInTheDocument();
    const links = screen.getAllByRole('link').map((link) => link.textContent);
    expect(links).toEqual(['com.example.rollouts', 'com.example.zeta']);
  });

  it('shows the digest when the package list cannot be read', async () => {
    operatorCanRead(true);
    server.use(getListPluginPackagesMockHandler(() => Promise.reject(new Error('boom'))));
    serveInstallations(installation());

    renderPluginManager('/platform/plugins');

    const row = await rowOf('com.example.rollouts');
    expect(within(row).getByText('Unknown version')).toBeInTheDocument();
    expect(within(row).getByText(digestV1.slice(0, 12))).toBeInTheDocument();
  });

  it('offers nothing that changes anything', async () => {
    operatorCanRead(true);
    servePackages(pluginPackage());
    serveInstallations(installation({ organizations: [enablement()] }));

    renderPluginManager('/platform/plugins');

    await rowOf('com.example.rollouts');
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.queryAllByRole('switch')).toEqual([]);
    expect(screen.queryAllByRole('textbox')).toEqual([]);
  });

  it('says that nothing is installed', async () => {
    operatorCanRead(true);
    servePackages();
    serveInstallations();

    renderPluginManager('/platform/plugins');

    expect(await screen.findByText('No plugin is installed.')).toBeInTheDocument();
  });

  it('explains that the plugin host is switched off', async () => {
    operatorCanRead(true);
    servePackages();
    server.use(
      getListPluginInstallationsMockHandler404({
        error: 'plugin_host_disabled',
        message: 'The plugin host is off.',
      }),
    );

    renderPluginManager('/platform/plugins');

    expect(await screen.findByText('The plugin host is switched off')).toBeInTheDocument();
  });

  it('reports a refusal by the Control Plane', async () => {
    operatorCanRead(true);
    servePackages();
    server.use(
      getListPluginInstallationsMockHandler403({ error: 'forbidden', message: 'Not allowed.' }),
    );

    renderPluginManager('/platform/plugins');

    expect(await screen.findByText('The Control Plane refused the request')).toBeInTheDocument();
  });

  it('reports a failing read with the server message', async () => {
    operatorCanRead(true);
    servePackages();
    server.use(
      getListPluginInstallationsMockHandler(() => {
        throw new Response(JSON.stringify({ error: 'internal', message: 'Database is down.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    renderPluginManager('/platform/plugins');

    expect(
      await screen.findByText('The plugin installations could not be loaded'),
    ).toBeInTheDocument();
    expect(screen.getByText('Database is down.')).toBeInTheDocument();
  });
});
