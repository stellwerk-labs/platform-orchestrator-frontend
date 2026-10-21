import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  getGetPluginInstallationMockHandler,
  getGetPluginInstallationMockHandler403,
  getGetPluginInstallationMockHandler404,
  getListPluginAuditEventsMockHandler403,
  getListPluginPackagesMockHandler403,
} from '@src/hooks/react-query/v2/controlplane/plugin-manager/plugin-manager.msw';
import { server } from '@src/testing-utils/mswServer';

import {
  auditEvent,
  digestV1,
  digestV2,
  enablement,
  grant,
  installation,
  installationId,
  operatorCanRead,
  pluginPackage,
  renderPluginManager,
  serveAuditTrail,
  servePackages,
} from './pluginManagerFixtures';

const detailUrl = `/platform/plugins/${installationId}`;

const serveInstallation = (value: ReturnType<typeof installation>) =>
  server.use(getGetPluginInstallationMockHandler(value));

const cardOf = async (title: string) =>
  (await screen.findByText(title)).closest('.ant-card') as HTMLElement;

const rowOf = (card: HTMLElement, text: string) =>
  within(card).getByText(text).closest('tr') as HTMLElement;

describe('PluginInstallationDetails', () => {
  it('shows the installation, its organizations, grant, packages and audit events', async () => {
    operatorCanRead(true);
    servePackages(
      pluginPackage(),
      pluginPackage({ manifest_sha256: digestV2, version: '1.5.0' }),
      pluginPackage({
        manifest_sha256: 'c'.repeat(64),
        plugin_id: 'com.example.other',
        version: '9.9.9',
      }),
    );
    serveAuditTrail([
      auditEvent(1, { action: 'plugin_installation.create', reason: 'first install' }),
      auditEvent(2, {
        action: 'plugin_enablement.put',
        org_id: 'acme',
        reason: 'enable acme',
      }),
      auditEvent(3, {
        installation_id: '9c1e6b0a-0000-4000-8000-000000000009',
        reason: 'other plugin',
      }),
    ]);
    serveInstallation(
      installation({
        target_package_sha256: digestV2,
        organization_mode: 'all',
        organization_defaults: {
          timezone: 'Europe/Berlin',
          approval_policies: { deploy: 'two-person' },
        },
        pending_organizations: ['zulu'],
        organizations: [
          enablement({
            org_id: 'acme',
            entitlement_grant: grant({ scope: 'organization', state: 'grace' }),
          }),
          enablement({
            org_id: 'beta',
            state: 'disabled',
            timezone: 'Asia/Tokyo',
            capability_registration: { state: 'failed', detail: 'IAM refused the catalogue' },
            entitlement_grant: grant(),
          }),
        ],
        entitlement: {
          enabled_organizations: 1,
          installation_grant: grant({ organization_limit: 5, features: ['rollouts', 'queue'] }),
        },
      }),
    );

    renderPluginManager(detailUrl);

    expect(
      await screen.findByRole('heading', { name: 'com.example.rollouts' }),
    ).toBeInTheDocument();
    const overview = await cardOf('Installation');
    expect(within(overview).getByText('all')).toBeInTheDocument();
    expect(within(overview).getByText('deploy: two-person')).toBeInTheDocument();
    expect(await within(overview).findByText(/1\.4\.0/)).toBeInTheDocument();
    expect(within(overview).getByText(/1\.5\.0/)).toBeInTheDocument();

    const organizations = await cardOf('Organizations');
    const acme = within(rowOf(organizations, 'acme'));
    expect(acme.getByText('enabled')).toBeInTheDocument();
    expect(acme.getByText('Europe/Berlin')).toBeInTheDocument();
    expect(acme.getByText('registered')).toBeInTheDocument();
    expect(acme.getByText('organization')).toBeInTheDocument();
    expect(acme.getByText('grace')).toBeInTheDocument();
    const beta = within(rowOf(organizations, 'beta'));
    expect(beta.getByText('disabled')).toBeInTheDocument();
    expect(beta.getByText('Asia/Tokyo')).toBeInTheDocument();
    expect(beta.getByText('failed')).toBeInTheDocument();
    expect(beta.getByText('IAM refused the catalogue')).toBeInTheDocument();
    expect(beta.getByText('installation')).toBeInTheDocument();
    expect(within(organizations).getByText('zulu')).toBeInTheDocument();

    const licence = await cardOf('Installation grant');
    expect(within(licence).getByText('5')).toBeInTheDocument();
    expect(within(licence).getByText('1')).toBeInTheDocument();
    expect(within(licence).getByText('rollouts, queue')).toBeInTheDocument();
    expect(within(licence).getByText('example-issuer')).toBeInTheDocument();

    const packages = await cardOf('Packages');
    expect(within(rowOf(packages, '1.4.0')).getByText('Served')).toBeInTheDocument();
    expect(within(rowOf(packages, '1.5.0')).getByText('Upgrade target')).toBeInTheDocument();
    expect(within(packages).getByTitle(digestV1)).toBeInTheDocument();
    expect(within(packages).queryByText('9.9.9')).not.toBeInTheDocument();

    const audit = await cardOf('Recent audit events');
    expect(await within(audit).findByText('first install')).toBeInTheDocument();
    expect(within(audit).getByText('enable acme')).toBeInTheDocument();
    expect(within(audit).queryByText('other plugin')).not.toBeInTheDocument();
  });

  it('offers nothing that changes anything', async () => {
    operatorCanRead(true);
    servePackages(pluginPackage());
    serveAuditTrail([auditEvent(1)]);
    serveInstallation(installation({ organizations: [enablement()] }));

    renderPluginManager(detailUrl);

    expect(await screen.findByText('reason 1')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.queryAllByRole('switch')).toEqual([]);
  });

  it('shows the 20 newest events of the installation after walking every audit page', async () => {
    operatorCanRead(true);
    servePackages(pluginPackage());
    const other = '9c1e6b0a-0000-4000-8000-000000000009';
    const events = Array.from({ length: 450 }, (_, index) =>
      auditEvent(index + 1, {
        installation_id: index % 5 === 0 ? other : installationId,
        reason: `event ${index + 1}`,
      }),
    );
    const requests = serveAuditTrail(events);
    serveInstallation(installation());

    renderPluginManager(detailUrl);

    const audit = await cardOf('Recent audit events');
    expect(await within(audit).findByText('event 450')).toBeInTheDocument();
    expect(requests.map((url) => url.searchParams.get('after'))).toEqual(['0', '200', '400']);
    const rows = within(audit).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(20);
    expect(within(rows[0] as HTMLElement).getByText('event 450')).toBeInTheDocument();
    expect(within(rows[19] as HTMLElement).getByText('event 427')).toBeInTheDocument();
    expect(within(audit).queryByText('event 446')).not.toBeInTheDocument();
  });

  it('stops after a page that holds exactly the page size when the next page is empty', async () => {
    operatorCanRead(true);
    servePackages(pluginPackage());
    const requests = serveAuditTrail(
      Array.from({ length: 200 }, (_, index) => auditEvent(index + 1)),
    );
    serveInstallation(installation());

    renderPluginManager(detailUrl);

    expect(await screen.findByText('reason 200')).toBeInTheDocument();
    expect(requests.map((url) => url.searchParams.get('after'))).toEqual(['0', '200']);
  });

  it('shows an organization without a covering grant as not entitled and a package without a licence plainly', async () => {
    operatorCanRead(true);
    servePackages(pluginPackage());
    serveAuditTrail([]);
    serveInstallation(
      installation({
        organizations: [enablement({ org_id: 'acme' })],
        entitlement: { enabled_organizations: 1 },
      }),
    );

    renderPluginManager(detailUrl);

    const organizations = await cardOf('Organizations');
    expect(within(rowOf(organizations, 'acme')).getByText('Not entitled')).toBeInTheDocument();
    const licence = await cardOf('Installation grant');
    expect(within(licence).getByText(/No installation-wide grant is imported/)).toBeInTheDocument();
  });

  it('says that a package without a licence needs none', async () => {
    operatorCanRead(true);
    servePackages(pluginPackage());
    serveAuditTrail([]);
    serveInstallation(installation({ organizations: [enablement({ org_id: 'acme' })] }));

    renderPluginManager(detailUrl);

    const licence = await cardOf('Installation grant');
    expect(within(licence).getByText('This package requires no licence.')).toBeInTheDocument();
    const organizations = await cardOf('Organizations');
    expect(
      within(rowOf(organizations, 'acme')).getByText('No licence required'),
    ).toBeInTheDocument();
  });

  it('shows the empty states of an installation nobody uses yet', async () => {
    operatorCanRead(true);
    servePackages();
    serveAuditTrail([]);
    serveInstallation(installation());

    renderPluginManager(detailUrl);

    expect(await screen.findByText('No organization has an enablement.')).toBeInTheDocument();
    expect(screen.getByText('No organization waits for an enablement.')).toBeInTheDocument();
    expect(
      await screen.findByText('No package is registered for this plugin.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('No audit event names this installation.')).toBeInTheDocument();
  });

  it('shows the diagnostic of a plugin that does not prove the served package', async () => {
    operatorCanRead(true);
    servePackages(pluginPackage());
    serveAuditTrail([]);
    serveInstallation(
      installation({
        diagnostic: {
          code: 'plugin_package_digest_mismatch',
          message: 'The plugin runs another package.',
        },
      }),
    );

    renderPluginManager(detailUrl);

    expect(await screen.findByText('plugin_package_digest_mismatch')).toBeInTheDocument();
    expect(screen.getByText('The plugin runs another package.')).toBeInTheDocument();
  });

  it('reports an unknown installation', async () => {
    operatorCanRead(true);
    servePackages();
    server.use(
      getGetPluginInstallationMockHandler404({
        error: 'not_found',
        message: 'No such installation.',
      }),
    );

    renderPluginManager(detailUrl);

    expect(await screen.findByText('The plugin installation was not found')).toBeInTheDocument();
  });

  it('reports a refusal by the Control Plane', async () => {
    operatorCanRead(true);
    servePackages();
    server.use(
      getGetPluginInstallationMockHandler403({ error: 'forbidden', message: 'Not allowed.' }),
    );

    renderPluginManager(detailUrl);

    expect(await screen.findByText('The Control Plane refused the request')).toBeInTheDocument();
  });

  it('keeps the installation visible when the audit events cannot be read', async () => {
    operatorCanRead(true);
    servePackages(pluginPackage());
    server.use(
      getListPluginAuditEventsMockHandler403({ error: 'forbidden', message: 'No audit.' }),
    );
    serveInstallation(installation({ organizations: [enablement({ org_id: 'acme' })] }));

    renderPluginManager(detailUrl);

    const audit = await cardOf('Recent audit events');
    expect(
      await within(audit).findByText('The Control Plane refused the request'),
    ).toBeInTheDocument();
    expect(screen.getByText('acme')).toBeInTheDocument();
  });

  it('keeps the installation visible when the packages cannot be read', async () => {
    operatorCanRead(true);
    server.use(
      getListPluginPackagesMockHandler403({ error: 'forbidden', message: 'No packages.' }),
    );
    serveAuditTrail([]);
    serveInstallation(installation({ organizations: [enablement({ org_id: 'acme' })] }));

    renderPluginManager(detailUrl);

    const packages = await cardOf('Packages');
    expect(
      await within(packages).findByText('The Control Plane refused the request'),
    ).toBeInTheDocument();
    expect(screen.getByText('acme')).toBeInTheDocument();
  });
});
