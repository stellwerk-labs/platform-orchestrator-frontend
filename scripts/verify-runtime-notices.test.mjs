import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('./', import.meta.url));

/** Copy the actual checked-in notices and verifier into an owned test directory. */
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'console-notices-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const name of ['verify-runtime-notices.mjs', 'runtime-notices', 'runtime-apks.sha256']) {
    cpSync(join(source, name), join(directory, name), { recursive: true });
  }
  return directory;
}

/** Run the real verifier against the copied filesystem, without replacing its dependencies. */
function verify(directory) {
  return spawnSync(process.execPath, [join(directory, 'verify-runtime-notices.mjs')], {
    encoding: 'utf8',
  }).status;
}

test('original exact runtime APK notices pass', (t) => {
  assert.equal(verify(fixture(t)), 0);
});

test('changed original notice, extra file and changed APK closure fail', (t) => {
  for (const mutate of [
    (directory) => writeFileSync(join(directory, 'runtime-notices/bash/COPYING'), 'changed'),
    (directory) => writeFileSync(join(directory, 'runtime-notices/uncovered'), 'extra'),
    (directory) =>
      writeFileSync(
        join(directory, 'runtime-apks.sha256'),
        readFileSync(join(directory, 'runtime-apks.sha256'), 'utf8').replaceAll(
          'bash-5.3.9-r1',
          'bash-5.3.9-r2',
        ),
      ),
  ]) {
    const directory = fixture(t);
    mutate(directory);
    assert.notEqual(verify(directory), 0);
  }
});

test('notice and manifest symlinks fail even when their target bytes match', (t) => {
  for (const name of ['manifest.json', 'bash/COPYING']) {
    const directory = fixture(t);
    const path = join(directory, 'runtime-notices', name);
    const target = join(directory, 'original');
    cpSync(path, target);
    rmSync(path);
    symlinkSync(target, path);
    assert.notEqual(verify(directory), 0);
  }
});
