export const pluginUiSdkVersion = '1' as const;

export type PluginAvailabilityState =
  | 'available'
  | 'not_installed'
  | 'not_enabled'
  | 'not_entitled'
  | 'incompatible'
  | 'unavailable';

export type PluginUiMode = 'full' | 'read_only' | 'safety_only' | 'hidden';

export interface PluginUiDescriptor {
  sdk_version: typeof pluginUiSdkVersion;
  origin: string;
  entrypoint: string;
  route_prefix: string;
  navigation_label: string;
  core_operations?: PluginOperationDescriptor[];
}

export interface PluginOperationDescriptor {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  mutating: boolean;
}

export interface PluginDescriptor {
  id: string;
  display_name: string;
  version?: string;
  state: PluginAvailabilityState;
  mode: PluginUiMode;
  ui?: PluginUiDescriptor;
  operations: PluginOperationDescriptor[];
}

export interface PluginDiscoveryResponse {
  items: PluginDescriptor[];
}

export interface PluginInvocationRequest {
  operation_id: string;
  path_parameters?: Record<string, string>;
  query?: Record<string, string[]>;
  body?: unknown;
  idempotency_key?: string;
}

export interface PluginInvocationResponse {
  status: number;
  body: unknown;
}

export interface PluginBridgeSession {
  nonce: string;
  orgId: string;
  plugin: PluginDescriptor;
}

export interface PluginReadyMessage {
  type: 'stellwerk.plugin.ready';
  sdk_version: typeof pluginUiSdkVersion;
  nonce: string;
}

export interface PluginOperationRequestMessage {
  type: 'stellwerk.plugin.operation.request';
  sdk_version: typeof pluginUiSdkVersion;
  nonce: string;
  request_id: string;
  org_id: string;
  operation_id: string;
  path_parameters?: Record<string, string>;
  query?: Record<string, string[]>;
  body?: unknown;
  idempotency_key?: string;
}

export interface PluginNavigateMessage {
  type: 'stellwerk.plugin.navigate';
  sdk_version: typeof pluginUiSdkVersion;
  nonce: string;
  route: string;
}

export interface PluginNavigateCoreMessage {
  type: 'stellwerk.plugin.navigate-core';
  sdk_version: typeof pluginUiSdkVersion;
  nonce: string;
  route: string;
}

export type PluginBridgeRequestMessage =
  | PluginOperationRequestMessage
  | PluginNavigateMessage
  | PluginNavigateCoreMessage;
