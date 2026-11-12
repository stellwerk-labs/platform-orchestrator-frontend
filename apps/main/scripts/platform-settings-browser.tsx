import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App, ConfigProvider } from 'antd';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { Administration } from '../src/containers/Platform/Administration';
import { pluginManagerRoute } from '../src/containers/Platform/PluginManager/pluginManagerRoute';
import { platformSettingsRoute } from '../src/containers/Platform/Settings/PlatformSettings';

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider
    client={
      new QueryClient({
        defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
      })
    }>
    <ConfigProvider>
      <App>
        <RouterProvider
          router={createMemoryRouter(
            [
              {
                element: <Administration />,
                children: [pluginManagerRoute, platformSettingsRoute],
              },
            ],
            { initialEntries: ['/platform/settings'] },
          )}
        />
      </App>
    </ConfigProvider>
  </QueryClientProvider>,
);
