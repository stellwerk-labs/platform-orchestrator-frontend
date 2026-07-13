import { useCallback, useRef, useState } from 'react';

const DEFAULT_PAGE_SIZE = 20;

interface UseTokenPaginationOptions {
  defaultPageSize?: number;
}

interface UseTokenPaginationReturn {
  currentPage: number;
  pageSize: number;
  /** Token to pass to the API for the current page */
  pageToken: string | undefined;

  /** Call when navigating to a new page. Pass the nextPageToken from current API response. */
  goToPage: (page: number, nextPageToken: string | undefined) => void;
  setPageSize: (size: number) => void;
  reset: () => void;
}

/**
 * Manages token-based (cursor) pagination state.
 *
 * Usage:
 * ```
 * const { currentPage, pageSize, pageToken, goToPage, setPageSize, reset } = useTokenPagination();
 * const { data } = useQuery({ page: pageToken, per_page: pageSize });
 *
 * // In table onChange:
 * goToPage(newPage, data.next_page_token);
 * ```
 */
export function useTokenPagination(
  options: UseTokenPaginationOptions = {},
): UseTokenPaginationReturn {
  const { defaultPageSize = DEFAULT_PAGE_SIZE } = options;

  const [pageSize, setPageSizeState] = useState(defaultPageSize);
  const [currentPage, setCurrentPage] = useState(1);
  // Token for each page: index 0 = page 1 (undefined), index 1 = page 2 token, etc.
  const pageTokensRef = useRef<(string | undefined)[]>([undefined]);

  const pageToken = pageTokensRef.current[currentPage - 1];

  const reset = useCallback(() => {
    pageTokensRef.current = [undefined];
    setCurrentPage(1);
  }, []);

  const goToPage = useCallback(
    (page: number, nextPageToken: string | undefined) => {
      if (page === currentPage) return;

      // Store next page token when going forward
      if (page > currentPage && nextPageToken) {
        pageTokensRef.current[page - 1] = nextPageToken;
      }

      setCurrentPage(page);
    },
    [currentPage],
  );

  const setPageSize = useCallback(
    (size: number) => {
      if (size !== pageSize) {
        setPageSizeState(size);
        reset();
      }
    },
    [pageSize, reset],
  );

  return {
    currentPage,
    pageSize,
    pageToken,
    goToPage,
    setPageSize,
    reset,
  };
}
