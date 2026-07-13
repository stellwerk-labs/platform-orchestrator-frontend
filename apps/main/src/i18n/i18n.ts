import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import enOrgMembers from './locales/en/org-members.json';
import enViewApplication from './locales/en/view-application.json';
import enViewApplicationList from './locales/en/view-application-list.json';
import enViewDeployment from './locales/en/view-deployment.json';
import enViewEnvironment from './locales/en/view-environment.json';
import enWorkloadProfile from './locales/en/workload-profile.json';

export const defaultNS = 'common';

export const resources = {
  en: {
    common: enCommon,
    workloadProfile: enWorkloadProfile,
    viewApplicationList: enViewApplicationList,
    viewApplication: enViewApplication,
    viewEnvironment: enViewEnvironment,
    viewDeployment: enViewDeployment,
    orgMembers: enOrgMembers,
  },
} as const;

i18n
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    returnObjects: true,
    keySeparator: false, // we do not use keys in form messages.welcome
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    ns: ['common', 'workloadProfile'],
    defaultNS,
  });

export { i18n };
