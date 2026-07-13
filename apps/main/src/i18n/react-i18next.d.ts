import { defaultNS, resources } from './i18n';

declare module 'i18next' {
  interface CustomTypeOptions {
    returnObjects: true;
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['en'];
  }
}
