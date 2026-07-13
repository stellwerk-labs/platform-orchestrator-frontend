import { defineNetworkFixture, type NetworkFixture } from '@msw/playwright';
import { test as testBase } from '@playwright/test';
import type { AnyHandler } from 'msw';

type Fixtures = {
  handlers: AnyHandler[];
  network: NetworkFixture;
};

export const test = testBase.extend<Fixtures>({
  // Create a fixture that will control the network in your tests.
  handlers: [[], { option: true }],
  network: [
    async ({ context, handlers }, use) => {
      const network = defineNetworkFixture({
        context: context as any,
        handlers,
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
