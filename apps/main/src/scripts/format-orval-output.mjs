import { execa } from 'execa';

const paths = [
  'apps/main/src/models/v2/**/*.ts',
  'apps/main/src/hooks/react-query/v2/**/*.ts',
  'apps/main/src/models/v2/**/*.ts',
  'apps/main/src/hooks/react-query/v2/**/*.ts',
];

try {
  await execa('eslint', [...paths, '--fix'], { stdio: 'inherit' });
  await execa('prettier', [...paths, '--write', '.'], { stdio: 'inherit' });
} catch (_) {
  process.exit(1);
}
