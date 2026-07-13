import { useMemo } from 'react';

import {
  getListOrgMembershipsQueryKey,
  listOrgMemberships,
} from '@src/hooks/react-query/v2/iam/membership/membership';
import {
  getListServiceUsersQueryKey,
  listServiceUsers,
} from '@src/hooks/react-query/v2/iam/service-user/service-user';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';

interface UserDetails {
  displayName: string;
  email?: string;
}

export const useUserDetails = (orgId: string) => {
  const { data: memberships } = useAllPages(
    getAllPagesQueryKey(getListOrgMembershipsQueryKey(orgId)),
    (params) => listOrgMemberships(orgId, params),
  );
  const { data: allServiceUsers } = useAllPages(
    getAllPagesQueryKey(getListServiceUsersQueryKey(orgId)),
    (params) => listServiceUsers(orgId, params),
  );

  const userDetailsMap = useMemo(() => {
    const map = new Map<string, UserDetails>();

    // Add human users
    memberships?.forEach((membership) => {
      map.set(membership.user_id, {
        displayName: membership.user_display_name,
        email: membership.user_primary_email_address,
      });
    });

    // Add service users
    allServiceUsers?.forEach((serviceUser) => {
      map.set(serviceUser.id, {
        displayName: serviceUser.display_name,
      });
    });

    return map;
  }, [memberships, allServiceUsers]);

  // Helper function to get full user details
  const getUserDetails = (userId: string): UserDetails => {
    return userDetailsMap.get(userId) || { displayName: userId };
  };

  // Helper function to resolve user ID to display name
  const getUserDisplayName = (userId: string) => {
    return userDetailsMap.get(userId)?.displayName || userId;
  };

  return { getUserDisplayName, getUserDetails };
};
