import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { fetchAllPages, getAllPagesQueryKey, useAllPages } from './useFetchAllPages';

describe('getAllPagesQueryKey', () => {
  it('prefixes query key with all-pages', () => {
    const result = getAllPagesQueryKey(['/orgs/my-org/roles']);
    expect(result).toEqual(['all-pages', '/orgs/my-org/roles']);
  });

  it('handles query keys with params', () => {
    const result = getAllPagesQueryKey(['/orgs/my-org/roles', { per_page: 50 }]);
    expect(result).toEqual(['all-pages', '/orgs/my-org/roles', { per_page: 50 }]);
  });
});

describe('fetchAllPages', () => {
  it('fetches single page when no next_page_token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      items: [{ id: 1 }, { id: 2 }],
    });

    const result = await fetchAllPages(mockFetch);

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith({ per_page: 100, page: undefined });
  });

  it('fetches multiple pages until no next_page_token', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }, { id: 2 }],
        next_page_token: 'token1',
      })
      .mockResolvedValueOnce({
        items: [{ id: 3 }, { id: 4 }],
        next_page_token: 'token2',
      })
      .mockResolvedValueOnce({
        items: [{ id: 5 }],
      });

    const result = await fetchAllPages(mockFetch);

    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch).toHaveBeenNthCalledWith(1, { per_page: 100, page: undefined });
    expect(mockFetch).toHaveBeenNthCalledWith(2, { per_page: 100, page: 'token1' });
    expect(mockFetch).toHaveBeenNthCalledWith(3, { per_page: 100, page: 'token2' });
  });

  it('preserves order of items across pages', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        items: ['a', 'b'],
        next_page_token: 'token1',
      })
      .mockResolvedValueOnce({
        items: ['c', 'd'],
      });

    const result = await fetchAllPages(mockFetch);

    expect(result).toEqual(['a', 'b', 'c', 'd']);
  });

  it('passes params to fetch function and allows overriding per_page', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      items: [{ id: 1 }],
    });

    await fetchAllPages(mockFetch, { per_page: 50, filter: 'test' });

    expect(mockFetch).toHaveBeenCalledWith({ per_page: 50, filter: 'test', page: undefined });
  });

  it('returns empty array when no items', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      items: [],
    });

    const result = await fetchAllPages(mockFetch);

    expect(result).toEqual([]);
  });
});

describe('useAllPages', () => {
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

  it('fetches all pages and returns combined items', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }],
        next_page_token: 'token1',
      })
      .mockResolvedValueOnce({
        items: [{ id: 2 }],
      });

    const { result } = renderHook(() => useAllPages(['test-key'], mockFetch), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('passes params to fetch function', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      items: [{ id: 1 }],
    });

    const { result } = renderHook(() => useAllPages(['test-key'], mockFetch, { filter: 'test' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith({ per_page: 100, filter: 'test', page: undefined });
  });

  it('respects query options like enabled', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      items: [{ id: 1 }],
    });

    const { result } = renderHook(
      () => useAllPages(['test-key'], mockFetch, undefined, { enabled: false }),
      {
        wrapper: createWrapper(),
      },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
