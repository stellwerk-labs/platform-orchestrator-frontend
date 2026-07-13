import * as amplitude from '@amplitude/analytics-browser';
import { sessionReplayPlugin } from '@amplitude/plugin-session-replay-browser';

import { windowEnv } from '@src/config/environment';

import { checkUserAgentIsMobile } from './check-mobile';

export const shouldEnableSessionReplay = !checkUserAgentIsMobile();

export const initializeAmplitude = (enableSessionReplay: boolean = shouldEnableSessionReplay) => {
  const apiKey = windowEnv.AMPLITUDE_API_KEY;
  if (!apiKey) return;

  if (enableSessionReplay) {
    amplitude.add(sessionReplayPlugin({ sampleRate: 100 }));
  }
  amplitude.init(apiKey, {
    autocapture: {
      attribution: true,
      fileDownloads: true,
      formInteractions: true,
      pageViews: true,
      sessions: true,
      elementInteractions: true,
      networkTracking: false,
      webVitals: true,
      frustrationInteractions: true,
    },
    trackingOptions: {
      ipAddress: false,
    },
    serverZone: 'EU',
  });
  amplitude.setOptOut(false);
};

export const optOutAmplitude = () => {
  amplitude.setOptOut(true);
  amplitude.reset();
  removeAmplitudeCookies();
};

// Taken from https://amplitude.com/docs/sdks/analytics/browser/cookies-and-consent-management#remove-amplitude-cookies
const removeAmplitudeCookies = () => {
  const apiKey = windowEnv.AMPLITUDE_API_KEY;
  if (!apiKey) return;

  const cookieName = `AMP_${apiKey.substring(0, 10)}`;
  const cookieNameMktg = `AMP_MKTG_${apiKey.substring(0, 10)}`;
  const cookies = document.cookie.split(';');

  cookies.forEach((cookie) => {
    const [name] = cookie.trim().split('=');

    if (name === cookieName || name === cookieNameMktg) {
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    }
  });
};
