import * as amplitude from '@amplitude/analytics-browser';
import { OpenFeature, OpenFeatureProvider } from '@openfeature/react-sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { App as AntApp, ConfigProvider, Flex, Modal } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useMatches, useNavigate, useParams } from 'react-router';

import 'styles/global.css';

import { LoadingBar } from '@src/components/shared/ui/LoadingBar/LoadingBar';
import { useUserPreferencesStore } from '@src/hooks/zustand/useUserPreferencesStore';
import { darkHighContrastTheme, lightHighContrastTheme } from '@src/styles/themes';
import {
  getUserPreferencesFromLS,
  removeLastVisitedApp,
  removeSelectedOrganization,
  setLastVisitedURL,
} from '@src/utilities/local-storage';

import { CookieConsent } from './components/shared/CookieConsent';
import { features } from './config/features';
import { provider } from './config/openfeature';
import { MatchParams } from './config/routing';
import { useWalhallContext, WalhallContext } from './context/walhallContext';
import { AXIOS_INSTANCE } from './custom-instance';
import { useGetCurrentUser } from './hooks/react-query/v2/iam/user/user';

OpenFeature.setProvider(provider);

const AppMain = () => {
  const { pendingRequests } = useWalhallContext();

  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  const { data: currentUser } = useGetCurrentUser();

  useEffect(() => {
    const context: { targetingKey?: string; orgId?: string; email?: string } = {};

    context.orgId = orgId;

    context.targetingKey = currentUser?.id;
    context.email = currentUser?.primary_email_address;

    OpenFeature.setContext(context);
  }, [currentUser, orgId]);

  useEffect(() => {
    if (!features.amplitude) return;

    if (currentUser) {
      amplitude.setUserId(currentUser?.id);
    }
  }, [currentUser]);

  const location = useLocation();

  const matches = useMatches();
  const last = matches[matches.length - 1];
  const isWildcard = (last?.handle as { isWildcard: boolean })?.isWildcard;

  useEffect(() => {
    if (
      !location.pathname.startsWith('/auth/') &&
      !location.pathname.startsWith('/sso/') &&
      location.pathname !== '/' &&
      !isWildcard
    ) {
      setLastVisitedURL(`${location.pathname}${location.search}${location.hash}`);
    }
  }, [location.pathname, location.search, location.hash, isWildcard]);

  const showLoadingBar = useMemo(() => pendingRequests !== 0, [pendingRequests]);

  return (
    <Flex vertical>
      {showLoadingBar && <LoadingBar />}
      <Outlet />
    </Flex>
  );
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000,
      retry: 0,
    },
  },
});

