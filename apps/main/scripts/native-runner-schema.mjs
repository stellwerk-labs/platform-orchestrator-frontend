import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';
import { format, resolveConfig } from 'prettier';

const input = new URL('../schemas/cp.yml', import.meta.url);
const provenance = new URL('../schemas/runner-source.json', import.meta.url);
export const nativeSchemaOutput = new URL(
  '../src/containers/Orgs/Runners/nativeRunnerSchemas.json',
  import.meta.url,
);

// This is the pinned native request closure, not an OpenAPI conversion service.
const expand = (value, schemas) => {
  if (Array.isArray(value)) return value.map((child) => expand(child, schemas));
  if (!value || typeof value !== 'object') return value;
  if (value.$ref) return expand(schemas[value.$ref.split('/').at(-1)], schemas);
  const { nullable, discriminator: _discriminator, example: _example, ...rest } = value;
  const result = Object.fromEntries(
    Object.entries(rest).map(([key, child]) => [key, expand(child, schemas)]),
  );
  if (result.properties) result.additionalProperties = false;
  return nullable ? { anyOf: [result, { type: 'null' }] } : result;
};

export const nativeRunnerSchemas = () => {
  const source = JSON.parse(readFileSync(provenance, 'utf8'));
  const schemas = yaml.load(readFileSync(input, 'utf8')).components.schemas;
  const backend = expand(schemas.StateStorageConfiguration, schemas);
  const mapping = schemas.StateStorageConfiguration.discriminator.mapping;
  Object.keys(mapping).forEach((type, index) => {
    backend.oneOf[index].properties.type = { type: 'string', const: type };
  });
  const request = (operation) => {
    const root = schemas[`Runner${operation}Body`];
    const body = expand(
      { ...root, properties: { ...root.properties, runner_configuration: {} } },
      schemas,
    );
    const native = expand(
      schemas[`NativeAgentRunnerConfiguration${operation === 'Update' ? 'UpdateBody' : ''}`],
      schemas,
    );
    native.properties.type = { type: 'string', const: 'native-agent' };
    if (operation === 'Create') {
      native.required.push('native_execution', 'capabilities', 'supported_protocols');
      // Native v2 runtime profile; the generic pinned Core Runner ID schema is unchanged.
      body.properties.id.maxLength = 128;
    }
    body.properties.runner_configuration = native;
    body.properties.state_storage_configuration = backend;
    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $comment: `Derived from Core ${source.source_commit}. Native v2 additionally limits enrollment IDs to 128 characters. Core validates enrollment and merged semantics.`,
      ...body,
    };
  };
  return { create: request('Create'), update: request('Update') };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(
    nativeSchemaOutput,
    await format(JSON.stringify(nativeRunnerSchemas()), {
      ...(await resolveConfig(fileURLToPath(nativeSchemaOutput))),
      parser: 'json',
    }),
  );
}
