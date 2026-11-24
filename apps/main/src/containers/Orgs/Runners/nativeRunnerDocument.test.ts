import { describe, expect, it } from 'vitest';

import type { Runner } from '@src/models/v2/controlplane';

import {
  MAX_RUNNER_SOURCE_BYTES,
  nativeRunnerDocument,
  nativeRunnerIdentityMatches,
  nativeRunnerPatch,
  nativeRunnerResponseMatches,
  parseRunnerInventory,
  parseRunnerSource,
} from './nativeRunnerDocument';

const base: Runner = {
  id: 'native-pool',
  uuid: '11223344-5566-4788-99aa-bbccddeeff00',
  org_id: 'org',
  description: 'Original',
  created_at: '2026-11-20T00:00:00Z',
  updated_at: '2026-11-20T00:00:00Z',
  state_storage_configuration: { type: 's3', bucket: 'state' },
  runner_configuration: {
    type: 'native-agent',
    key: 'public-key',
    max_parallel_jobs: 2,
    capabilities: ['read', 'write'],
    supported_protocols: ['stellwerk.pipeline/v2', 'stellwerk.pipeline.plan-apply/v2'],
    native_execution: {
      contract_version: 'stellwerk.runner.catalogue/v1',
      runtime_version: 'stellwerk.runner.rollout/v2',
      tools_digest: 'a'.repeat(64),
      tools: [],
    },
  },
};
const inventory = {
  native_execution:
    base.runner_configuration.type === 'native-agent'
      ? base.runner_configuration.native_execution
      : undefined,
  capabilities: ['read', 'write'],
  supported_protocols: ['stellwerk.pipeline/v2', 'stellwerk.pipeline.plan-apply/v2'],
};

it('projects public editable fields without changing retained identity or inventing disabled inventory', () => {
  const disabled = {
    ...base,
    runner_configuration: {
      type: 'native-agent' as const,
      key: 'public-key',
      max_parallel_jobs: 2,
    },
  };
  expect(nativeRunnerDocument(disabled)).toEqual({
    description: 'Original',
    runner_configuration: disabled.runner_configuration,
    state_storage_configuration: disabled.state_storage_configuration,
  });
  expect(nativeRunnerDocument(base)).not.toHaveProperty('uuid');
});

it('changes description without owning or resending captured inventory', () => {
  expect(nativeRunnerPatch(base, { ...nativeRunnerDocument(base), description: 'Edited' })).toEqual(
    { description: 'Edited' },
  );
  expect(nativeRunnerPatch(base, { description: '' })).toEqual({ description: '' });
  expect(nativeRunnerPatch(base, {})).toEqual({});
});

it('ignores order of capability/protocol sets and object keys', () => {
  const document = nativeRunnerDocument(base);
  document.runner_configuration!.capabilities = ['write', 'read'];
  document.runner_configuration!.supported_protocols?.reverse();
  document.state_storage_configuration = { bucket: 'state', type: 's3' };
  expect(nativeRunnerPatch(base, document)).toEqual({});
});

it('owns explicit disable and replacement while omission never clears inventory', () => {
  expect(
    nativeRunnerPatch(base, {
      runner_configuration: { type: 'native-agent', native_execution: null },
    }),
  ).toEqual({ runner_configuration: { type: 'native-agent', native_execution: null } });
  expect(nativeRunnerPatch(base, { runner_configuration: { type: 'native-agent' } })).toEqual({});
  expect(
    nativeRunnerPatch(base, {
      runner_configuration: {
        type: 'native-agent',
        native_execution: { ...inventory.native_execution!, tools_digest: 'b'.repeat(64) },
      },
    }),
  ).toEqual({
    runner_configuration: {
      type: 'native-agent',
      native_execution: { ...inventory.native_execution, tools_digest: 'b'.repeat(64) },
    },
  });
});

it('does not send an explicit clear for metadata already absent on a disabled registration', () => {
  const disabled = {
    ...base,
    runner_configuration: {
      type: 'native-agent' as const,
      key: 'public-key',
      max_parallel_jobs: 2,
    },
  };
  expect(
    nativeRunnerPatch(disabled, {
      runner_configuration: {
        type: 'native-agent',
        native_execution: null,
        capabilities: null,
        supported_protocols: null,
      },
    }),
  ).toEqual({});
});

