import { customInstance } from '@src/custom-instance';
import { listEnvironmentsInOrg } from '@src/hooks/react-query/v2/controlplane/environment/environment';
import {
  getEnvironmentModuleVersionPin,
  getModuleVersionUsage,
  listEnvironmentModuleVersionPinEvents,
  listModules,
  transitionEnvironmentModuleVersionPin,
} from '@src/hooks/react-query/v2/controlplane/modules/modules';
import { listProjects } from '@src/hooks/react-query/v2/controlplane/project/project';
import { checkPermissions } from '@src/hooks/react-query/v2/iam/user/user';
import type { ModuleReasonedCommand } from '@src/models/v2/controlplane';
import type { ResourcePermissionCheck } from '@src/models/v2/iam';

import { invokePluginOperation } from './pluginInvocation';
import type {
  PluginInvocationRequest,
  PluginInvocationResponse,
  PluginOperationDescriptor,
} from './types';

interface HostOperationDefinition {
  method: PluginOperationDescriptor['method'];
  mutating: boolean;
  invoke: (
    orgId: string,
    pluginId: string,
    request: PluginInvocationRequest,
    effects?: HostOperationEffects,
  ) => Promise<unknown>;
}

export interface PluginDeploymentMaterial {
  kind: 'logs' | 'outputs';
  deploymentId: string;
  content: string;
}

export interface HostOperationEffects {
  presentPluginDeploymentMaterial: (material: PluginDeploymentMaterial) => void;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pluginIdPattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/;
const pluginPermissionSuffixPattern = /^[a-z](?:[a-z0-9-]*[a-z0-9])?$/;
const maximumPermissionLength = 255;
const allowedCorePermissions = new Set(['module.version.unpin']);
const membershipCache = new Map<
  string,
  { expiresAt: number; value: Promise<{ environments: Set<string>; projects: Set<string> }> }
>();
const membershipCacheMilliseconds = 30_000;
const maximumMembershipPages = 100;
const maximumMembershipResources = 10_000;
const maximumDeploymentMaterialBytes = 16 * 1024 * 1024;

const assertNoValues = (
  request: PluginInvocationRequest,
  fields: ('path_parameters' | 'query' | 'body' | 'idempotency_key')[],
) => {
  for (const field of fields) {
    if (request[field] !== undefined) throw new Error(`Host operation does not accept ${field}.`);
  }
};

const singleQueryValues = (
  query: Record<string, string[]> | undefined,
  allowedKeys: readonly string[],
) => {
  const result: Record<string, string> = {};
  for (const [key, values] of Object.entries(query ?? {})) {
    if (!allowedKeys.includes(key) || values.length !== 1 || values[0] === '') {
      throw new Error('Host operation contains an unsupported query value.');
    }
    result[key] = values[0]!;
  }
  return result;
};

const pagination = (query: Record<string, string[]> | undefined) => {
  const values = singleQueryValues(query, ['per_page', 'page']);
  const perPage = values.per_page === undefined ? undefined : Number(values.per_page);
  if (perPage !== undefined && (!Number.isInteger(perPage) || perPage < 1 || perPage > 100)) {
    throw new Error('Host operation per_page must be an integer from 1 through 100.');
  }
  return { per_page: perPage, page: values.page };
};

const exactPathParameter = (request: PluginInvocationRequest, name: string) => {
  const entries = Object.entries(request.path_parameters ?? {});
  if (entries.length !== 1 || entries[0]?.[0] !== name || !uuidPattern.test(entries[0][1])) {
    throw new Error(`Host operation requires one UUID ${name} path parameter.`);
  }
  return entries[0][1];
};

const organizationMembership = (orgId: string) => {
  const cached = membershipCache.get(orgId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = (async () => {
    const projects = new Set<string>();
    const environments = new Set<string>();
    let projectPage: string | undefined;
    let environmentPage: string | undefined;
    let pages = 0;
    do {
      if (pages++ >= maximumMembershipPages) {
        throw new Error('Core organization membership exceeds the host verification bound.');
      }
      const response = await listProjects(orgId, { per_page: 100, page: projectPage });
      response.items.forEach(({ uuid }) => projects.add(uuid));
      if (projects.size + environments.size > maximumMembershipResources) {
        throw new Error('Core organization membership exceeds the host verification bound.');
      }
      projectPage = response.next_page_token;
    } while (projectPage);
    pages = 0;
    do {
      if (pages++ >= maximumMembershipPages) {
        throw new Error('Core organization membership exceeds the host verification bound.');
      }
      const response = await listEnvironmentsInOrg(orgId, {
        per_page: 100,
        page: environmentPage,
      });
      response.items.forEach(({ uuid }) => environments.add(uuid));
      if (projects.size + environments.size > maximumMembershipResources) {
        throw new Error('Core organization membership exceeds the host verification bound.');
      }
      environmentPage = response.next_page_token;
    } while (environmentPage);
    return { environments, projects };
  })().catch((error: unknown) => {
    membershipCache.delete(orgId);
    throw error;
  });
  membershipCache.set(orgId, { expiresAt: Date.now() + membershipCacheMilliseconds, value });
  return value;
};

const permissionChecks = async (
  orgId: string,
  pluginId: string,
  body: unknown,
): Promise<ResourcePermissionCheck[]> => {
  if (!Array.isArray(body) || body.length === 0 || body.length > 5000) {
    throw new Error('IAM permission checks require a bounded non-empty array.');
  }
  const checks = body.map((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('IAM permission checks must be objects.');
    }
    const entries = Object.keys(value);
    const resource = Reflect.get(value, 'resource') as unknown;
    const permission = Reflect.get(value, 'permission') as unknown;
    const pluginPermissionPrefix = `plugin.${pluginId}.`;
    const pluginPermissionSuffix =
      typeof permission === 'string' && permission.startsWith(pluginPermissionPrefix)
        ? permission.slice(pluginPermissionPrefix.length)
        : '';
    const allowedPermission =
      typeof permission === 'string' &&
      (allowedCorePermissions.has(permission) ||
        (permission.length <= maximumPermissionLength &&
          pluginIdPattern.test(pluginId) &&
          pluginPermissionSuffixPattern.test(pluginPermissionSuffix)));
    const scopedResource =
      resource === `organization:${orgId}` ||
      (typeof resource === 'string' &&
        (resource.startsWith('env:') || resource.startsWith('project:')) &&
        uuidPattern.test(resource.slice(resource.indexOf(':') + 1)));
    if (
      entries.length !== 2 ||
      !entries.includes('resource') ||
      !entries.includes('permission') ||
      !scopedResource ||
      !allowedPermission
    ) {
      throw new Error('IAM permission check is outside the plugin namespace or Core allowlist.');
    }
    return { resource: resource as string, permission };
  });
  const scopedChecks = checks.filter(({ resource }) => !resource.startsWith('organization:'));
  if (scopedChecks.length === 0) return checks;
  const membership = await organizationMembership(orgId);
  for (const { resource } of scopedChecks) {
    const separator = resource.indexOf(':');
    const kind = resource.slice(0, separator);
    const uuid = resource.slice(separator + 1);
    const member =
      kind === 'env' ? membership.environments.has(uuid) : membership.projects.has(uuid);
    if (!member) throw new Error('IAM resource is not a member of the active organization.');
  }
  return checks;
};

const reasonedCommand = (body: unknown): ModuleReasonedCommand => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Pin discard requires a reasoned command body.');
  }
  const entries = Object.keys(body);
  const reason = Reflect.get(body, 'reason') as unknown;
  const expectedResourceVersion = Reflect.get(body, 'expected_resource_version') as unknown;
  if (
    entries.length !== 2 ||
    !entries.includes('reason') ||
    !entries.includes('expected_resource_version') ||
    typeof reason !== 'string' ||
    reason.trim().length === 0 ||
    reason.length > 2000 ||
    typeof expectedResourceVersion !== 'number' ||
    !Number.isInteger(expectedResourceVersion) ||
    expectedResourceVersion < 1
  ) {
    throw new Error('Pin discard reasoned command is malformed.');
  }
  return { reason, expected_resource_version: expectedResourceVersion };
};

