import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useTokenPagination } from './useTokenPagination';

describe('useTokenPagination', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useTokenPagination());

    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(20);
    expect(result.current.pageToken).toBeUndefined();
  });

  it('should accept custom default page size', () => {
    const { result } = renderHook(() => useTokenPagination({ defaultPageSize: 50 }));

    expect(result.current.pageSize).toBe(50);
  });

  it('should navigate forward and store token', () => {
    const { result } = renderHook(() => useTokenPagination());

    act(() => {
      result.current.goToPage(2, 'token-for-page-2');
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.pageToken).toBe('token-for-page-2');
  });

  it('should navigate backward using stored token', () => {
    const { result } = renderHook(() => useTokenPagination());

    // Go to page 2
    act(() => {
      result.current.goToPage(2, 'token-for-page-2');
    });

    // Go to page 3
    act(() => {
      result.current.goToPage(3, 'token-for-page-3');
    });

    // Go back to page 2 - should use stored token, not the new one passed
    act(() => {
      result.current.goToPage(2, 'token-for-page-4');
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.pageToken).toBe('token-for-page-2');
  });

  it('should reset pagination', () => {
    const { result } = renderHook(() => useTokenPagination());

    act(() => {
      result.current.goToPage(2, 'token-for-page-2');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageToken).toBeUndefined();
  });

  it('should reset pagination when page size changes', () => {
    const { result } = renderHook(() => useTokenPagination());

    act(() => {
      result.current.goToPage(2, 'token-for-page-2');
    });

    act(() => {
      result.current.setPageSize(50);
    });

    expect(result.current.pageSize).toBe(50);
    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageToken).toBeUndefined();
  });
});
