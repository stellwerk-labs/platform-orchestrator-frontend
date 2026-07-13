import { create } from 'zustand';

import { setUserPreferencereInLS } from '@src/utilities/local-storage';

export type Theme = 'dark' | 'light';
export type UserPreferences = {
  theme: Theme | null;
  openContactForm: boolean;
};
interface userPreferencesStore extends UserPreferences {
  setTheme: (theme: Theme) => void;
  setOpenContactForm: (openContactForm: boolean) => void;
  syncLocalStorageToUserPreferences: (userPreferences: UserPreferences) => void;
}

export const useUserPreferencesStore = create<userPreferencesStore>((set, getState) => {
  return {
    theme: null,
    openContactForm: false,
    setTheme: (theme) =>
      set(() => {
        setUserPreferencereInLS({
          ...getState(),
          theme,
        });
        return {
          theme,
        };
      }),
    setOpenContactForm: (openContactForm) =>
      set(() => {
        setUserPreferencereInLS({
          ...getState(),
          openContactForm,
        });
        return {
          openContactForm,
        };
      }),
    syncLocalStorageToUserPreferences: (userPreferences) => {
      set(() => ({
        ...userPreferences,
      }));
    },
  };
});