it('detects an independently disabled inventory after description-only PATCH, rather than claiming success or re-enabling it', () => {
  const { native_execution: _inventory, ...configuration } =
    base.runner_configuration as NonNullable<
      ReturnType<typeof nativeRunnerDocument>['runner_configuration']
    >;
  const actual = { ...base, description: 'Edited', runner_configuration: configuration } as Runner;
  const patch = nativeRunnerPatch(base, { ...nativeRunnerDocument(base), description: 'Edited' });
  expect(patch).toEqual({ description: 'Edited' });
  expect(nativeRunnerResponseMatches(base, patch, actual)).toBe(false);
});

it('recognizes a confirmed clear represented by absent READ metadata and ignores server timestamps', () => {
  const disabled = {
    ...base,
    updated_at: '2026-11-21T00:00:00Z',
    runner_configuration: {
      type: 'native-agent' as const,
      key: 'public-key',
      max_parallel_jobs: 2,
      capabilities: ['write', 'read'],
      supported_protocols: inventory.supported_protocols,
    },
  };
  expect(
    nativeRunnerResponseMatches(
      base,
      { runner_configuration: { type: 'native-agent', native_execution: null } },
      disabled,
    ),
  ).toBe(true);
});

it.each(['uuid', 'id', 'org_id'] as const)('refuses changed immutable %s', (field) => {
  expect(nativeRunnerResponseMatches(base, {}, { ...base, [field]: 'different' })).toBe(false);
});

it('detects independently added descriptions and unknown backend fields', () => {
  const { description: _description, ...withoutDescription } = base;
  expect(nativeRunnerResponseMatches(withoutDescription, {}, base)).toBe(false);
  const actual = structuredClone(base);
  Object.assign(actual.state_storage_configuration, { credentials: 'must-not-be-adopted' });
  expect(nativeRunnerResponseMatches(base, {}, actual)).toBe(false);
});

it('refuses nil UUID as retained identity and as a supposedly successful response', () => {
  const nil = { ...base, uuid: '00000000-0000-0000-0000-000000000000' };
  expect.soft(nativeRunnerIdentityMatches(nil, nil)).toBe(false);
  expect.soft(nativeRunnerResponseMatches(nil, {}, nil)).toBe(false);
});

it('refuses malformed retained UUID and unexpected managed fields in an otherwise successful response', () => {
  expect(nativeRunnerResponseMatches({ ...base, uuid: 'not-a-uuid' }, {}, base)).toBe(false);
  const actual = structuredClone(base);
  Object.assign(actual.runner_configuration, { runtime_dsn: 'must-not-be-adopted' });
  expect(nativeRunnerResponseMatches(base, {}, actual)).toBe(false);
});

describe('bounded public source import', () => {
  it('parses JSON-compatible YAML and preserves the opaque exported digest', () => {
    expect(
      parseRunnerSource('description: text\nrunner_configuration:\n  type: native-agent\n', 'yaml'),
    ).toEqual({ description: 'text', runner_configuration: { type: 'native-agent' } });
    expect(parseRunnerInventory(JSON.stringify(inventory), 'json')).toEqual(inventory);
  });
  it.each([
    'key: "-----BEGIN PRIVATE KEY-----"',
    'key: "-----BEGIN OPENSSH PRIVATE KEY-----"',
    'a: &anchor {b: c}\nd: *anchor',
    'a: &cycle {b: *cycle}',
    'a: .inf',
    'a: 1\na: 2',
    '[]',
    '- bad',
  ])('rejects private, aliased, non-JSON or malformed input without echoing it', (source) => {
    expect(() => parseRunnerSource(source, 'yaml')).toThrow();
  });
  it('rejects escaped JSON private keys, excess depth and oversize input before worker/network use', () => {
    expect(() => parseRunnerSource('{"key":"\\u002d----BEGIN PRIVATE KEY-----"}', 'json')).toThrow(
      'Private keys',
    );
    expect(() => parseRunnerSource(`${'{"a":'.repeat(18)}null${'}'.repeat(18)}`, 'json')).toThrow(
      'too complex',
    );
    expect(() => parseRunnerSource('x'.repeat(MAX_RUNNER_SOURCE_BYTES + 1), 'json')).toThrow(
      'exceeds',
    );
  });
  it('refuses whole private/runtime files instead of extracting their recognized public fields', () => {
    expect(() =>
      parseRunnerInventory(JSON.stringify({ ...inventory, database_url: 'private-value' }), 'json'),
    ).toThrow('only inventory');
    expect(() =>
      parseRunnerInventory(
        JSON.stringify({ native_execution: inventory.native_execution }),
        'json',
      ),
    ).toThrow('only inventory');
  });
});
