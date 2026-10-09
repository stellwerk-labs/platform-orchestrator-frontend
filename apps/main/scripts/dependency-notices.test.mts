import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

import { dependencyLicenseFile, dependencyNotices } from './dependency-notices.mts';

const ownLicense = fileURLToPath(new URL('../../../LICENSE', import.meta.url));
const require = createRequire(new URL('../package.json', import.meta.url));
const reactDirectory = dirname(require.resolve('react/package.json'));

const fixture = async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'console-notices-')));
  const dependency = join(root, 'node_modules', 'bundled-notice');
  await mkdir(dependency, { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'notice-build', type: 'module' }),
  );
  await writeFile(
    join(dependency, 'package.json'),
    JSON.stringify({
      name: 'bundled-notice',
      version: '1.2.3',
      license: 'Apache-2.0',
      main: 'index.js',
    }),
  );
  await writeFile(join(dependency, 'index.js'), 'export const notice = "actually bundled";');
  await writeFile(join(dependency, 'LICENSE'), 'Apache licence fixture\n');
  await writeFile(join(dependency, 'LICENSE-MIT'), 'Additional MIT licence fixture\n');
  await writeFile(join(dependency, 'NOTICE'), 'Required upstream notice fixture\n');
  await writeFile(join(dependency, 'PATENTS'), 'Additional patent grant fixture\n');
  await symlink(reactDirectory, join(root, 'node_modules', 'react'), 'dir');
  const unused = join(root, 'node_modules', 'unused-notice');
  await mkdir(unused);
  await writeFile(
    join(unused, 'package.json'),
    JSON.stringify({
      name: 'unused-notice',
      version: '9.9.9',
      license: 'UNKNOWN',
      main: 'index.js',
    }),
  );
  await writeFile(join(unused, 'index.js'), 'export const unused = true;');
  await writeFile(join(root, 'index.html'), '<script type="module" src="/entry.js"></script>');
  await writeFile(
    join(root, 'entry.js'),
    `import React from 'react';
import { notice } from 'bundled-notice';
document.body.textContent = React.version + notice;`,
  );
  const output = join(root, 'dist');
  const run = (supplement?: { manifestFile: string; lockFile: string }) =>
    build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [dependencyNotices(ownLicense, supplement)],
      build: { outDir: output, license: { fileName: dependencyLicenseFile } },
    });
  return { root, dependency, output, run };
};

