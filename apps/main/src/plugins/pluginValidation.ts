import {
  type PluginBridgeRequestMessage,
  type PluginBridgeSession,
  type PluginContextualActionDescriptor,
  type PluginDescriptor,
  type PluginInvocationRequest,
  type PluginOperationRequestMessage,
  type PluginReadyMessage,
  type PluginUiDescriptor,
  pluginUiSdkVersion,
} from './types';

const pluginIdPattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/;
const operationIdPattern = /^[A-Za-z][A-Za-z0-9._-]*$/;
const routePrefixPattern = /^[a-z0-9](?:[a-z0-9/-]*[a-z0-9])?$/;
const contextualQueryKeyPattern = /^[a-z][a-z0-9_]{0,62}$/;
const moduleVersionContextValues = new Set(['$module_id', '$semantic_version', '$version_uuid']);
const moduleVersionLifecycleStatuses = new Set(['proposed', 'default', 'deprecated', 'defective']);
const reservedHostOperation = (operationId: string) =>
  operationId.startsWith('core.') || operationId.startsWith('iam.');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === 'string');

const isStringArrayRecord = (value: unknown): value is Record<string, string[]> =>
  isRecord(value) &&
  Object.values(value).every(
    (item) => Array.isArray(item) && item.every((entry) => typeof entry === 'string'),
  );

const isOperationDescriptor = (value: unknown) =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  operationIdPattern.test(value.id) &&
  ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(value.method)) &&
  typeof value.mutating === 'boolean';

const isEntitlementProjection = (value: unknown) => {
  if (!isRecord(value) || !isRecord(value.features)) return false;
  const features = Object.entries(value.features);
  return (
    features.length <= 64 &&
    features.every(
      ([feature, access]) =>
        /^[a-z][a-z0-9-]{0,62}$/.test(feature) &&
        isRecord(access) &&
        typeof access.state === 'string' &&
        ['', 'development', 'production'].includes(String(access.trust_class)) &&
        typeof access.forward === 'boolean' &&
        typeof access.read === 'boolean' &&
        typeof access.safety === 'boolean' &&
        [access.expires_at, access.grace_until].every(
          (date) =>
            date === undefined || (typeof date === 'string' && Number.isFinite(Date.parse(date))),
        ),
    )
  );
};

export const isPluginContextualActionDescriptor = (
  value: unknown,
  pluginOperationIds: ReadonlySet<string>,
): value is PluginContextualActionDescriptor => {
  if (
    !isRecord(value) ||
    value.resource_type !== 'module_version' ||
    typeof value.id !== 'string' ||
    !operationIdPattern.test(value.id) ||
    typeof value.label !== 'string' ||
    value.label.trim().length === 0 ||
    value.label.length > 100 ||
    typeof value.required_operation_id !== 'string' ||
    !pluginOperationIds.has(value.required_operation_id) ||
    !isRecord(value.route) ||
    typeof value.route.path !== 'string' ||
    normalizePluginRoutePrefix(value.route.path) !== value.route.path ||
    !isValidPluginRoutePrefix(value.route.path) ||
    !isRecord(value.when) ||
    !Array.isArray(value.when.lifecycle_status) ||
    value.when.lifecycle_status.length === 0 ||
    !value.when.lifecycle_status.every(
      (status) => typeof status === 'string' && moduleVersionLifecycleStatuses.has(status),
    ) ||
    new Set(value.when.lifecycle_status).size !== value.when.lifecycle_status.length ||
    typeof value.when.semantic_version_required !== 'boolean' ||
    (value.primary !== undefined && typeof value.primary !== 'boolean')
  ) {
    return false;
  }
  if (value.route.query === undefined) return true;
  if (!isRecord(value.route.query)) return false;
  return Object.entries(value.route.query).every(
    ([key, contextValue]) =>
      contextualQueryKeyPattern.test(key) &&
      typeof contextValue === 'string' &&
      moduleVersionContextValues.has(contextValue),
  );
};

export const bridgeOperationDescriptors = (plugin: PluginDescriptor) => [
  ...plugin.operations,
  ...(plugin.ui?.core_operations ?? []),
];

export const normalizePluginRoutePrefix = (routePrefix: string) =>
  routePrefix.replace(/^\/+|\/+$/g, '');

