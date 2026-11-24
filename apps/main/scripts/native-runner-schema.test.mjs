import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import yaml from 'js-yaml';

import { nativeRunnerSchemas, nativeSchemaOutput } from './native-runner-schema.mjs';

test('the bundled native editor schema is reproducible from the pinned contract', () => {
  assert.deepEqual(JSON.parse(readFileSync(nativeSchemaOutput, 'utf8')), nativeRunnerSchemas());
});
test('create requires advertised public inventory while update permits retained disabled registrations', () => {
  const { create, update } = nativeRunnerSchemas();
  assert.deepEqual(create.properties.runner_configuration.required, [
    'type',
    'key',
    'max_parallel_jobs',
    'native_execution',
    'capabilities',
    'supported_protocols',
  ]);
  assert.deepEqual(update.properties.runner_configuration.required, ['type']);
  assert.equal(
    update.properties.runner_configuration.properties.native_execution.anyOf[1].type,
    'null',
  );
  assert.equal(create.additionalProperties, false);
  assert.equal(create.properties.runner_configuration.additionalProperties, false);
  assert.equal(create.properties.runner_configuration.properties.type.const, 'native-agent');
  assert.equal(create.properties.uuid, undefined);
});
test('backend branches have distinct literals including otherwise identical S3/GCS structures', () => {
  const { create } = nativeRunnerSchemas();
  const backends = create.properties.state_storage_configuration.oneOf;
  assert.deepEqual(
    backends.map((branch) => branch.properties.type.const),
    ['kubernetes', 's3', 'gcs', 'azurerm'],
  );
  assert.ok(backends.every((branch) => branch.additionalProperties === false));
});

test('native enrollment keeps the actual Core Runner pattern with its explicit v2 length limit', () => {
  const core = yaml.load(readFileSync(new URL('../schemas/cp.yml', import.meta.url), 'utf8'))
    .components.schemas.RunnerCreateBody.properties.id;
  const { create, update } = nativeRunnerSchemas();
  assert.equal(create.properties.id.pattern, core.pattern);
  assert.equal(core.maxLength, undefined);
  assert.equal(create.properties.id.maxLength, 128);
  assert.equal(update.properties.id, undefined);
});