test('real Vite bundle includes only bundled packages and all original notices', async () => {
  const { root, dependency, output, run } = await fixture();
  try {
    await run();
    const entries = JSON.parse(await readFile(join(output, dependencyLicenseFile), 'utf8'));
    assert.deepEqual(
      entries.map((entry: { name: string }) => entry.name),
      ['bundled-notice', 'react'],
    );
    const react = JSON.parse(await readFile(join(reactDirectory, 'package.json'), 'utf8'));
    assert.equal(entries[1].version, react.version);
    assert.equal(entries[1].text, (await readFile(join(reactDirectory, 'LICENSE'), 'utf8')).trim());
    for (const file of ['LICENSE', 'LICENSE-MIT', 'NOTICE', 'PATENTS']) {
      assert.deepEqual(
        await readFile(join(output, 'licenses/packages/bundled-notice@1.2.3', file)),
        await readFile(join(dependency, file)),
      );
    }
    assert.deepEqual(
      await readFile(join(output, 'licenses/platform-orchestrator-frontend/LICENSE')),
      await readFile(ownLicense),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('real Vite bundle preserves module-ancestor notices without scanning unrelated directories', async () => {
  const { root, dependency, output, run } = await fixture();
  try {
    await mkdir(join(dependency, 'lib/deep'), { recursive: true });
    await mkdir(join(dependency, 'unbundled'));
    await writeFile(join(dependency, 'lib/deep/index.js'), 'export const notice = "nested";');
    await writeFile(join(dependency, 'lib/NOTICE'), 'Nested upstream notice\n');
    await writeFile(join(dependency, 'lib/Notice.js'), 'export const component = true;');
    await writeFile(
      join(dependency, 'lib/Notice.d.ts'),
      'export declare const component: boolean;',
    );
    await writeFile(join(dependency, 'lib/deep/PATENTS'), 'Nested patent grant\n');
    await writeFile(join(dependency, 'unbundled/NOTICE'), 'Not part of the bundle\n');
    const manifestPath = join(dependency, 'package.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.main = 'lib/deep/index.js';
    await writeFile(manifestPath, JSON.stringify(manifest));
    await run();
    for (const file of ['LICENSE', 'lib/NOTICE', 'lib/deep/PATENTS']) {
      assert.deepEqual(
        await readFile(join(output, 'licenses/packages/bundled-notice@1.2.3', file)),
        await readFile(join(dependency, file)),
      );
    }
    await assert.rejects(
      readFile(join(output, 'licenses/packages/bundled-notice@1.2.3/unbundled/NOTICE')),
      /ENOENT/,
    );
    for (const file of ['lib/Notice.js', 'lib/Notice.d.ts']) {
      await assert.rejects(
        readFile(join(output, 'licenses/packages/bundled-notice@1.2.3', file)),
        /ENOENT/,
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

for (const kind of [
  'missing-identifier',
  'unknown-identifier',
  'missing-text',
  'empty-notice',
  'linked-notice',
]) {
  test(`real Vite build refuses ${kind}`, async () => {
    const { root, dependency, run } = await fixture();
    try {
      if (kind === 'missing-identifier' || kind === 'unknown-identifier') {
        const path = join(dependency, 'package.json');
        const manifest = JSON.parse(await readFile(path, 'utf8'));
        if (kind === 'missing-identifier') delete manifest.license;
        else manifest.license = 'UNKNOWN';
        await writeFile(path, JSON.stringify(manifest));
      } else if (kind === 'missing-text') {
        await rm(join(dependency, 'LICENSE'));
        await rm(join(dependency, 'LICENSE-MIT'));
      } else if (kind === 'empty-notice') {
        await writeFile(join(dependency, 'NOTICE'), '  \n');
      } else {
        await rm(join(dependency, 'NOTICE'));
        await symlink(join(dependency, 'LICENSE'), join(dependency, 'NOTICE'));
      }
      const expected =
        kind === 'empty-notice'
          ? /Licence notice must not be empty/
          : kind === 'linked-notice'
            ? /Licence notice must be a regular file/
            : /Missing or unreviewed bundled dependency licence/;
      await assert.rejects(run, expected);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test('real Vite build requires the built-in catalogue and own licence', async () => {
  const { root, output } = await fixture();
  try {
    await assert.rejects(
      () =>
        build({
          root,
          configFile: false,
          logLevel: 'silent',
          plugins: [dependencyNotices(ownLicense)],
          build: { outDir: output, license: false },
        }),
      /catalogue is missing/,
    );
    await assert.rejects(
      () =>
        build({
          root,
          configFile: false,
          logLevel: 'silent',
          plugins: [dependencyNotices(join(root, 'missing-LICENSE'))],
          build: { outDir: output, license: { fileName: dependencyLicenseFile } },
        }),
      /ENOENT/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

const supplementalFixture = async () => {
  const current = await fixture();
  const packagePath = join(current.dependency, 'package.json');
  const packageJSON = JSON.parse(await readFile(packagePath, 'utf8'));
  // The exact fixture has a legacy MIT declaration, which Vite does not read.
  delete packageJSON.license;
  packageJSON.licenses = [{ type: 'MIT' }];
  await writeFile(packagePath, JSON.stringify(packageJSON));
  await rm(join(current.dependency, 'LICENSE'));
  await rm(join(current.dependency, 'LICENSE-MIT'));
  const directory = join(current.root, 'supplemental');
  await mkdir(directory);
  const notice = await readFile(join(reactDirectory, 'LICENSE'));
  await writeFile(join(directory, 'upstream-LICENSE'), notice);
  const integrity =
    'sha512-' + createHash('sha512').update('immutable package fixture').digest('base64');
  const lockFile = join(current.root, 'pnpm-lock.yaml');
  await writeFile(
    lockFile,
    JSON.stringify({ packages: { 'bundled-notice@1.2.3': { resolution: { integrity } } } }),
  );
  const manifestFile = join(directory, 'manifest.json');
  await writeFile(
    manifestFile,
    JSON.stringify({
      schemaVersion: 1,
      packages: [
        {
          name: 'bundled-notice',
          version: '1.2.3',
          identifier: 'MIT',
          integrity,
          packageJSONSHA256: createHash('sha256')
            .update(await readFile(packagePath))
            .digest('hex'),
          notices: [
            {
              fileName: 'LICENSE',
              source: 'upstream-LICENSE',
              sha256: createHash('sha256').update(notice).digest('hex'),
            },
          ],
          provenance: {
            note: 'Real React upstream licence, bound to this temporary bundle fixture.',
            sources: [
              {
                url: 'https://github.com/facebook/react/blob/main/LICENSE',
                sha256: createHash('sha256').update(notice).digest('hex'),
              },
            ],
          },
        },
      ],
    }),
  );
  return { ...current, directory, packagePath, supplement: { manifestFile, lockFile }, notice };
};

test('real Vite build supplements only the exact locked package and ships original notice/provenance', async () => {
  const { root, output, run, supplement, notice } = await supplementalFixture();
  try {
    await assert.rejects(() => run(), /Missing or unreviewed bundled dependency licence/);
    await run(supplement);
    const entries = JSON.parse(await readFile(join(output, dependencyLicenseFile), 'utf8'));
    assert.equal(entries[0].identifier, 'MIT');
    assert.equal(entries[0].text, notice.toString('utf8').trim());
    assert.deepEqual(
      await readFile(join(output, 'licenses/packages/bundled-notice@1.2.3/LICENSE')),
      notice,
    );
    const provenance = JSON.parse(
      await readFile(
        join(output, 'licenses/packages/bundled-notice@1.2.3/provenance.json'),
        'utf8',
      ),
    );
    assert.equal(
      provenance.integrity,
      JSON.parse(await readFile(supplement.manifestFile, 'utf8')).packages[0].integrity,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

for (const kind of [
  'locked-integrity',
  'package-identity',
  'notice-content',
  'unknown-version',
  'notice-path',
  'upstream-license',
]) {
  test(`real Vite build refuses supplemental ${kind} drift`, async () => {
    const { root, directory, packagePath, dependency, run, supplement, notice } =
      await supplementalFixture();
    try {
      if (kind === 'locked-integrity')
        await writeFile(supplement.lockFile, JSON.stringify({ packages: {} }));
      else if (kind === 'package-identity' || kind === 'unknown-version') {
        const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
        if (kind === 'package-identity') manifest.description = 'changed';
        else manifest.version = '1.2.4';
        await writeFile(packagePath, JSON.stringify(manifest));
      } else if (kind === 'notice-content')
        await writeFile(join(directory, 'upstream-LICENSE'), 'changed notice');
      else if (kind === 'notice-path') {
        const manifest = JSON.parse(await readFile(supplement.manifestFile, 'utf8'));
        manifest.packages[0].notices[0].source = '../LICENSE';
        await writeFile(supplement.manifestFile, JSON.stringify(manifest));
      } else await writeFile(join(dependency, 'LICENSE'), notice);
      const expected =
        kind === 'locked-integrity'
          ? /locked integrity changed/
          : kind === 'package-identity'
            ? /package identity changed/
            : kind === 'unknown-version'
              ? /Missing or unreviewed bundled dependency licence/
              : kind === 'upstream-license'
                ? /no longer matches upstream metadata/
                : /notice changed/;
      await assert.rejects(() => run(supplement), expected);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test('Turbo invalidates configuration/helpers/notices and the image copies the same output', async () => {
  const repo = fileURLToPath(new URL('../../../', import.meta.url));
  const turbo = JSON.parse(await readFile(join(repo, 'turbo.json'), 'utf8'));
  for (const input of [
    '*.config.mts',
    'scripts/**',
    'licenses/**',
    '$TURBO_ROOT$/LICENSE',
    '$TURBO_ROOT$/pnpm-lock.yaml',
  ]) {
    assert.ok(turbo.tasks.build.inputs.includes(input));
  }
  const dockerfile = await readFile(join(repo, 'apps/main/Dockerfile'), 'utf8');
  assert.match(dockerfile, /^COPY --from=build \/app\/apps\/main\/dist \/app\/build$/m);
  assert.match(dockerfile, /^COPY --from=build \/app\/apps\/main\/dist\/licenses \/licenses$/m);
});
