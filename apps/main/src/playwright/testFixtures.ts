import { defineNetworkFixture, type NetworkFixture } from '@msw/playwright';
import { test as testBase } from '@playwright/test';
import { type AnyHandler, http, HttpResponse } from 'msw';

type Fixtures = {
  handlers: AnyHandler[];
  network: NetworkFixture;
};

export const test = testBase.extend<Fixtures>({
  // Create a fixture that will control the network in your tests.
  handlers: [[], { option: true }],
  network: [
    async ({ context, handlers }, use) => {
      const idleTimeout = 15 * 60 * 1000;
      let expiresAt = Date.now() + idleTimeout;
      const session = () => ({
        user_id: 'playwright-user',
        idle_timeout_ms: idleTimeout,
        server_time: new Date().toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
      });
      const network = defineNetworkFixture({
        context: context as any,
        handlers: [
          ...handlers,
          http.get('http://example.com/auth/session', () =>
            Date.now() >= expiresAt
              ? new HttpResponse(null, { status: 401 })
              : HttpResponse.json(session()),
          ),
          http.post('http://example.com/auth/session/activity', ({ request }) => {
            if (Date.now() >= expiresAt) return new HttpResponse(null, { status: 401 });
            if (request.headers.get('X-Session-Activity') !== '1')
              return new HttpResponse(null, { status: 400 });
            expiresAt = Date.now() + idleTimeout;
            return HttpResponse.json(session());
          }),
        ],
      });

      await network.enable();
      await use(network);
      await network.disable();
    },
    { auto: true },
  ],
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('cookieConsent', 'declined');
    });
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },
});
