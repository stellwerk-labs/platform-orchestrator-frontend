import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('./runtime-notices/', import.meta.url));
if (!lstatSync(directory).isDirectory() || !lstatSync(join(directory, 'manifest.json')).isFile()) {
  throw new Error('Runtime notices must be regular files in a real directory');
}
const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json')));
const expected = new Set(['manifest.json']);
const origins = new Set();
for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
  if (!entry.isDirectory() && !entry.isFile())
    throw new Error('Runtime notice links are forbidden');
}
for (const source of manifest.sources) {
  if (
    !/^[a-z]+$/.test(source.origin) ||
    origins.has(source.origin) ||
    !/^[a-f0-9]{40}$/.test(source.aportsCommit) ||
    !/^[a-f0-9]{128}$/.test(source.sourceSHA512) ||
    !source.sourceURL.startsWith('https://distfiles.alpinelinux.org/distfiles/v3.24/')
  ) {
    throw new Error('Runtime notice source identity changed');
  }
  origins.add(source.origin);
  for (const notice of source.notices) {
    if (
      !notice.file.startsWith(source.origin + '/') ||
      !/^[a-z]+\/[A-Z.]+$/.test(notice.file) ||
      expected.has(notice.file)
    )
      throw new Error('Unsafe runtime notice path');
    expected.add(notice.file);
    const path = join(directory, notice.file);
    if (
      !lstatSync(path).isFile() ||
      createHash('sha256').update(readFileSync(path)).digest('hex') !== notice.sha256
    ) {
      throw new Error('Original runtime notice bytes changed');
    }
  }
}
const actual = readdirSync(directory, { recursive: true, withFileTypes: true })
  .filter((entry) => !entry.isDirectory())
  .map((entry) => join(entry.parentPath, entry.name).slice(directory.length));
if (actual.length !== expected.size || actual.some((name) => !expected.has(name))) {
  throw new Error('Runtime notice manifest does not cover exact files');
}
const pins = readFileSync(join(dirname(directory), 'runtime-apks.sha256'), 'utf8')
  .trim()
  .split('\n');
if (
  pins.length !== manifest.packages.length * 2 ||
  manifest.packages.some(
    (pkg) =>
      !origins.has(pkg.origin) ||
      pins.filter((pin) => pin.endsWith('/' + pkg.name + '-' + pkg.version + '.apk')).length !== 2,
  )
) {
  throw new Error('Runtime notice package identity differs from exact APK input closure');
}
