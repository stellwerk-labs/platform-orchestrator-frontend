type BuildEnvironmentNames = 'local' | 'development' | 'staging' | 'production';
type DeploymentMode = 'saas' | 'self-hosted';

// Non-secret config
export interface BuildEnvironment {
  BASE_URL: string;
  ENVIRONMENT_NAME: BuildEnvironmentNames;
  DEPLOYMENT_MODE: DeploymentMode;
  VERSION: string;

  GOOGLE_CLIENT_ID: string;
  MICROSOFT_CLIENT_ID: string;

  DATADOG_CLIENT_TOKEN: string;
  DATADOG_APPLICATION_ID: string;
  DATADOG_SERVICE: string;
  DATADOG_SITE: string;

  CONFIG_CAT_SDK_KEY: string;
  PRODUCT_NAME: string;

  AMPLITUDE_API_KEY: string;

  TERMS_URL: string;
  PRIVACY_URL: string;
  DOCS_BASE_URL: string;
  DOCS_URL: string;
  TUTORIAL_URL: string;
  SUPPORT_URL: string;
  STATUS_URL: string;
  SUPPORT_EMAIL: string;
}
