import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  getListOrgMembershipsQueryKey,
  listOrgMemberships,
} from '@src/hooks/react-query/v2/iam/membership/membership';
import {
  getListServiceUsersQueryKey,
  listServiceUsers,
} from '@src/hooks/react-query/v2/iam/service-user/service-user';
import { useAllPages } from '@src/hooks/useFetchAllPages';

import { useUserDetails } from './useUserDetails';

// Mock the react-query hooks
vi.mock('@src/hooks/useFetchAllPages', () => ({
  useAllPages: vi.fn(),
  getAllPagesQueryKey: vi.fn((key) => ['all-pages', ...key]),
}));

vi.mock('@src/hooks/react-query/v2/iam/membership/membership', () => ({
  getListOrgMembershipsQueryKey: vi.fn((orgId) => [`/orgs/${orgId}/memberships`]),
  listOrgMemberships: vi.fn((orgId, params) => Promise.resolve({ orgId, params })),
}));

vi.mock('@src/hooks/react-query/v2/iam/service-user/service-user', () => ({
  getListServiceUsersQueryKey: vi.fn((orgId) => [`/orgs/${orgId}/service-users`]),
  listServiceUsers: vi.fn((orgId, params) => Promise.resolve({ orgId, params })),
}));

describe('useUserDetails', () => {
  const mockOrgId = 'test-org-id';

  it('should return user and service user mapping', () => {
    // useAllPages is called twice: first for memberships, then for service users
    vi.mocked(useAllPages)
      .mockReturnValueOnce({
        data: [
          {
            user_id: 'user-1',
            user_display_name: 'John Doe',
            user_primary_email_address: 'john@example.com',
          },
          {
            user_id: 'user-2',
            user_display_name: 'Jane Smith',
            user_primary_email_address: 'jane@example.com',
          },
        ],
      } as any)
      .mockReturnValueOnce({
        data: [
          {
            id: 'service-user-1',
            display_name: 'Service Bot 1',
          },
          {
            id: 'service-user-2',
            display_name: 'Service Bot 2',
          },
        ],
      } as any);

    const { result } = renderHook(() => useUserDetails(mockOrgId));

    expect(result.current.getUserDisplayName('service-user-1')).toBe('Service Bot 1');
    expect(result.current.getUserDisplayName('service-user-2')).toBe('Service Bot 2');
    expect(result.current.getUserDisplayName('user-1')).toBe('John Doe');

    expect(result.current.getUserDetails('service-user-2')).toEqual({
      displayName: 'Service Bot 2',
    });

    expect(result.current.getUserDetails('user-1')).toEqual({
      displayName: 'John Doe',
      email: 'john@example.com',
    });
  });

  it('should handle users without email addresses', () => {
    vi.mocked(useAllPages)
      .mockReturnValueOnce({
        data: [
          {
            user_id: 'user-1',
            user_display_name: 'John Doe',
            user_primary_email_address: undefined,
          },
        ],
      } as any)
      .mockReturnValueOnce({
        data: undefined,
      } as any);

    const { result } = renderHook(() => useUserDetails(mockOrgId));

    expect(result.current.getUserDetails('user-1')).toEqual({
      displayName: 'John Doe',
      email: undefined,
    });
  });

  it('should use the correct org ID to get users and service users', () => {
    vi.mocked(useAllPages).mockReturnValue({ data: undefined } as any);
    vi.mocked(listOrgMemberships).mockClear();
    vi.mocked(listServiceUsers).mockClear();

    const testOrgId = 'specific-org-123';
    renderHook(() => useUserDetails(testOrgId));

    // Verify the query keys contain the correct orgId
    expect(getListOrgMembershipsQueryKey).toHaveBeenCalledWith(testOrgId);
    expect(getListServiceUsersQueryKey).toHaveBeenCalledWith(testOrgId);

    // Verify the fetch functions are called with the correct orgId
    const calls = vi.mocked(useAllPages).mock.calls;

    // First call: memberships
    const membershipsFetchFn = calls[calls.length - 2]![1];
    membershipsFetchFn({ page: '1' });
    expect(listOrgMemberships).toHaveBeenCalledWith(testOrgId, { page: '1' });

    // Second call: service users
    const serviceUsersFetchFn = calls[calls.length - 1]![1];
    serviceUsersFetchFn({ page: '1' });
    expect(listServiceUsers).toHaveBeenCalledWith(testOrgId, { page: '1' });
  });
});
