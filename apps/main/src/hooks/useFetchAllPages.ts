import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';

type PageResponse<T> = { items: T[]; next_page_token?: string };
type FetchFn<T, P> = (params: P & { page?: string; per_page?: number }) => Promise<PageResponse<T>>;

const DEFAULT_PER_PAGE = 100;

/**
 * Wraps an existing query key to create a distinct key for all-pages queries.
 */
export const getAllPagesQueryKey = <T extends readonly unknown[]>(queryKey: T) =>
  ['all-pages', ...queryKey] as const;

/**
 * Fetches all pages from a paginated API endpoint.
 * Items are returned in the order received from the API, preserving server-side sorting.
 * Uses per_page=100 by default to minimize the number of requests.
 */
export async function fetchAllPages<T, P extends object = object>(
  fetchFn: FetchFn<T, P>,
  params?: P,
): Promise<T[]> {
  const allItems: T[] = [];
  let pageToken: string | undefined;

  do {
    const response = await fetchFn({
      per_page: DEFAULT_PER_PAGE,
      ...params,
      page: pageToken,
    } as P & { page?: string; per_page?: number });
    // Being extra defensive due to the global nature of this function
    allItems.push(...(response.items ?? []));
    pageToken = response.next_page_token;
  } while (pageToken);

  return allItems;
}

/**
 * React Query hook that fetches all pages from a paginated API endpoint.
 * Items are returned in the order received from the API, preserving server-side sorting.
 */
export function useAllPages<T, P extends object = object>(
  queryKey: readonly unknown[],
  fetchFn: FetchFn<T, P>,
  params?: P,
  options?: Omit<UseQueryOptions<T[]>, 'queryKey' | 'queryFn'>,
): UseQueryResult<T[]> {
  return useQuery({
    queryKey: [...queryKey],
    queryFn: () => fetchAllPages(fetchFn, params),
    ...options,
  });
}
