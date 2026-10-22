import assert from 'node:assert/strict';
import test from 'node:test';

import { formatGeneratedJSDoc } from './format-orval-docs.mjs';

test('preserves a schema pattern without treating it as a JSDoc type declaration', () => {
  const pattern = '^((=|!=|>|>=|<|<=|~>) ([0-9.]+(-.+)?))$';
  const source = `/**\n * Provider version\n\n * @pattern ${pattern}\n */\nversion: string;\n`;
  const formatted = formatGeneratedJSDoc(source);
  assert.equal(
    formatted,
    `/**\n * Provider version\n *\n * Pattern: ${pattern}\n */\nversion: string;\n`,
  );
  assert.equal(formatGeneratedJSDoc(formatted), formatted);
});

test('preserves code and other documentation tags', () => {
  const source = 'const pattern = "@pattern ^[a-z]+$";\n/**\n * @maxLength 100\n */\n';
  assert.equal(formatGeneratedJSDoc(source), source);
});
