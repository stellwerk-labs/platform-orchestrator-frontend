import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import macrosPlugin from 'vite-plugin-babel-macros';
import checker from 'vite-plugin-checker';
import svgrPlugin from 'vite-plugin-svgr';
import { defineConfig } from 'vitest/config';

import { dependencyLicenseFile, dependencyNotices } from './scripts/dependency-notices.mts';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    license: { fileName: dependencyLicenseFile },
    sourcemap: true,
    rolldownOptions: {
      external: ['./src/**/*.test.{ts,tsx}'],
    },
  },
  plugins: [
    react(),
    svgrPlugin(),
    macrosPlugin(),
    checker({ typescript: true }),
    dependencyNotices(fileURLToPath(new URL('../../LICENSE', import.meta.url)), {
      manifestFile: fileURLToPath(
        new URL('./licenses/supplemental/manifest.json', import.meta.url),
      ),
      lockFile: fileURLToPath(new URL('../../pnpm-lock.yaml', import.meta.url)),
    }),
  ],
  server: {
    port: parseInt(process.env.VITE_PORT || '4200', 10),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    include: ['./src/**/*.test.{ts,tsx}'],
    exclude: ['./src/playwright/**/*.test.{ts,tsx}'],
    css: true,
    reporters: ['default', 'html'],
    outputFile: './vitest-report/index.html',
    coverage: {
      provider: 'v8',
      include: ['./src/**/*.{ts,tsx}'],
      exclude: [
        '**/iam/**/*.{ts,tsx}',
        '**/controlplane/**/*.{ts,tsx}',
        '**/dataplane/**/*.{ts,tsx}',
      ],
      thresholds: {
        lines: 46,
        branches: 40,
        functions: 40,
        statements: 40,
      },
      reporter: ['text', 'html'],
    },
    allowOnly: true,
    retry: 1,
    pool: 'forks',
  },
  resolve: {
    tsconfigPaths: true,
  },
});
