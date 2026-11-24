import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import yaml from 'js-yaml';

test('the curated Runner closure retains the exact pinned Core contract', () => {
  const source = JSON.parse(
    readFileSync(new URL('../schemas/runner-source.json', import.meta.url)),
  );
  const spec = yaml.load(readFileSync(new URL('../schemas/cp.yml', import.meta.url), 'utf8'));
  const selected = Object.fromEntries(
    source.selected_schemas.map((name) => [name, spec.components.schemas[name]]),
  );
  const hash = createHash('sha256').update(JSON.stringify(selected)).digest('hex');
  assert.equal(
    hash,
    source.selected_schemas_sha256,
    'Runner contract drift requires a new source pin',
  );
});
