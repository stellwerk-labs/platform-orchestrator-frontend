import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { EnvironmentPage, EnvironmentStatus } from '@src/models/v2/controlplane';

import { useEnvironmentLookup } from './useEnvironmentLookup';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useEnvironmentLookup', () => {
  it('returns environment by uuid after fetching all environments', async () => {
    const mockEnvironments: EnvironmentPage = {
      items: [
        {
          id: 'env-1',
          uuid: 'uuid-1',
          project_id: 'project-1',
          env_type_id: 'development',
          display_name: 'Development',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          status: EnvironmentStatus.active,
        },
        {
          id: 'env-2',
          uuid: 'uuid-2',
          project_id: 'project-2',
          env_type_id: 'production',
          display_name: 'Production',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          status: EnvironmentStatus.active,
        },
      ],
    };

    server.use(
      http.get('*/orgs/:orgId/envs', () => {
        return HttpResponse.json(mockEnvironments);
      }),
    );

    const { result } = renderHook(() => useEnvironmentLookup('test-org'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isEnvironmentLookupLoading).toBe(false));

    expect(result.current.findEnvironmentByUuid('uuid-1')).toEqual(mockEnvironments.items[0]);
    expect(result.current.findEnvironmentByUuid('uuid-2')).toEqual(mockEnvironments.items[1]);
    expect(result.current.findEnvironmentByUuid('non-existent')).toBeNull();
  });

  it('fetches all pages of environments', async () => {
    const page1Environment = {
      id: 'env-1',
      uuid: 'uuid-1',
      project_id: 'project-1',
      env_type_id: 'development',
      display_name: 'Development',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      status: EnvironmentStatus.active,
    };

    const page2Environment = {
      id: 'env-2',
      uuid: 'uuid-2',
      project_id: 'project-2',
      env_type_id: 'production',
      display_name: 'Production',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      status: EnvironmentStatus.active,
    };

    server.use(
      http.get('*/orgs/:orgId/envs', ({ request }) => {
        const url = new URL(request.url);
        const pageToken = url.searchParams.get('page');

        if (!pageToken) {
          return HttpResponse.json({
            items: [page1Environment],
            next_page_token: 'page2',
          });
        }

        return HttpResponse.json({
          items: [page2Environment],
        });
      }),
    );

    const { result } = renderHook(() => useEnvironmentLookup('test-org'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isEnvironmentLookupLoading).toBe(false));

    expect(result.current.findEnvironmentByUuid('uuid-1')).toEqual(page1Environment);
    expect(result.current.findEnvironmentByUuid('uuid-2')).toEqual(page2Environment);
  });
});