const materialPath = (request: PluginInvocationRequest) => {
  assertNoValues(request, ['query', 'body', 'idempotency_key']);
  const values = request.path_parameters ?? {};
  const names = Object.keys(values).sort();
  if (
    names.length !== 3 ||
    names[0] !== 'deploymentId' ||
    names[1] !== 'environmentUuid' ||
    names[2] !== 'projectUuid' ||
    !uuidPattern.test(values.projectUuid ?? '') ||
    !uuidPattern.test(values.environmentUuid ?? '') ||
    !uuidPattern.test(values.deploymentId ?? '')
  ) {
    throw new Error(
      'Deployment material requires exact project, Environment, and Deployment UUIDs.',
    );
  }
  return {
    projectUuid: values.projectUuid!,
    environmentUuid: values.environmentUuid!,
    deploymentId: values.deploymentId!,
  };
};

const pluginDeploymentMaterial =
  (kind: PluginDeploymentMaterial['kind']) =>
  async (
    orgId: string,
    pluginId: string,
    request: PluginInvocationRequest,
    effects?: HostOperationEffects,
  ) => {
    if (!effects) throw new Error('The host material presenter is unavailable.');
    const { projectUuid, environmentUuid, deploymentId } = materialPath(request);
    let content: string;
    try {
      content = await customInstance<string>({
        url: `/orgs/${encodeURIComponent(orgId)}/plugins/${encodeURIComponent(pluginId)}/projects/${projectUuid}/envs/${environmentUuid}/deployments/${deploymentId}/${kind}`,
        method: 'GET',
        responseType: 'text',
      });
    } catch {
      throw new Error(`Deployment ${kind} are unavailable or access was denied.`);
    }
    if (typeof content !== 'string') {
      throw new Error('Core returned malformed Deployment material.');
    }
    if (new TextEncoder().encode(content).byteLength > maximumDeploymentMaterialBytes) {
      throw new Error('Core returned oversized Deployment material.');
    }
    effects.presentPluginDeploymentMaterial({ kind, deploymentId, content });
    return null;
  };

