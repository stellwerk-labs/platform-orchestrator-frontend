import { UserPreferences } from '@src/hooks/zustand/useUserPreferencesStore';

import {
  LS_COOKIE_CONSENT,
  LS_INVITE_TOKEN,
  LS_LAST_VISITED_APP,
  LS_LAST_VISITED_URL,
  LS_NAVIGATION_MINIMIZED,
  LS_SELECTED_ORGANIZATION,
  LS_USER_PREFERENCES,
} from './variables';

/**
 * Returns the selected organization.
 */
export const getSelectedOrganization = (): string | null => {
  return localStorage.getItem(LS_SELECTED_ORGANIZATION);
};

export const getUserPreferencesFromLS = (): UserPreferences | null => {
  const preferences = localStorage.getItem(LS_USER_PREFERENCES);
  return preferences && JSON.parse(preferences);
};

export const setUserPreferencereInLS = (userPreferences: UserPreferences): void => {
  localStorage.setItem(LS_USER_PREFERENCES, JSON.stringify(userPreferences));
};

/**
 * Sets the selected organization.
 */
export const setSelectedOrganization = (organizationUuid: string): void => {
  localStorage.setItem(LS_SELECTED_ORGANIZATION, organizationUuid);
};

/**
 * Clears the selected organization.
 */
export const removeSelectedOrganization = (): void => {
  localStorage.removeItem(LS_SELECTED_ORGANIZATION);
};

/**
 * Gets lastVisitedApp.
 */
export const getLastVisitedApp = (): string | null => {
  return localStorage.getItem(LS_LAST_VISITED_APP);
};

/**
 * Sets lastVisitedApp.
 */
export const setLastVisitedApp = (projectId: string): void => {
  localStorage.setItem(LS_LAST_VISITED_APP, projectId);
};

/**
 * Removes lastVisitedApp.
 */
export const removeLastVisitedApp = (): void => {
  localStorage.removeItem(LS_LAST_VISITED_APP);
};

/**
 * Gets lastVisitedURL.
 */
export const getLastVisitedURL = (): string | null => {
  return localStorage.getItem(LS_LAST_VISITED_URL);
};

/**
 * Sets lastVisitedURL.
 */
export const setLastVisitedURL = (url: string): void => {
  localStorage.setItem(LS_LAST_VISITED_URL, url);
};

/**
 * Sets InviteToken.
 */
export const setInviteToken = (inviteToken: string): void => {
  localStorage.setItem(LS_INVITE_TOKEN, inviteToken);
};

/**
 * Returns if the navigation menu is minimized.
 */
export const getNavigationMenuMinimized = (): boolean => {
  return Boolean(localStorage.getItem(LS_NAVIGATION_MINIMIZED) === 'true');
};

/**
 * Returns cookie consent.
 */
export const getCookieConsent = (): string | null => {
  return localStorage.getItem(LS_COOKIE_CONSENT);
};

/**
 * Sets cookie consent.
 */
export const setCookieConsent = (acceptendOrDeclined: 'accepted' | 'declined'): void => {
  localStorage.setItem(LS_COOKIE_CONSENT, acceptendOrDeclined);
};
