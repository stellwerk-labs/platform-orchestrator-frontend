import { QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { useLocation } from 'react-router';
import { expect, it } from 'vitest';

import {
  getGetModuleProviderQueryKey,
  getListModuleProvidersQueryKey,
} from '@src/hooks/react-query/v2/controlplane/providers/providers';
import { getCheckPermissionsQueryKey } from '@src/hooks/react-query/v2/iam/user/user';
import { getAllPagesQueryKey } from '@src/hooks/useFetchAllPages';
import { RBACPermission } from '@src/hooks/useRBAC';
import { MockProviders } from '@src/testing-utils/MockProviders';

import { ProviderDetails } from './ProviderDetails';

const Location = () => <span data-testid={'location'}>{useLocation().pathname}</span>;

// Use real Query cache state: an unsuccessful poll retains the previous data.
// Server deletion and authorization are covered by real Core acceptance tests.
it('leaves a cached pending Provider after confirmed removal and refreshes the list', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { enabled: false, staleTime: Infinity, retry: false } },
  });
  const key = getGetModuleProviderQueryKey('fixture', 'random', 'fixture');
  const listKey = getAllPagesQueryKey(getListModuleProvidersQueryKey('fixture'));
  client.setQueryData(key, {
    id: 'fixture',
    provider_type: 'random',
    source: 'hashicorp/random',
    created_at: '2026-11-11T07:00:00Z',
    deletion_requested_at: '2026-11-11T07:10:00Z',
  });
  client.setQueryData(listKey, []);
  const check = {
    resource: 'organization:fixture',
    permission: RBACPermission.MODULE_PROVIDER_WRITE,
  };
  client.setQueryData(getCheckPermissionsQueryKey([check]), {
    items: [{ permission_check: check, allowed: true }],
  });
  const view = render(
    <MockProviders
      queryClient={client}
      route={{
        path: '/orgs/:orgId/providers/:providerType?/:providerId?',
        url: '/orgs/fixture/providers/random/fixture',
      }}>
      <ProviderDetails />
      <Location />
    </MockProviders>,
  );
  try {
    expect(await screen.findByRole('button', { name: 'Deletion pending' })).toBeDisabled();
    const error = new AxiosError('Not found', undefined, undefined, undefined, {
      status: 404,
      statusText: 'Not Found',
      data: {},
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    await act(async () => {
      client.getQueryCache().find({ queryKey: key })!.setState({ error, status: 'error' });
    });
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/orgs/fixture/providers');
      expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
      expect(screen.queryByRole('button', { name: 'Deletion pending' })).not.toBeInTheDocument();
    });
  } finally {
    view.unmount();
    client.clear();
  }
});
