import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import './i18n/i18n';

import { msalConfig } from './auth/msalConfig';
import { features } from './config/features';
import { router } from './router/routes';
import * as serviceWorker from './serviceWorker';
import { getCookieConsent } from './utilities/local-storage';
import { initializeDatadog } from './utilities/monitoring';
import { initializeAmplitude, shouldEnableSessionReplay } from './utilities/tracking';

const canEnableSessionReplay =
  shouldEnableSessionReplay &&
  !window.location.pathname.startsWith('/auth/login') &&
  !window.location.pathname.startsWith('/auth/register');

if (features.amplitude && getCookieConsent() === 'accepted') {
  initializeAmplitude(canEnableSessionReplay);
}

if (features.datadog) {
  initializeDatadog();
}

const container = document.getElementById('root');
const root = createRoot(container!);

if (features.socialLogins) {
  const msalInstance = new PublicClientApplication(msalConfig);
  root.render(
    <MsalProvider instance={msalInstance}>
      <RouterProvider router={router} />
    </MsalProvider>,
  );
} else {
  root.render(<RouterProvider router={router} />);
}

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
