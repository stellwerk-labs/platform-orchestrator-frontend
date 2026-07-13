import { ConfigCatWebProvider } from '@openfeature/config-cat-web-provider';
import { InMemoryProvider } from '@openfeature/react-sdk';

import { windowEnv } from '@src/config/environment';

import { features } from './features';

export const provider = features.configCat
  ? ConfigCatWebProvider.create(windowEnv.CONFIG_CAT_SDK_KEY, { pollIntervalSeconds: 60 * 5 })
  : new InMemoryProvider({});
