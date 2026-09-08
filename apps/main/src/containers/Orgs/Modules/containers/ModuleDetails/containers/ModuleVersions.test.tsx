import { QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  getGetModuleCatalogueEntryQueryKey,
  getListModuleVersionsQueryKey,
} from '@src/hooks/react-query/v2/controlplane/modules/modules';
import { getCheckPermissionsQueryKey } from '@src/hooks/react-query/v2/iam/user/user';
import { RBACPermission } from '@src/hooks/useRBAC';
import type {
  CoreModuleVersion,
  CoreModuleVersionDetail,
  CoreModuleVersionPage,
  ModuleVersionComparison,
} from '@src/models/v2/controlplane';
import type { ResourcePermissionCheck } from '@src/models/v2/iam';
import { MockProviders } from '@src/testing-utils/MockProviders';

import {
  ComparisonList,
  formatComparisonItems,
  formatComparisonValue,
  moduleVersionActionPermission,
  moduleVersionComparisonDetails,
  moduleVersionHistoryErrorCopy,
  moduleVersionLifecycleActions,
  ModuleVersions,
  publicationBodyFromDetail,
  stableSuccessorSemanticVersion,
  visibleModuleVersionItems,
} from './ModuleVersions';

const version = (
  lifecycle_status: CoreModuleVersion['lifecycle_status'],
  semantic_version = '1.2.0',
) =>
  ({
    lifecycle_status,
    semantic_version,
    uuid: '00000000-0000-0000-0000-000000000001',
  }) as CoreModuleVersion;

const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((client) => client.clear()));

const moduleVersionsQueryKey = getListModuleVersionsQueryKey('atlas', 'redis', {
  include_deprecated: true,
  include_defective: true,
});

