import { BuildEnvironment } from './build-environment';

// Only set window.env when running the Vite dev server (import.meta.env.DEV is a
// build-time constant: true for `vite`, false for `vite build`). In Docker, window.env
// is injected into index.html at container startup by entry-point.sh — do not overwrite it.

// For now we need !(window as any).env for playwright tests,
// but we should make a better setup.
if (import.meta.env.DEV || !(window as any).env) {
  (window as any).env = {
    BASE_URL: import.meta.env.VITE_BASE_URL,
    ENVIRONMENT_NAME: import.meta.env.VITE_ENVIRONMENT_NAME,
    DEPLOYMENT_MODE: import.meta.env.VITE_DEPLOYMENT_MODE,
    VERSION: 'development',

    GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    MICROSOFT_CLIENT_ID: import.meta.env.VITE_MICROSOFT_CLIENT_ID,

    DATADOG_CLIENT_TOKEN: import.meta.env.VITE_DATADOG_CLIENT_TOKEN,
    DATADOG_APPLICATION_ID: import.meta.env.VITE_DATADOG_APPLICATION_ID,
    DATADOG_SERVICE: import.meta.env.VITE_DATADOG_SERVICE,
    DATADOG_SITE: import.meta.env.VITE_DATADOG_SITE,

    CONFIG_CAT_SDK_KEY: import.meta.env.VITE_CONFIG_CAT_SDK_KEY,
    PRODUCT_NAME: import.meta.env.VITE_PRODUCT_NAME,

    AMPLITUDE_API_KEY: import.meta.env.VITE_AMPLITUDE_API_KEY,
  };
}

const defaults: Partial<BuildEnvironment> = {
  PRODUCT_NAME: 'Platform Orchestrator',
  DEPLOYMENT_MODE: 'saas',

  // Hosted from https://github.com/stellwerk-labs/developer-docs.
  DOCS_BASE_URL: '',
};

// Set defaults, if not set in env
const env = (window as any).env ?? {};
for (const [key, value] of Object.entries(defaults)) {
  if (env[key] == null) env[key] = value;
}

// We are casting, not parsing the env vars. We should set up mini zod
// to check types properly here.
export const windowEnv: BuildEnvironment = env;
