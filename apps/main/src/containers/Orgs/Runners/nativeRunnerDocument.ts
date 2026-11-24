import { JSON_SCHEMA, load } from 'js-yaml';
import { isEqual } from 'lodash';

import type {
  NativeAgentRunnerConfigurationUpdateBody,
  Runner,
  RunnerUpdateBody,
} from '@src/models/v2/controlplane';

export type NativeRunnerDocument = Omit<RunnerUpdateBody, 'runner_configuration'> & {
  runner_configuration?: NativeAgentRunnerConfigurationUpdateBody;
};
export type RunnerSourceFormat = 'json' | 'yaml';
const nativeFields = [
  'type',
  'key',
  'max_parallel_jobs',
  'supported_protocols',
  'capabilities',
  'native_execution',
] as const;
const stateFields: Record<string, string[]> = {
  kubernetes: ['type', 'namespace'],
  s3: ['type', 'bucket', 'path_prefix'],
  gcs: ['type', 'bucket', 'path_prefix'],
  azurerm: ['type', 'container_name', 'storage_account_name', 'resource_group_name', 'path_prefix'],
};
const privateKey = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
export const MAX_RUNNER_SOURCE_BYTES = 1024 * 1024;

const pick = (value: object, fields: readonly string[]) =>
  Object.fromEntries(
    Object.entries(value).filter(([key, child]) => fields.includes(key) && child !== undefined),
  );

export const nativeRunnerDocument = (runner: Runner): NativeRunnerDocument => {
  if (runner.runner_configuration.type !== 'native-agent')
    throw new Error('This is not a native Runner.');
  return structuredClone({
    ...(runner.description === undefined ? {} : { description: runner.description }),
    runner_configuration: pick(runner.runner_configuration, nativeFields),
    state_storage_configuration: pick(
      runner.state_storage_configuration,
      stateFields[runner.state_storage_configuration.type] ?? [],
    ),
  }) as NativeRunnerDocument;
};

export const parseRunnerSource = (source: string, format: RunnerSourceFormat): unknown => {
  if (
    source.length > MAX_RUNNER_SOURCE_BYTES ||
    new TextEncoder().encode(source).length > MAX_RUNNER_SOURCE_BYTES
  )
    throw new Error('The public configuration exceeds 1 MiB.');
  let value: unknown;
  try {
    value = format === 'json' ? JSON.parse(source) : load(source, { schema: JSON_SCHEMA });
  } catch {
    throw new Error('Enter a valid JSON or YAML public configuration.');
  }
  const seen = new WeakSet<object>();
  let nodes = 0;
  const visit = (child: unknown, depth: number): void => {
    nodes += 1;
    if (depth > 16 || nodes > 10000) throw new Error('The public configuration is too complex.');
    if (typeof child === 'string' && privateKey.test(child))
      throw new Error('Import only public configuration. Private keys are not accepted.');
    if (child === null || ['string', 'boolean'].includes(typeof child)) return;
    if (typeof child === 'number' && Number.isFinite(child)) return;
    if (typeof child !== 'object' || seen.has(child))
      throw new Error('Use JSON-compatible values without YAML aliases.');
    seen.add(child);
    Object.values(child).forEach((entry) => visit(entry, depth + 1));
  };
  visit(value, 0);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Enter a public configuration object.');
  return value;
};

// Public `runner rollout catalogue` exports only these 3 fields. Never extract them from a private runtime file.
export const parseRunnerInventory = (source: string, format: RunnerSourceFormat) => {
  const value = parseRunnerSource(source, format) as Record<string, unknown>;
  const fields = ['native_execution', 'capabilities', 'supported_protocols'];
  if (
    Object.keys(value).length !== fields.length ||
    fields.some((field) => !Object.prototype.hasOwnProperty.call(value, field))
  )
    throw new Error(
      'Import the public catalogue export containing only inventory, capabilities and supported protocols.',
    );
  return value;
};

const sameField = (key: string, left: unknown, right: unknown) => {
  if (
    ['capabilities', 'supported_protocols', 'native_execution'].includes(key) &&
    left == null &&
    right == null
  )
    return true;
  if (
    (key === 'capabilities' || key === 'supported_protocols') &&
    Array.isArray(left) &&
    Array.isArray(right)
  )
    return isEqual([...left].sort(), [...right].sort());
  return isEqual(left, right);
};
const changedFields = (base: object, desired: object) =>
  Object.fromEntries(
    Object.entries(desired).filter(
      ([key, value]) =>
        value !== undefined && !sameField(key, (base as Record<string, unknown>)[key], value),
    ),
  );

export const nativeRunnerPatch = (
  base: Runner,
  desired: NativeRunnerDocument,
): RunnerUpdateBody => {
  const previous = nativeRunnerDocument(base);
  const patch = changedFields(previous, desired) as RunnerUpdateBody;
  if (desired.runner_configuration) {
    const changes = changedFields(
      previous.runner_configuration ?? {},
      desired.runner_configuration,
    );
    if (Object.keys(changes).length)
      patch.runner_configuration = { type: 'native-agent', ...changes };
    else delete patch.runner_configuration;
  }
  return patch;
};

export const nativeRunnerIdentityMatches = (base: Runner, actual: Runner) =>
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(base.uuid) &&
  base.uuid !== '00000000-0000-0000-0000-000000000000' &&
  actual.uuid === base.uuid &&
  actual.id === base.id &&
  actual.org_id === base.org_id &&
  actual.runner_configuration.type === 'native-agent';

export const nativeRunnerResponseMatches = (
  base: Runner,
  patch: RunnerUpdateBody,
  actual: Runner,
) => {
  if (!nativeRunnerIdentityMatches(base, actual)) return false;
  const expected = nativeRunnerDocument(base);
  const configuration = { ...expected.runner_configuration, ...patch.runner_configuration };
  // Core READ omits explicitly cleared optional metadata.
  Object.entries(configuration).forEach(([key, value]) => {
    if (value === null) delete configuration[key as keyof typeof configuration];
  });
  const wanted = { ...expected, ...patch, runner_configuration: configuration };
  const actualDocument = nativeRunnerDocument(actual);
  const publicConfiguration = actualDocument.runner_configuration ?? {};
  if (Object.keys(actual.runner_configuration).length !== Object.keys(publicConfiguration).length)
    return false;
  if (
    Object.keys(actual.state_storage_configuration).length !==
    Object.keys(actualDocument.state_storage_configuration ?? {}).length
  )
    return false;
  return Object.keys({ ...wanted, ...actualDocument }).every((key) =>
    key === 'runner_configuration'
      ? Object.keys(publicConfiguration).length === Object.keys(configuration).length &&
        Object.entries(configuration).every(([field, child]) =>
          sameField(field, child, publicConfiguration[field as keyof typeof publicConfiguration]),
        )
      : sameField(
          key,
          wanted[key as keyof typeof wanted],
          actualDocument[key as keyof typeof actualDocument],
        ),
  );
};