const createModuleVersionsClient = () => {
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

const setVersionHistoryError = (client: QueryClient, data?: CoreModuleVersionPage) => {
  const error = Object.assign(new Error('module.version.read is required'), {
    response: { status: 403 },
  });
  client.setQueryDefaults(moduleVersionsQueryKey, {
    queryFn: async () => {
      throw error;
    },
    refetchOnMount: false,
    retry: false,
    retryOnMount: false,
    staleTime: Infinity,
  });
  const query = client
    .getQueryCache()
    .build<CoreModuleVersionPage, Error, CoreModuleVersionPage>(client, {
      queryKey: moduleVersionsQueryKey,
      queryFn: async () => {
        throw error;
      },
      retry: false,
    });
  query.setState({
    data,
    dataUpdatedAt: data ? Date.now() : 0,
    error,
    errorUpdatedAt: Date.now(),
    fetchStatus: 'idle',
    status: 'error',
  });
};

const renderModuleVersions = (client: QueryClient) => {
  const permissions = [
    RBACPermission.MODULE_VERSION_PUBLISH,
    ...Object.values(moduleVersionActionPermission),
  ];
  const checks = permissions.map((permission) => ({ resource: 'organization:atlas', permission }));
  setPermissions(client, checks, [
    { resource: 'organization:atlas', permission: RBACPermission.MODULE_VERSION_PUBLISH },
  ]);
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
};

describe('Module Version lifecycle actions', () => {
  it('does not offer promotion for a prerelease', () => {
    expect(moduleVersionLifecycleActions(version('proposed', '1.2.0-rc.1'))).toEqual([
      'deprecate',
      'mark-defective',
    ]);
  });

  it('suggests the stable SemVer that outranks an exact prerelease', () => {
    expect(stableSuccessorSemanticVersion('2.4.0-rc.3')).toBe('2.4.0');
    expect(stableSuccessorSemanticVersion('2.4.0-beta.1+build.7')).toBe('2.4.0');
  });

  it('limits restoration and terminal Defective behavior', () => {
    const deprecated = version('deprecated');
    expect(moduleVersionLifecycleActions(deprecated, deprecated.uuid)).toEqual([
      'restore',
      'mark-defective',
    ]);
    expect(
      moduleVersionLifecycleActions(deprecated, '00000000-0000-0000-0000-000000000002'),
    ).toEqual(['mark-defective']);
    expect(moduleVersionLifecycleActions(version('defective'))).toEqual([]);
  });
});

describe('Module Version history error states', () => {
  it('renders permission denied without stale rows or enabled publication when version history is forbidden', async () => {
    const client = createModuleVersionsClient();
    const staleVersion = {
      version: {
        uuid: 'stale-version',
        semantic_version: '1.0.0',
        lifecycle_status: 'default',
        created_at: '2026-09-07T10:00:00Z',
      },
    } as CoreModuleVersionDetail;
    setVersionHistoryError(client, { items: [staleVersion] });

    renderModuleVersions(client);

    expect(await screen.findByText('Version history requires module.version.read')).toBeVisible();
    expect(
      screen.getByText(
        'This Module is readable, but immutable Module Versions use a separate permission.',
      ),
    ).toBeVisible();
    expect(screen.getByText('Version history unavailable')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Publish Module Version' })).toBeDisabled();
    expect(screen.queryByText('1.0.0')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Evidence' })).not.toBeInTheDocument();
    expect(screen.queryByText('No data')).not.toBeInTheDocument();
  });

  it('describes permission denied separately from generic version history failures', () => {
    expect(moduleVersionHistoryErrorCopy(403)).toEqual({
      message: 'Version history requires module.version.read',
      description:
        'This Module is readable, but immutable Module Versions use a separate permission.',
    });
    expect(moduleVersionHistoryErrorCopy(500)).toEqual({
      message: 'Version history could not be loaded',
      description:
        'Reload the page to try again. If the problem persists, contact your administrator.',
    });
  });

  it('does not expose stale cached versions while history is in an error state', () => {
    const staleVersion = {
      version: {
        uuid: 'stale-version',
        semantic_version: '1.0.0',
        lifecycle_status: 'default',
        created_at: '2026-09-07T10:00:00Z',
      },
    } as CoreModuleVersionDetail;

    expect(
      visibleModuleVersionItems({
        isError: true,
        data: { items: [staleVersion] },
      }),
    ).toEqual([]);
    expect(
      visibleModuleVersionItems({
        isError: false,
        data: {
          items: [staleVersion],
        },
      }),
    ).toHaveLength(1);
  });
});

describe('Module Version comparison', () => {
  it('preserves an explicit empty output declaration and does not invent a digest', () => {
    const detail = {
      version: { semantic_version: '1.0.0', artifact_digest: '', source_revision: 'release-one' },
      definition: { module_source: 'git::https://example.invalid/module.git', output_schema: {} },
    } as CoreModuleVersionDetail;
    const body = publicationBodyFromDetail(detail);
    expect(body).not.toHaveProperty('artifact_digest');
    expect(body).toHaveProperty('output_schema', {});
    expect(body.source_revision).toBe('release-one');
    const historical = publicationBodyFromDetail({
      ...detail,
      definition: { ...detail.definition, output_schema: undefined },
    });
    expect(historical).not.toHaveProperty('output_schema');
  });

  it('shows absent and explicitly declared output interfaces as distinct before/after values', () => {
    const comparison = {
      before: { module_inputs: {}, module_params: {}, provider_mapping: {}, dependencies: {} },
      after: {
        module_inputs: {},
        module_params: {},
        provider_mapping: {},
        dependencies: {},
        output_schema: {},
      },
      output_schema_changed: true,
    } as ModuleVersionComparison;
    expect(moduleVersionComparisonDetails(comparison)).toEqual([
      {
        path: 'Declared output interface',
        before: undefined,
        after: {},
        beforePresent: false,
        afterPresent: true,
      },
    ]);
    render(<ComparisonList comparison={comparison} />);
    expect(screen.getByText('Not present')).toBeVisible();
    expect(screen.getByText('{}')).toBeVisible();
  });

  it('renders empty and legacy null difference arrays as no changes', () => {
    expect(formatComparisonItems([])).toBe('None');
    expect(formatComparisonItems(null)).toBe('None');
  });

  it('renders changed keys in API order', () => {
    expect(formatComparisonItems(['image', 'replicas'])).toBe('image, replicas');
  });

  it('builds concrete before and after rows for changed, added and removed values', () => {
    const comparison = {
      from_version_uuid: '00000000-0000-0000-0000-000000000001',
      to_version_uuid: '00000000-0000-0000-0000-000000000002',
      before: {
        module_source: 'inline',
        module_source_code: 'before',
        artifact_digest: '',
        source_revision: 'revision-one',
        resource_type: 'workload',
        module_inputs: { annotations: { team: 'platform' }, removed: true },
        module_params: {},
        provider_mapping: {},
        dependencies: {},
        coprovisioned: [],
      },
      after: {
        module_source: 'inline',
        module_source_code: 'after',
        artifact_digest: '',
        source_revision: 'revision-two',
        resource_type: 'workload',
        module_inputs: { annotations: { team: 'retail' }, added: 3 },
        module_params: {},
        provider_mapping: {},
        dependencies: {},
        coprovisioned: [],
      },
      module_source_changed: false,
      module_source_code_changed: true,
      artifact_digest_changed: false,
      source_revision_changed: true,
      resource_type_changed: false,
      added_module_inputs: ['added'],
      removed_module_inputs: ['removed'],
      changed_module_inputs: ['annotations'],
      added_module_params: [],
      removed_module_params: [],
      changed_module_params: [],
      added_provider_mappings: [],
      removed_provider_mappings: [],
      changed_provider_mappings: [],
      added_dependencies: [],
      removed_dependencies: [],
      changed_dependencies: [],
      coprovisioning_changed: false,
      output_schema_changed: false,
    } as ModuleVersionComparison;

    expect(moduleVersionComparisonDetails(comparison)).toEqual([
      expect.objectContaining({ path: 'Inline source', before: 'before', after: 'after' }),
      expect.objectContaining({
        path: 'Source revision',
        before: 'revision-one',
        after: 'revision-two',
      }),
      expect.objectContaining({
        path: 'Module inputs / added',
        beforePresent: false,
        after: 3,
      }),
      expect.objectContaining({
        path: 'Module inputs / removed',
        before: true,
        afterPresent: false,
      }),
      expect.objectContaining({
        path: 'Module inputs / annotations',
        before: { team: 'platform' },
        after: { team: 'retail' },
      }),
    ]);

    render(<ComparisonList comparison={comparison} />);
    expect(screen.getByText('Detailed diff')).toBeVisible();
    expect(screen.getByText('Module inputs / annotations')).toBeVisible();
    expect(screen.getByText(/"team": "platform"/)).toBeVisible();
    expect(screen.getByText(/"team": "retail"/)).toBeVisible();
  });

  it('formats structured and absent values for diff display', () => {
    expect(formatComparisonValue({ team: 'retail' })).toBe('{\n  "team": "retail"\n}');
    expect(formatComparisonValue(undefined, false)).toBe('Not present');
    expect(formatComparisonValue('')).toBe('None');
  });
});
