import { QueryClient } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ResourceTypesDetails } from '@src/containers/Orgs/ResourceTypes/containers/ResourceTypesDetails/ResourceTypesDetails';
import { getListEnvironmentsInOrgQueryKey } from '@src/hooks/react-query/v2/controlplane/environment/environment';
import {
  getGetModuleCatalogueEntryQueryKey,
  getListEnvironmentModuleVersionPinsQueryKey,
  getListModuleVersionsQueryKey,
} from '@src/hooks/react-query/v2/controlplane/modules/modules';
import { getGetResourceTypeQueryKey } from '@src/hooks/react-query/v2/controlplane/resource-type/resource-type';
import { getCheckPermissionsQueryKey } from '@src/hooks/react-query/v2/iam/user/user';
import { RBACPermission } from '@src/hooks/useRBAC';
import type { ResourcePermissionCheck } from '@src/models/v2/iam';
import { MockProviders } from '@src/testing-utils/MockProviders';

import { ModulePins } from './containers/ModuleDetails/containers/ModulePins';
import {
  moduleVersionActionPermission,
  ModuleVersions,
} from './containers/ModuleDetails/containers/ModuleVersions';
import { ModuleDetails } from './containers/ModuleDetails/ModuleDetails';

// These UI unit tests use actual React Query cache snapshots, not substitute
// implementations of permission hooks or network responses. Live IAM/CP
// acceptance is tested separately against the running installation.
const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((client) => client.clear()));

const createClient = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  clients.push(client);
  client.setQueryData(getGetModuleCatalogueEntryQueryKey('atlas', 'redis'), {
    uuid: 'module-uuid',
    status: 'active',
    previous_default_version_uuid: 'previous',
  });
  return client;
};

const setPermissions = (
  client: QueryClient,
  checks: ResourcePermissionCheck[],
  allowed: ResourcePermissionCheck[],
) => {
  client.setQueryData(getCheckPermissionsQueryKey(checks), {
    items: checks.map((permission_check) => ({
      permission_check,
      allowed: allowed.some(
        (item) =>
          item.resource === permission_check.resource &&
          item.permission === permission_check.permission,
      ),
    })),
  });
};

const renderVersions = (
  grants: RBACPermission[],
  status: 'proposed' | 'default' = 'default',
  semver = '1.1.0',
) => {
  const client = createClient();
  const permissions = [
    RBACPermission.MODULE_VERSION_PUBLISH,
    ...Object.values(moduleVersionActionPermission),
  ];
  const checks = permissions.map((permission) => ({ resource: 'organization:atlas', permission }));
  setPermissions(
    client,
    checks,
    checks.filter((check) => grants.includes(check.permission)),
  );
  client.setQueryData(
    getListModuleVersionsQueryKey('atlas', 'redis', {
      include_deprecated: true,
      include_defective: true,
    }),
    {
      items: [
        {
          version: {
            uuid: 'current',
            semantic_version: semver,
            lifecycle_status: status,
            created_at: '2026-09-07T10:00:00Z',
          },
        },
        {
          version: {
            uuid: 'previous',
            semantic_version: '1.0.0',
            lifecycle_status: 'deprecated',
            created_at: '2026-09-07T09:00:00Z',
          },
        },
      ],
    },
  );
  render(
    <MockProviders
      queryClient={client}
      route={{
        path: '/orgs/:orgId/modules/:moduleId/versions',
        url: '/orgs/atlas/modules/redis/versions',
      }}>
      <ModuleVersions />
    </MockProviders>,
  );
  return client;
};