export const App = () => {
  // Routing State
  const [shouldConfirmOnNavigate, setShouldConfirmOnNavigate] = useState(false);
  const [showNavigateDialog, setShowNavigateDialog] = useState(false);
  const [nextRoute, setNextRoute] = useState<null | string>(null);

  const navigate = useNavigate();
  const [pendingRequests, setPendingRequests] = useState<number>(0);
  const { t } = useTranslation();
  const uiTranslations = t('UI');

  // Zustand
  const { setTheme, theme, syncLocalStorageToUserPreferences } = useUserPreferencesStore();

  const resetRoutingState = (isCancel?: boolean) => {
    setShowNavigateDialog(false);
    setNextRoute(null);
    if (!isCancel) {
      setShouldConfirmOnNavigate(false);
    }
  };

  useEffect(() => {
    if (showNavigateDialog) {
      Modal.confirm({
        title: 'Confirm',
        content: uiTranslations.CONFIRM_LEAVE_PAGE,
        okText: uiTranslations.LEAVE,
        onOk: () => {
          if (nextRoute) {
            navigate(nextRoute);
            resetRoutingState();
            setShowNavigateDialog(false);
          }
        },
        onCancel: () => {
          resetRoutingState(true);
          setShowNavigateDialog(false);
        },
      });
    }
  }, [
    showNavigateDialog,
    navigate,
    nextRoute,
    uiTranslations.CONFIRM_LEAVE_PAGE,
    uiTranslations.LEAVE,
  ]);

  useEffect(() => {
    // request interceptor
    AXIOS_INSTANCE.interceptors.request.use(
      (request) => {
        setPendingRequests((prev) => prev + 1);
        return request;
      },
      (error) => {
        setPendingRequests((prev) => prev - 1);
        return Promise.reject(error);
      },
    );
    // response interceptor
    AXIOS_INSTANCE.interceptors.response.use(
      (response) => {
        setPendingRequests((prev) => prev - 1);
        return response;
      },
      (error) => {
        if (
          error?.response?.status === 401 &&
          !window.location.pathname.startsWith('/auth/') &&
          !window.location.pathname.startsWith('/accept-invite') &&
          !window.location.pathname.startsWith('/sso/')
        ) {
          // Clear state
          removeSelectedOrganization();
          removeLastVisitedApp();
          // Only clear the last visited URL if it wasn't a device login.
          // NOTE: there may be other cases where we need to preserve this in the future too.
          if (!window.location.pathname.startsWith('/devicelogins/')) {
            setLastVisitedURL('/');
          }

          window.location.href = `${window.location.origin}/auth/login`;
        }
        setPendingRequests((prev) => prev - 1);
        return Promise.reject(error);
      },
    );
  }, []);

  useEffect(() => {
    const showWarningBeforeLeavePage = (event: BeforeUnloadEvent) => {
      // some browser do not allow custom messages so the browser default message will be displayed in these cases
      event.returnValue = uiTranslations.CONFIRM_LEAVE_PAGE; // for firefox;
      return uiTranslations.CONFIRM_LEAVE_PAGE;
    };
    if (shouldConfirmOnNavigate) {
      window.addEventListener('beforeunload', showWarningBeforeLeavePage);
    }

    return () => {
      window.removeEventListener('beforeunload', showWarningBeforeLeavePage);
    };
  }, [shouldConfirmOnNavigate, uiTranslations.CONFIRM_LEAVE_PAGE]);

  useEffect(() => {
    const userPrefParsed = getUserPreferencesFromLS();
    if (userPrefParsed) {
      const prefs = { ...userPrefParsed };
      if (prefs) {
        syncLocalStorageToUserPreferences(prefs);
      }
    }
  }, [syncLocalStorageToUserPreferences]);

  useEffect(() => {
    const toggleMediaTheme = () => {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme('dark');
      } else {
        setTheme('light');
      }
    };
    const themePreference = getUserPreferencesFromLS()?.theme;

    if (!themePreference) {
      toggleMediaTheme();
    } else if (themePreference && (themePreference === 'dark' || themePreference === 'light')) {
      setTheme(themePreference);
    }
    window.matchMedia('(prefers-color-scheme: dark)').addListener(() => {
      toggleMediaTheme();
    });
  }, [setTheme]);

  return (
    <OpenFeatureProvider>
      <ConfigProvider theme={theme === 'dark' ? darkHighContrastTheme : lightHighContrastTheme}>
        <AntApp>
          {theme && (
            <WalhallContext.Provider
              value={{
                shouldConfirmOnNavigateState: [shouldConfirmOnNavigate, setShouldConfirmOnNavigate],
                navigateDialogState: [showNavigateDialog, setShowNavigateDialog],
                nextRouteState: [nextRoute, setNextRoute],
                theme,
                pendingRequests,
              }}>
              <QueryClientProvider client={queryClient}>
                <AppMain />
                <ReactQueryDevtools initialIsOpen={false} />
              </QueryClientProvider>
            </WalhallContext.Provider>
          )}
          {features.amplitude && <CookieConsent />}
        </AntApp>
      </ConfigProvider>
    </OpenFeatureProvider>
  );
};
