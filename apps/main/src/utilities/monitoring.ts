import { datadogRum } from '@datadog/browser-rum';

import { windowEnv } from '@src/config/environment';

// 100 = record all sessions
const DATADOG_SESSION_SAMPLE_RATE = 100;

export const initializeDatadog = () => {
  datadogRum.init({
    // RUM application
    applicationId: windowEnv.DATADOG_APPLICATION_ID,
    clientToken: windowEnv.DATADOG_CLIENT_TOKEN,
    // EU region — change to 'datadoghq.com' for US
    site: windowEnv.DATADOG_SITE,
    // Must match the service name configured in Datadog
    service: windowEnv.DATADOG_SERVICE,
    env: windowEnv.ENVIRONMENT_NAME,
    version: windowEnv.VERSION,
    sessionSampleRate: DATADOG_SESSION_SAMPLE_RATE,
  });
};

export const trackError = (error: unknown, context?: object) => {
  datadogRum.addError(error, context);
};
