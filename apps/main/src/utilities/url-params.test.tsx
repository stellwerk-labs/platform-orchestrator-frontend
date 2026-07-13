/**
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { useGetUrlParam } from './url-params';

describe('useGetUrlParam', () => {
  const renderWithRouter = (initialEntries: string[]) => {
    return renderHook(() => useGetUrlParam('code'), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      ),
    });
  };

  it('should return the param value when present', () => {
    const { result } = renderWithRouter(['/?code=test-code']);
    expect(result.current).toBe('test-code');
  });

  it('should return null when param is not present', () => {
    const { result } = renderWithRouter(['/']);
    expect(result.current).toBeNull();
  });

  it('should handle inviteToken param', () => {
    const { result } = renderHook(() => useGetUrlParam('inviteToken'), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={['/?inviteToken=abc123']}>{children}</MemoryRouter>
      ),
    });
    expect(result.current).toBe('abc123');
  });

  it('should handle redirect param', () => {
    const { result } = renderHook(() => useGetUrlParam('redirect'), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={['/?redirect=/dashboard']}>{children}</MemoryRouter>
      ),
    });
    expect(result.current).toBe('/dashboard');
  });
});
