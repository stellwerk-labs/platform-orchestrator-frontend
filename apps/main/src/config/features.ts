import { windowEnv } from '@src/config/environment';

export const isSelfHosted = windowEnv.DEPLOYMENT_MODE === 'self-hosted';
export const isSaaS = windowEnv.DEPLOYMENT_MODE === 'saas';

const isProduction = windowEnv.ENVIRONMENT_NAME === 'production';
export const isLocal = windowEnv.ENVIRONMENT_NAME === 'local';

// windowEnv env vars always should be defined, but we need to
// check if they are empty strings or not
export const hasValue = (s: string | undefined): boolean => !!s?.trim();

export const features = {
  configCat: isSaaS && hasValue(windowEnv.CONFIG_CAT_SDK_KEY),
  amplitude: isSaaS && isProduction && hasValue(windowEnv.AMPLITUDE_API_KEY),
  socialLogins:
    isSaaS && hasValue(windowEnv.MICROSOFT_CLIENT_ID) && hasValue(windowEnv.GOOGLE_CLIENT_ID),
  invites: isSaaS,
  datadog:
    isSaaS &&
    !isLocal &&
    hasValue(windowEnv.DATADOG_CLIENT_TOKEN) &&
    hasValue(windowEnv.DATADOG_APPLICATION_ID) &&
    hasValue(windowEnv.DATADOG_SERVICE) &&
    hasValue(windowEnv.DATADOG_SITE),
} satisfies Record<string, boolean>;