const hostOperations: Record<string, HostOperationDefinition> = {
  'core.listProjects': {
    method: 'GET',
    mutating: false,
    invoke: (orgId, _pluginId, request) => {
      assertNoValues(request, ['path_parameters', 'body', 'idempotency_key']);
      return listProjects(orgId, pagination(request.query));
    },
  },
  'core.listModules': {
    method: 'GET',
    mutating: false,
    invoke: (orgId, _pluginId, request) => {
      assertNoValues(request, ['path_parameters', 'body', 'idempotency_key']);
      return listModules(orgId, pagination(request.query));
    },
  },
  'core.listProposedModuleVersions': {
    method: 'GET',
    mutating: false,
    invoke: (orgId, _pluginId, request) => {
      assertNoValues(request, ['path_parameters', 'query', 'body', 'idempotency_key']);
      return customInstance<unknown>({
        url: `/orgs/${encodeURIComponent(orgId)}/module-versions/proposed`,
        method: 'GET',
      });
    },
  },
  'core.getModuleVersionUsage': {
    method: 'GET',
    mutating: false,
    invoke: (orgId, _pluginId, request) => {
      assertNoValues(request, ['query', 'body', 'idempotency_key']);
      const values = request.path_parameters ?? {};
      const names = Object.keys(values).sort();
      const identifier = /^[a-zA-Z0-9][a-zA-Z0-9.+_-]{0,254}$/;
      if (
        names.length !== 2 ||
        names[0] !== 'moduleId' ||
        names[1] !== 'moduleVersionId' ||
        !identifier.test(values.moduleId ?? '') ||
        !identifier.test(values.moduleVersionId ?? '')
      ) {
        throw new Error('Module usage requires exactly one Module and Version identifier.');
      }
      return getModuleVersionUsage(
        encodeURIComponent(orgId),
        encodeURIComponent(values.moduleId!),
        encodeURIComponent(values.moduleVersionId!),
      );
    },
  },
  'iam.checkPermissions': {
    method: 'POST',
    mutating: false,
    invoke: async (orgId, pluginId, request) => {
      assertNoValues(request, ['path_parameters', 'query', 'idempotency_key']);
      return checkPermissions(await permissionChecks(orgId, pluginId, request.body));
    },
  },
  'core.getEnvironmentModuleVersionPin': {
    method: 'GET',
    mutating: false,
    invoke: (orgId, _pluginId, request) => {
      assertNoValues(request, ['query', 'body', 'idempotency_key']);
      return getEnvironmentModuleVersionPin(orgId, exactPathParameter(request, 'pinId'));
    },
  },
  'core.listEnvironmentModuleVersionPinEvents': {
    method: 'GET',
    mutating: false,
    invoke: (orgId, _pluginId, request) => {
      assertNoValues(request, ['query', 'body', 'idempotency_key']);
      return listEnvironmentModuleVersionPinEvents(orgId, exactPathParameter(request, 'pinId'));
    },
  },
  'core.discardEnvironmentModuleVersionPin': {
    method: 'POST',
    mutating: true,
    invoke: (orgId, _pluginId, request) => {
      assertNoValues(request, ['query']);
      if (!request.idempotency_key) throw new Error('Pin discard requires idempotency.');
      return transitionEnvironmentModuleVersionPin(
        orgId,
        exactPathParameter(request, 'pinId'),
        'discard',
        reasonedCommand(request.body),
        { headers: { 'Idempotency-Key': request.idempotency_key } },
      );
    },
  },
  'core.getPluginDeploymentLogs': {
    method: 'GET',
    mutating: false,
    invoke: pluginDeploymentMaterial('logs'),
  },
  'core.getPluginDeploymentOutputs': {
    method: 'GET',
    mutating: false,
    invoke: pluginDeploymentMaterial('outputs'),
  },
};

const reservedHostOperation = (operationId: string) =>
  operationId.startsWith('core.') || operationId.startsWith('iam.');

export const invokeBridgeOperation = async (
  orgId: string,
  pluginId: string,
  descriptor: PluginOperationDescriptor,
  request: PluginInvocationRequest,
  effects?: HostOperationEffects,
): Promise<PluginInvocationResponse> => {
  const hostOperation = hostOperations[request.operation_id];
  if (!hostOperation) {
    if (reservedHostOperation(request.operation_id)) {
      throw new Error('The requested host operation is not allowlisted.');
    }
    return invokePluginOperation(orgId, pluginId, request);
  }
  if (!pluginIdPattern.test(pluginId) || descriptor.id !== request.operation_id) {
    throw new Error('The host operation is not registered for this plugin.');
  }
  if (
    descriptor.method !== hostOperation.method ||
    descriptor.mutating !== hostOperation.mutating
  ) {
    throw new Error('The advertised host operation descriptor is incompatible.');
  }
  const body = await hostOperation.invoke(orgId, pluginId, request, effects);
  return body === null ? { status: 204, body: null } : { status: 200, body };
};