describe('Module Version action permissions', () => {
  it('keeps lifecycle controls disabled without their exact grants', () => {
    renderVersions([]);
    expect(screen.getByRole('button', { name: 'Publish Module Version' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Restore previous Default' })).toBeDisabled();
    for (const button of screen.getAllByRole('button', { name: 'Mark Defective' }))
      expect(button).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Evidence' })[0]).toBeEnabled();
  });

  it('does not turn promotion permission into deprecation or restore rights', () => {
    renderVersions([RBACPermission.MODULE_VERSION_PROMOTE], 'proposed');
    expect(screen.getByRole('button', { name: 'Promote to Default' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Deprecate' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Restore previous Default' })).toBeDisabled();
  });

  it('requires publication and deprecation for the atomic stable successor', () => {
    renderVersions([RBACPermission.MODULE_VERSION_PUBLISH], 'proposed', '1.1.0-rc.1');
    expect(screen.getByRole('button', { name: 'Publish stable successor' })).toBeDisabled();
  });

  it('enables the stable successor with both explicit permissions', () => {
    renderVersions(
      [RBACPermission.MODULE_VERSION_PUBLISH, RBACPermission.MODULE_VERSION_DEPRECATE],
      'proposed',
      '1.1.0-rc.1',
    );
    expect(screen.getByRole('button', { name: 'Publish stable successor' })).toBeEnabled();
  });
});

describe('catalogue permissions', () => {
  it.each([
    ['configuration', 'Definition'],
    ['versions', 'Versions'],
    ['pins', 'Environment Pins'],
    ['rules', 'Rules'],
  ])('selects the %s tab when opening its URL directly', (tab, label) => {
    const client = createClient();
    setPermissions(
      client,
      [{ resource: 'organization:atlas', permission: RBACPermission.MODULE_ARCHIVE }],
      [],
    );
    render(
      <MockProviders
        queryClient={client}
        route={{
          path: '/orgs/:orgId/modules/:moduleId/:tab',
          url: `/orgs/atlas/modules/redis/${tab}`,
        }}>
        <ModuleDetails />
      </MockProviders>,
    );
    expect(screen.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true');
  });

  it('does not show an enabled archive action to a Module reader', () => {
    const client = createClient();
    setPermissions(
      client,
      [{ resource: 'organization:atlas', permission: RBACPermission.MODULE_ARCHIVE }],
      [],
    );
    render(
      <MockProviders
        queryClient={client}
        route={{ path: '/orgs/:orgId/modules/:moduleId', url: '/orgs/atlas/modules/redis' }}>
        <ModuleDetails />
      </MockProviders>,
    );
    expect(screen.getByRole('button', { name: 'Archive Module' })).toBeDisabled();
  });

  it('requires Resource Type management separately from Module archive rights', () => {
    const client = createClient();
    client.setQueryData(getGetResourceTypeQueryKey('atlas', 'redis'), {
      id: 'redis',
      catalogue_status: 'active',
      built_in: false,
      created_at: '2026-09-07T10:00:00Z',
    });
    setPermissions(
      client,
      [{ resource: 'organization:atlas', permission: RBACPermission.RESOURCE_TYPE_WRITE }],
      [{ resource: 'organization:atlas', permission: RBACPermission.MODULE_ARCHIVE }],
    );
    render(
      <MockProviders
        queryClient={client}
        route={{
          path: '/orgs/:orgId/resource-types/:resourceTypeId',
          url: '/orgs/atlas/resource-types/redis',
        }}>
        <ResourceTypesDetails />
      </MockProviders>,
    );
    expect(screen.getByRole('button', { name: 'Archive Resource Type' })).toBeDisabled();
  });
});

describe('Environment Pin scope permissions', () => {
  it('allows removing another creator’s Pin only in the authorised Environment and keeps notes independent', () => {
    const client = createClient();
    const environmentIds = ['environment-east', 'environment-west'];
    client.setQueryData(getListEnvironmentsInOrgQueryKey('atlas', { per_page: 100 }), {
      items: environmentIds.map((uuid) => ({
        uuid,
        project_uuid: 'project-uuid',
        project_id: 'store',
        display_name: uuid,
        env_type_id: 'production',
      })),
    });
    client.setQueryData(
      getListModuleVersionsQueryKey('atlas', 'redis', {
        include_deprecated: true,
        include_defective: true,
      }),
      { items: [] },
    );
    client.setQueryData(
      getListEnvironmentModuleVersionPinsQueryKey('atlas', {
        module_uuid: 'module-uuid',
        include_removed: true,
      }),
      environmentIds.map((uuid) => ({
        id: `pin-${uuid}`,
        environment_uuid: uuid,
        environment_id: uuid,
        project_id: 'store',
        version_uuid: 'previous',
        status: 'active',
        created_by: 'another-user',
      })),
    );
    const checks = environmentIds.flatMap((uuid) =>
      [
        RBACPermission.MODULE_VERSION_PIN,
        RBACPermission.MODULE_VERSION_PIN_NOTE,
        RBACPermission.MODULE_VERSION_UNPIN,
        RBACPermission.MODULE_VERSION_PIN_DEFECTIVE,
      ].map((permission) => ({ resource: `env:${uuid}`, permission })),
    );
    setPermissions(client, checks, [
      { resource: 'env:environment-east', permission: RBACPermission.MODULE_VERSION_UNPIN },
      { resource: 'env:environment-west', permission: RBACPermission.MODULE_VERSION_PIN_NOTE },
    ]);
    render(
      <MockProviders
        queryClient={client}
        route={{
          path: '/orgs/:orgId/modules/:moduleId/pins',
          url: '/orgs/atlas/modules/redis/pins',
        }}>
        <ModulePins />
      </MockProviders>,
    );
    const east = within(screen.getByRole('row', { name: /store environment-east/ }));
    const west = within(screen.getByRole('row', { name: /store environment-west/ }));
    expect(east.getByRole('button', { name: 'Unpin' })).toBeEnabled();
    expect(east.getByRole('button', { name: 'Add note' })).toBeDisabled();
    expect(west.getByRole('button', { name: 'Unpin' })).toBeDisabled();
    expect(west.getByRole('button', { name: 'Add note' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Pin Environment' })).toBeDisabled();
  });
});
