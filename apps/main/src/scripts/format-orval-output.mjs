import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { execa } from 'execa';

const paths = [
  'apps/main/src/models/v2',
  'apps/main/src/hooks/react-query/v2',
];

try {
  for (const directory of paths) {
    for (const entry of readdirSync(directory, { recursive: true })) {
      if (!entry.endsWith('.ts')) continue;
      const path = join(directory, entry);
      const source = readFileSync(path, 'utf8');
      // Preserve blank JSDoc lines without producing trailing whitespace.
      const formatted = source.replace(
        /^([\t ]*)\/\*\*([\s\S]*?)\*\//gm,
        (_, indent, body) =>
          `${indent}/**${body
            .split('\n')
            .map((line, index, lines) =>
              index > 0 && index < lines.length - 1 && !line.trim() ? `${indent} *` : line,
            )
            .join('\n')}*/`,
      );
      if (formatted !== source) writeFileSync(path, formatted);
    }
  }
  await execa('eslint', [...paths, '--fix'], { stdio: 'inherit' });
  await execa('prettier', [...paths, '--write'], { stdio: 'inherit' });
} catch (_) {
  process.exit(1);
}
