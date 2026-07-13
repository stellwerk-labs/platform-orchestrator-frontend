import { InMemoryProvider, OpenFeature, OpenFeatureProvider } from '@openfeature/react-sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createMemoryRouter, RouterProvider, useNavigate } from 'react-router';

import { WalhallContext } from '@src/context/walhallContext';
import { i18n } from '@src/i18n/i18n';
import { RouteHandle } from '@src/types/router';
import { getSharedBreadcrumbs } from '@src/utilities/breadcrumbs-utils';

const MOCK_PROVIDERS_DEFAULT_URL = '/my-org/my-def/my-project/my-env/my-module/my-user/test-code';

interface MockProvidersProps {
  children: ReactNode;
  route?: {
    // Definition with params e.g. /orgs/:orgId
    path?: string;
    // The browser url
    url?: string;
    handle?: RouteHandle;
    searchParams?: string;
  };
  disableThemeProvider?: boolean;
  queryClient?: QueryClient;
  theme?: 'dark' | 'light';
}

const Inner = ({
  children,
  theme,
  queryClient,
  url,
}: MockProvidersProps & {
  url: string | undefined;
  queryClient: QueryClient;
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (url) {
      navigate(url);
    }
  }, [navigate, url]);

  return (
    <WalhallContext.Provider
      value={{
        shouldConfirmOnNavigateState: [false, () => null],
        nextRouteState: [null, () => null],
        navigateDialogState: [false, () => false],
        theme,
      }}>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
      </QueryClientProvider>
    </WalhallContext.Provider>
  );
};

const mockProvider = new InMemoryProvider({});
OpenFeature.setProvider(mockProvider);

export const MockProviders = (props: MockProvidersProps) => {
  const { disableThemeProvider, route } = props;

  const url = `${route?.url || MOCK_PROVIDERS_DEFAULT_URL}${route?.searchParams ? `?${route.searchParams}` : ''}`;

  const queryClient =
    props.queryClient ||
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

  const router = createMemoryRouter(
    [
      {
        path: route?.path || '/:orgId/:defId/:projectId/:envId/:moduleId/:userId/:deviceLoginCode',
        handle: route?.handle
          ? route.handle
          : {
              crumbs: (match: any, data: any) => getSharedBreadcrumbs(match, data),
            },
        element: disableThemeProvider ? (
          <Inner {...props} url={url} queryClient={queryClient} />
        ) : (
          <Inner {...props} url={url} queryClient={queryClient} />
        ),
      },
    ],
    {
      initialEntries: [url],
    },
  );

  return (
    <OpenFeatureProvider>
      <RouterProvider router={router} />
    </OpenFeatureProvider>
  );
};
