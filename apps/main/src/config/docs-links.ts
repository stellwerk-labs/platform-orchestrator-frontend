import { windowEnv } from './environment';

const BASE_URL = windowEnv.DOCS_BASE_URL;
const UTM = '?utm_source=product&utm_medium=empty_state';

export const DOCS_HELP = `${BASE_URL}/getting-started/help/`;
export const DOCS_SSO = `${BASE_URL}/platform-orchestrator/security/authentication/#single-sign-on-sso`;

export const DOCS_CLI = `${BASE_URL}/platform-orchestrator/docs/integrations/cli/`;

export const DOCS_GET_STARTED_EMPTY_STATE = `${BASE_URL}/platform-orchestrator/docs/tutorial/get-started${UTM}`;

export const DOCS_PROJECTS = `${BASE_URL}/platform-orchestrator/docs/configure/projects${UTM}`;
export const DOCS_MODULES = `${BASE_URL}/platform-orchestrator/docs/configure/modules${UTM}`;
export const DOCS_ENVIRONMENT_TYPES = `${BASE_URL}/platform-orchestrator/docs/configure/environment-types${UTM}`;

export const DOCS_RESOURCE_TYPES_EMPTY_STATE = `${BASE_URL}/platform-orchestrator/docs/configure/resource-types${UTM}`;
export const DOCS_RUNNERS = `${BASE_URL}/platform-orchestrator/docs/configure/runners${UTM}`;
export const DOCS_PROVIDERS = `${BASE_URL}/platform-orchestrator/docs/configure/providers${UTM}`;
