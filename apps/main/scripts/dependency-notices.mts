import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, parse, relative } from 'node:path';

import { load } from 'js-yaml';
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
const isNotice = (name: string): boolean =>
  noticeName.test(name) && !/\.(?:[cm]?[jt]sx?|map)$/i.test(name);

type DependencyLicense = { name: string; version: string; identifier?: string; text?: string };
type SupplementalLicense = {
  name: string;
  version: string;
  identifier: string;
  integrity: string;
  packageJSONSHA256: string;
  notices: { fileName: string; source: string; sha256: string }[];
  provenance: { note: string; sources: { url: string; sha256: string }[] };
};
type Supplement = { manifestFile: string; lockFile: string };
const sha256 = (content: Buffer): string => createHash('sha256').update(content).digest('hex');

const supplementalLicenses = (config?: Supplement): Map<string, SupplementalLicense> => {
  if (!config) return new Map();
  const manifest = JSON.parse(readNotice(config.manifestFile).toString('utf8'));
  const lock = load(readNotice(config.lockFile).toString('utf8')) as {
    packages: Record<string, { resolution: { integrity: string } }>;
  };
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.packages)) {
    throw new Error('Invalid supplemental licence manifest');
  }
  const result = new Map<string, SupplementalLicense>();
  for (const entry of manifest.packages as SupplementalLicense[]) {
    const key = `${entry.name}@${entry.version}`;
    if (
      result.has(key) ||
      !reviewedLicenses.has(entry.identifier) ||
      !/^sha512-[a-zA-Z0-9+/]+={0,2}$/.test(entry.integrity) ||
      lock.packages[key]?.resolution.integrity !== entry.integrity ||
      !/^[a-f0-9]{64}$/.test(entry.packageJSONSHA256) ||
      !entry.notices.length ||
      !licenseName.test(entry.notices[0]!.fileName) ||
      !entry.provenance.note.trim() ||
      !entry.provenance.sources.length ||
      entry.provenance.sources.some(
        (source) => !/^https:\/\//.test(source.url) || !/^[a-f0-9]{64}$/.test(source.sha256),
      )
    ) {
      throw new Error(`Supplemental licence identity or locked integrity changed: ${key}`);
    }
    const names = new Set<string>();
    for (const notice of entry.notices) {
      if (
        !isNotice(notice.fileName) ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(notice.fileName) ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(notice.source) ||
        names.has(notice.fileName) ||
        sha256(readNotice(join(dirname(config.manifestFile), notice.source))) !== notice.sha256
      ) {
        throw new Error(`Supplemental licence notice changed: ${key}`);
      }
      names.add(notice.fileName);
    }
    result.set(key, entry);
  }
  return result;
};

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
export const dependencyNotices = (ownLicense: string, supplement?: Supplement): Plugin => ({
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
      const supplements = supplementalLicenses(supplement);
      const emitted = new Map<string, Buffer>();
      const dependencies = new Map<string, DependencyLicense>();
      for (const entry of entries) {
        const key = `${entry.name}@${entry.version}`;
        const original = supplements.get(key);
        if (original && supplement) {
          if (
            entry.text?.trim() ||
            (entry.identifier && entry.identifier !== original.identifier)
          ) {
            throw new Error(`Supplemental licence no longer matches upstream metadata: ${key}`);
          }
          for (const notice of original.notices) {
            const content = readNotice(join(dirname(supplement.manifestFile), notice.source));
            emitted.set(`licenses/packages/${key}/${notice.fileName}`, content);
          }
          entry.identifier = original.identifier;
          entry.text = emitted
            .get(`licenses/packages/${key}/${original.notices[0]!.fileName}`)!
            .toString('utf8')
            .trim();
          emitted.set(
            `licenses/packages/${key}/provenance.json`,
            Buffer.from(JSON.stringify(original, null, 2) + '\n'),
          );
        }
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

      const included = new Set<string>();
      const bundled = new Set<string>();
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        for (const moduleId of chunk.moduleIds) {
          if (moduleId.startsWith('\0') || !moduleId.includes('/node_modules/')) continue;
          const { directory, key } = packageData(moduleId);
          const entry = dependencies.get(key);
          if (!entry) throw new Error(`Bundled dependency is absent from Vite catalogue: ${key}`);
          const original = supplements.get(key);
          if (
            original &&
            sha256(readFileSync(join(directory, 'package.json'))) !== original.packageJSONSHA256
          ) {
            throw new Error(`Supplemental licence package identity changed: ${key}`);
          }
          bundled.add(key);
          // Inspect only the bundled module's ancestors, up to its named package root.
          let noticeDirectory = dirname(moduleId.split('?')[0]!);
          while (true) {
            if (!included.has(noticeDirectory)) {
              included.add(noticeDirectory);
              let matchedLicense = Boolean(original);
              for (const file of readdirSync(noticeDirectory).sort()) {
                if (!isNotice(file)) continue;
                if (original && noticeDirectory === directory && licenseName.test(file)) {
                  throw new Error(`Supplemental licence upstream material changed: ${key}`);
                }
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
      catalogue.source = JSON.stringify(entries, null, 2);
      for (const [fileName, source] of emitted) this.emitFile({ type: 'asset', fileName, source });
      this.emitFile({
        type: 'asset',
        fileName: 'licenses/platform-orchestrator-frontend/LICENSE',
        source: readNotice(ownLicense),
      });
    },
  },
});
