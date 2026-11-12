import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '@src/testing-utils/mswServer';
import { answerPermissionChecks } from '@src/testing-utils/permissionChecks';

import { Administration } from './Administration';

const show = (permissions: string[], path = '/platform') => {
  server.use(
    answerPermissionChecks(
      ({ resource, permission }) => resource === 'platform' && permissions.includes(permission),
    ),
  );
  const router = createMemoryRouter(
    [
      {
        element: <Administration />,
        children: [
          { path: 'platform', element: null },
          { path: 'platform/plugins', element: <p>Plugin installations</p> },
          { path: 'platform/settings', element: <p>Session and maintenance configuration</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
};

describe('Administration', () => {
  it('groups both sections in route-backed tabs', async () => {
    const router = show(['plugin_manager_read', 'platform_settings_read']);
    expect(await screen.findByText('Plugin installations')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Configuration' }));
    expect(await screen.findByText('Session and maintenance configuration')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/platform/settings');
    expect(screen.getByRole('tab', { name: 'Configuration' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('opens Configuration directly when only settings access is granted', async () => {
    show(['platform_settings_read']);
    expect(await screen.findByText('Session and maintenance configuration')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Plugin Manager' })).not.toBeInTheDocument();
  });

  it('keeps existing plugin detail bookmarks inside the Plugins tab', async () => {
    show(['plugin_manager_read'], '/platform/plugins');
    expect(await screen.findByRole('tab', { name: 'Plugin Manager' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByRole('tab', { name: 'Configuration' })).not.toBeInTheDocument();
  });

  it('does not mount administration sections without platform permission', async () => {
    show([]);
    expect(await screen.findByText('Administration is restricted')).toBeInTheDocument();
    expect(screen.queryByText('Plugin installations')).not.toBeInTheDocument();
  });
});
