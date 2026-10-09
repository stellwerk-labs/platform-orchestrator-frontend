import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, parse, relative } from 'node:path';

import type { Plugin } from 'vite';

export const dependencyLicenseFile = 'licenses/dependencies.json';

// New identifiers require review, not an UNKNOWN entry in a shipped bundle.
const reviewedLicenses = new Set([
  '0BSD',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'ISC',
  'MIT',
  'Unlicense',
]);
const noticeName = /^(?:licen[cs]e|copying|notice|patents)(?:$|[._-])/i;
const licenseName = /^(?:licen[cs]e|copying)(?:$|[._-])/i;

type DependencyLicense = { name: string; version: string; identifier?: string; text?: string };

const readNotice = (path: string): Buffer => {
  if (!lstatSync(path).isFile()) throw new Error('Licence notice must be a regular file');
  const content = readFileSync(path);
  if (!content.toString('utf8').trim()) throw new Error('Licence notice must not be empty');
  return content;
};

const packageData = (moduleId: string): { directory: string; key: string } => {
  let directory = dirname(moduleId.split('?')[0]!);
  while (directory !== parse(directory).root) {
    const manifest = join(directory, 'package.json');
    if (existsSync(manifest)) {
      const { name, version } = JSON.parse(readFileSync(manifest, 'utf8'));
      if (name) {
        if (
          typeof name !== 'string' ||
          !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name) ||
          typeof version !== 'string' ||
          !/^[a-z0-9][a-z0-9.+_-]*$/i.test(version)
        ) {
          throw new Error('Bundled dependency has invalid package identity');
        }
        return { directory, key: `${name}@${version}` };
      }
    }
    directory = dirname(directory);
  }
  throw new Error('Bundled dependency has no package identity');
};

/** Validate Vite's actual bundle catalogue and preserve its upstream notices. */
export const dependencyNotices = (ownLicense: string): Plugin => ({
  name: 'console:dependency-notices',
  apply: 'build',
  enforce: 'post',
  generateBundle: {
    order: 'post',
    handler(_options, bundle) {
      const catalogue = bundle[dependencyLicenseFile];
      if (!catalogue || catalogue.type !== 'asset') {
        throw new Error('Vite dependency licence catalogue is missing');
      }
      const entries: DependencyLicense[] = JSON.parse(
        typeof catalogue.source === 'string'
          ? catalogue.source
          : Buffer.from(catalogue.source).toString('utf8'),
      );
      const dependencies = new Map<string, DependencyLicense>();
      for (const entry of entries) {
        const key = `${entry.name}@${entry.version}`;
        if (
          dependencies.has(key) ||
          !entry.identifier ||
          !reviewedLicenses.has(entry.identifier) ||
          !entry.text?.trim()
        ) {
          throw new Error(`Missing or unreviewed bundled dependency licence: ${key}`);
        }
        dependencies.set(key, entry);
      }

      const emitted = new Map<string, Buffer>();
      const included = new Set<string>();
      const bundled = new Set<string>();
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        for (const moduleId of chunk.moduleIds) {
          if (moduleId.startsWith('\0') || !moduleId.includes('/node_modules/')) continue;
          const { directory, key } = packageData(moduleId);
          const entry = dependencies.get(key);
          if (!entry) throw new Error(`Bundled dependency is absent from Vite catalogue: ${key}`);
          bundled.add(key);
          // Inspect only the bundled module's ancestors, up to its named package root.
          let noticeDirectory = dirname(moduleId.split('?')[0]!);
          while (true) {
            if (!included.has(noticeDirectory)) {
              included.add(noticeDirectory);
              let matchedLicense = false;
              for (const file of readdirSync(noticeDirectory).sort()) {
                if (!noticeName.test(file)) continue;
                const content = readNotice(join(noticeDirectory, file));
                if (
                  licenseName.test(file) &&
                  content.toString('utf8').trim() === entry.text?.trim()
                ) {
                  matchedLicense = true;
                }
                const fileName = `licenses/packages/${key}/${relative(directory, join(noticeDirectory, file))}`;
                const prior = emitted.get(fileName);
                if (prior && !prior.equals(content)) {
                  throw new Error(`Conflicting bundled dependency notices: ${key}`);
                }
                emitted.set(fileName, content);
              }
              if (noticeDirectory === directory && !matchedLicense)
                throw new Error(`Bundled dependency licence text is missing: ${key}`);
            }
            if (noticeDirectory === directory) break;
            noticeDirectory = dirname(noticeDirectory);
          }
        }
      }
      if (dependencies.size !== bundled.size) {
        throw new Error('Vite dependency licence catalogue does not match the bundle');
      }
      for (const [fileName, source] of emitted) this.emitFile({ type: 'asset', fileName, source });
      this.emitFile({
        type: 'asset',
        fileName: 'licenses/platform-orchestrator-frontend/LICENSE',
        source: readNotice(ownLicense),
      });
    },
  },
});