export const isValidPluginRoutePrefix = (routePrefix: string) => {
  const normalized = normalizePluginRoutePrefix(routePrefix);
  return normalized.length > 0 && routePrefixPattern.test(normalized) && !normalized.includes('//');
};

export const validatePluginFrameUrl = (
  ui: PluginUiDescriptor,
  hostOrigin: string,
  allowInsecureLocalhost = false,
) => {
  if (ui.sdk_version !== pluginUiSdkVersion || !isValidPluginRoutePrefix(ui.route_prefix)) {
    throw new Error('The plugin UI descriptor is incompatible.');
  }

  const declaredOrigin = new URL(ui.origin);
  if (declaredOrigin.origin !== ui.origin || declaredOrigin.username || declaredOrigin.password) {
    throw new Error(
      'The plugin UI origin must be a canonical origin without credentials or a path.',
    );
  }
  const consoleOrigin = new URL(hostOrigin);
  if (declaredOrigin.hostname === consoleOrigin.hostname) {
    throw new Error('Plugin UI pages must use a different hostname from the Console.');
  }
  const insecureLocalhost =
    allowInsecureLocalhost &&
    declaredOrigin.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(declaredOrigin.hostname);
  if (declaredOrigin.protocol !== 'https:' && !insecureLocalhost) {
    throw new Error('Plugin UI origins must use HTTPS.');
  }

  const frameUrl = new URL(ui.entrypoint, `${declaredOrigin.origin}/`);
  if (
    frameUrl.origin !== declaredOrigin.origin ||
    frameUrl.username ||
    frameUrl.password ||
    frameUrl.hash
  ) {
    throw new Error('The plugin UI entrypoint must stay on its registered origin.');
  }
  return frameUrl;
};

export const isPluginDescriptor = (value: unknown): value is PluginDescriptor => {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== 'string' ||
    !pluginIdPattern.test(value.id) ||
    typeof value.display_name !== 'string' ||
    ![
      'available',
      'not_installed',
      'not_enabled',
      'not_entitled',
      'incompatible',
      'unavailable',
    ].includes(String(value.state)) ||
    !['full', 'read_only', 'safety_only', 'hidden'].includes(String(value.mode)) ||
    !Array.isArray(value.operations) ||
    (value.entitlement !== undefined && !isEntitlementProjection(value.entitlement))
  ) {
    return false;
  }
  if (value.mode !== 'hidden') {
    const ui = value.ui;
    if (
      !isRecord(ui) ||
      ui.sdk_version !== pluginUiSdkVersion ||
      typeof ui.origin !== 'string' ||
      typeof ui.entrypoint !== 'string' ||
      typeof ui.route_prefix !== 'string' ||
      typeof ui.navigation_label !== 'string' ||
      (ui.core_operations !== undefined && !Array.isArray(ui.core_operations)) ||
      (ui.contextual_actions !== undefined && !Array.isArray(ui.contextual_actions))
    ) {
      return false;
    }
  }
  if (
    !value.operations.every(
      (operation) => isOperationDescriptor(operation) && !reservedHostOperation(operation.id),
    )
  ) {
    return false;
  }
  const coreOperations = isRecord(value.ui) ? (value.ui.core_operations ?? []) : [];
  if (
    !Array.isArray(coreOperations) ||
    !coreOperations.every(
      (operation) => isOperationDescriptor(operation) && reservedHostOperation(operation.id),
    )
  ) {
    return false;
  }
  const operationIds = [...value.operations, ...coreOperations].map(({ id }) => id);
  if (new Set(operationIds).size !== operationIds.length) return false;
  const pluginOperationIds = new Set(value.operations.map(({ id }) => id));
  const contextualActions = isRecord(value.ui) ? (value.ui.contextual_actions ?? []) : [];
  return (
    Array.isArray(contextualActions) &&
    contextualActions.every((action) =>
      isPluginContextualActionDescriptor(action, pluginOperationIds),
    ) &&
    new Set(contextualActions.map(({ id }) => id)).size === contextualActions.length
  );
};

