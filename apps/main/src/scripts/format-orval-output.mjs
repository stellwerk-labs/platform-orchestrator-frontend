import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { execa } from 'execa';

import { formatGeneratedJSDoc } from './format-orval-docs.mjs';

const paths = ['apps/main/src/models/v2', 'apps/main/src/hooks/react-query/v2'];

try {
  for (const directory of paths) {
    for (const entry of readdirSync(directory, { recursive: true })) {
      if (!entry.endsWith('.ts')) continue;
      const path = join(directory, entry);
      const source = readFileSync(path, 'utf8');
      const formatted = formatGeneratedJSDoc(source);
      if (formatted !== source) writeFileSync(path, formatted);
    }
  }
  await execa('eslint', [...paths, '--fix'], { stdio: 'inherit' });
  await execa('prettier', [...paths, '--write'], { stdio: 'inherit' });
} catch (_) {
  process.exit(1);
}
