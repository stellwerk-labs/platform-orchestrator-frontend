import { Configuration, LogLevel } from '@azure/msal-browser';

import { windowEnv } from '@src/config/environment';
import { trackError } from '@src/utilities/monitoring';

export const msalConfig: Configuration = {
  auth: {
    clientId: windowEnv.MICROSOFT_CLIENT_ID,
    redirectUri: '/',
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        // PII: Personally Identifiable Information
        if (containsPii) {
          return;
        }

        switch (level) {
          case LogLevel.Error:
            trackError(new Error(`MSAL Error: ${message}`));
            return;
          default:
            return;
        }
      },
    },
  },
};