export const findPluginForOrgPath = (plugins: PluginDescriptor[], orgPath: string) => {
  const normalizedPath = orgPath.replace(/^\/+|\/+$/g, '');
  return plugins
    .filter(({ mode, ui }) => mode !== 'hidden' && ui)
    .filter(({ ui }) => {
      const prefix = normalizePluginRoutePrefix(ui!.route_prefix);
      return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`);
    })
    .sort(
      (left, right) =>
        normalizePluginRoutePrefix(right.ui!.route_prefix).length -
        normalizePluginRoutePrefix(left.ui!.route_prefix).length,
    )[0];
};

export const isExpectedPluginReadyEvent = (
  event: Pick<MessageEvent, 'source' | 'origin' | 'data'>,
  expectedSource: Window,
  expectedOrigin: string,
  expectedNonce: string,
): event is MessageEvent<PluginReadyMessage> => {
  if (event.source !== expectedSource || event.origin !== expectedOrigin || !isRecord(event.data)) {
    return false;
  }
  return (
    event.data.type === 'stellwerk.plugin.ready' &&
    event.data.sdk_version === pluginUiSdkVersion &&
    event.data.nonce === expectedNonce
  );
};

type ValidationResult =
  | { ok: true; message: PluginBridgeRequestMessage; invocation?: PluginInvocationRequest }
  | { ok: false; requestId?: string; error: string };

const immutableJsonValue = (value: unknown) => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as unknown;
};

export const validatePluginBridgeRequest = (
  value: unknown,
  session: PluginBridgeSession,
): ValidationResult => {
  if (!isRecord(value)) return { ok: false, error: 'Malformed plugin bridge message.' };
  const requestId = typeof value.request_id === 'string' ? value.request_id : undefined;
  if (value.sdk_version !== pluginUiSdkVersion || value.nonce !== session.nonce) {
    return { ok: false, requestId, error: 'Stale or incompatible plugin bridge session.' };
  }

  if (
    value.type === 'stellwerk.plugin.navigate' ||
    value.type === 'stellwerk.plugin.navigate-core'
  ) {
    if (
      typeof value.route !== 'string' ||
      !value.route.startsWith('/') ||
      value.route.startsWith('//')
    ) {
      return { ok: false, error: 'Plugin navigation must use an absolute same-origin route.' };
    }
    return { ok: true, message: value as unknown as PluginBridgeRequestMessage };
  }

  if (value.type !== 'stellwerk.plugin.operation.request') {
    return { ok: false, requestId, error: 'Unknown plugin bridge message.' };
  }
  if (
    typeof value.request_id !== 'string' ||
    value.request_id.length === 0 ||
    value.org_id !== session.orgId ||
    typeof value.operation_id !== 'string'
  ) {
    return { ok: false, requestId, error: 'Malformed or cross-organization operation request.' };
  }

  const operation = bridgeOperationDescriptors(session.plugin).find(
    ({ id }) => id === value.operation_id,
  );
  if (!operation) {
    return { ok: false, requestId, error: 'The requested operation is not registered.' };
  }
  if (value.path_parameters !== undefined && !isStringRecord(value.path_parameters)) {
    return { ok: false, requestId, error: 'Operation path parameters must be strings.' };
  }
  if (value.query !== undefined && !isStringArrayRecord(value.query)) {
    return { ok: false, requestId, error: 'Operation query parameters must be string arrays.' };
  }
  if (
    operation.mutating &&
    (typeof value.idempotency_key !== 'string' || value.idempotency_key.length === 0)
  ) {
    return { ok: false, requestId, error: 'Mutating operations require an Idempotency Key.' };
  }

  let body: unknown;
  try {
    body = immutableJsonValue(value.body);
  } catch {
    return { ok: false, requestId, error: 'Operation bodies must be JSON serializable.' };
  }
  const message = value as unknown as PluginOperationRequestMessage;
  return {
    ok: true,
    message,
    invocation: {
      operation_id: message.operation_id,
      path_parameters: message.path_parameters,
      query: message.query,
      body,
      idempotency_key: message.idempotency_key,
    },
  };
};

export const pluginHostRoute = (orgId: string, routePrefix: string, childRoute = '/') => {
  const prefix = normalizePluginRoutePrefix(routePrefix);
  const route = new URL(childRoute, 'https://plugin.invalid');
  const suffix = route.pathname === '/' ? '' : route.pathname;
  return `/orgs/${encodeURIComponent(orgId)}/${prefix}${suffix}${route.search}`;
};

export const coreOrgRoute = (orgId: string, childRoute: string) => {
  const route = new URL(childRoute, 'https://console.invalid');
  const suffix = route.pathname === '/' ? '' : route.pathname;
  return `/orgs/${encodeURIComponent(orgId)}${suffix}${route.search}${route.hash}`;
};
