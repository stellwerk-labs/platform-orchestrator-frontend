import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import '@src/i18n/i18n';

import { getListModuleProvidersQueryKey } from '@src/hooks/react-query/v2/controlplane/providers/providers';
import { getListRunnersQueryKey } from '@src/hooks/react-query/v2/controlplane/runner/runner';
import { getAllPagesQueryKey } from '@src/hooks/useFetchAllPages';

import { ProvidersList } from './Providers/containers/ProvidersList';
import { RunnersList } from './Runners/containers/RunnersList';

const runner = (id: string, description: string) => ({
  id,
  description,
  created_at: '2026-11-17T10:00:00Z',
  runner_configuration: { type: 'kubernetes' },
  state_storage_configuration: { type: 's3' },
});

describe('Authorized whole-collection inventory search', () => {
  it('keeps the Runner query and type facet after a collection refresh, including case-insensitive description matches', async () => {
    const cache = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const key = getAllPagesQueryKey(getListRunnersQueryKey('org'));
    cache.setQueryData(key, [runner('east', 'Production'), runner('west', 'Development')]);
    const router = createMemoryRouter(
      [{ path: '/orgs/:orgId/runners', element: <RunnersList /> }],
      { initialEntries: ['/orgs/org/runners?q=PRODUCTION&view=kubernetes'] },
    );
    const { unmount } = render(
      <QueryClientProvider client={cache}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('link', { name: 'east' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'west' })).not.toBeInTheDocument();
    await act(async () =>
      cache.setQueryData(key, [
        runner('east', 'Production'),
        runner('new-east', 'Production recovery'),
        runner('west', 'Development'),
      ]),
    );
    expect(await screen.findByRole('link', { name: 'new-east' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'west' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search runners' })).toHaveValue('PRODUCTION');
    unmount();
    cache.clear();
  });

  it('searches Provider source metadata and combines it with deletion status', () => {
    const cache = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    cache.setQueryData(getAllPagesQueryKey(getListModuleProvidersQueryKey('org')), [
      {
        id: 'active-provider',
        provider_type: 'aws',
        source: 'hashicorp/aws',
        created_at: '2026-11-17T10:00:00Z',
      },
      {
        id: 'deleting-provider',
        provider_type: 'aws',
        source: 'hashicorp/aws',
        created_at: '2026-11-17T10:00:00Z',
        deletion_requested_at: '2026-11-17T11:00:00Z',
      },
    ]);
    const router = createMemoryRouter(
      [{ path: '/orgs/:orgId/providers', element: <ProvidersList /> }],
      { initialEntries: ['/orgs/org/providers?q=HASHICORP&view=deleting'] },
    );
    const { unmount } = render(
      <QueryClientProvider client={cache}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('link', { name: 'deleting-provider' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'active-provider' })).not.toBeInTheDocument();
    unmount();
    cache.clear();
  });
});
