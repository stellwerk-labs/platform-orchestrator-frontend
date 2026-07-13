import { useQueryClient } from '@tanstack/react-query';
import { Flex, message, Space, Spin } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { ScopedRolesTable } from '@src/components/shared/ScopedRolesTable/ScopedRolesTable';
import { DataEntry } from '@src/components/shared/ui/DataEntry/DataEntry';
import { TagList } from '@src/components/shared/ui/TagList/TagList';
import { MatchParams } from '@src/config/routing';
import { getListRolesQueryKey, listRoles } from '@src/hooks/react-query/v2/iam/role/role';
import {
  getListServiceUsersQueryKey,
  listServiceUsers,
  useReplaceServiceUserRoles,
} from '@src/hooks/react-query/v2/iam/service-user/service-user';
import { EnrichedScopedRole } from '@src/hooks/useEnrichScopedRoles';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { ServiceUserRole } from '@src/models/v2/iam';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';
import { generateServiceUsersUrl } from '@src/utilities/navigation';

import {
  deduplicateRoles,
  filterScopedServiceUserRoles,
  findRoleById,
  toScope,
} from '../OrgMembers/memberships';
import { MembershipCreate } from '../OrgMembers/types';

export const ServiceUserDetails = () => {
  const { orgId, serviceUserId } = useParams<keyof MatchParams>() as MatchParams;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { mutate: replaceServiceUserRoles } = useReplaceServiceUserRoles();

  const {
    data: allServiceUsers,
    isLoading: serviceUsersLoading,
    isSuccess: serviceUsersSucceed,
    isError: serviceUsersError,
  } = useAllPages(getAllPagesQueryKey(getListServiceUsersQueryKey(orgId)), (params) =>
    listServiceUsers(orgId, params),
  );

  const {
    data: orgRoles,
    isLoading: rolesLoading,
    isSuccess: rolesSucceed,
  } = useAllPages(getAllPagesQueryKey(getListRolesQueryKey(orgId)), (params) =>
    listRoles(orgId, params),
  );

  const [isTableLoading, setIsTableLoading] = useState<boolean>(true);

  const serviceUser = useMemo(() => {
    if (!serviceUsersSucceed || !allServiceUsers) {
      return null;
    }

    return allServiceUsers.find((user) => user.id === serviceUserId);
  }, [serviceUsersSucceed, allServiceUsers, serviceUserId]);

  useEffect(() => {
    if (serviceUsersError || (serviceUsersSucceed && !serviceUser)) {
      navigate(generateServiceUsersUrl(orgId), { replace: true });
    }
  }, [serviceUsersError, serviceUsersSucceed, serviceUser, navigate, orgId]);

  const findRoleName = useCallback(
    (roleId?: string) => {
      if (!rolesSucceed) {
        return undefined;
      }

      return findRoleById(orgRoles, roleId)?.display_name;
    },
    [orgRoles, rolesSucceed],
  );

  const parseOrgRoles = useCallback(
    (roles?: ServiceUserRole[]): string[] => {
      if (!roles) {
        return [];
      }

      return roles
        .filter((role) => !role.scope)
        .map((role) => findRoleName(role.id))
        .filter((name): name is string => !!name);
    },
    [findRoleName],
  );

  const scopedRoles = useMemo(() => {
    return filterScopedServiceUserRoles(serviceUser?.roles || []);
  }, [serviceUser]);

  const getCurrentServiceUser = useCallback(async () => {
    // Fetch current service users to get the current roles
    const currentServiceUsers = await queryClient.fetchQuery({
      queryKey: getListServiceUsersQueryKey(orgId),
      queryFn: () => listServiceUsers(orgId),
      staleTime: 0,
    });

    // Find the current service user
    return currentServiceUsers.items.find((user) => user.id === serviceUserId);
  }, [orgId, queryClient, serviceUserId]);

  const callReplace = useCallback(
    (roles: ServiceUserRole[], msg: string) => {
      replaceServiceUserRoles(
        {
          orgId,
          serviceUserId,
          data: {
            roles: deduplicateRoles(roles),
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getAllPagesQueryKey(getListServiceUsersQueryKey(orgId)),
            });
          },
          onError: () => {
            message.error(msg);
          },
        },
      );
    },
    [orgId, queryClient, replaceServiceUserRoles, serviceUserId],
  );

  const handleDelete = useCallback(
    async (scopedRole: EnrichedScopedRole) => {
      const currentServiceUser = await getCurrentServiceUser();
      if (!currentServiceUser) {
        message.error('Service user not found');
        return;
      }

      const scope = toScope(scopedRole.projectUuid, scopedRole.environment?.uuid);

      const newRoles: ServiceUserRole[] = currentServiceUser.roles.filter(
        (role) => !(role.id === scopedRole.role.id && role.scope === scope),
      );

      callReplace(newRoles, 'Failed to delete service user scoped role');
    },
    [callReplace, getCurrentServiceUser],
  );

  const handleCreate = useCallback(
    async (serviceUserScopedRoles: MembershipCreate[]) => {
      const currentServiceUser = await getCurrentServiceUser();
      if (!currentServiceUser) {
        message.error('Service user not found');
        return;
      }

      // Create new role entries from the form data
      const newRoles = serviceUserScopedRoles.map((membership) => ({
        id: membership.roleId,
        scope: membership.scope,
      }));

      // Combine existing roles with new roles
      const allRoles: ServiceUserRole[] = [...newRoles, ...currentServiceUser.roles];

      // Call replace API
      callReplace(allRoles, 'Failed to assign service user scoped role');
    },
    [getCurrentServiceUser, callReplace],
  );

  const handleUpdate = useCallback(
    async (scopedRole: EnrichedScopedRole, newRoleId: string) => {
      const currentServiceUser = await getCurrentServiceUser();
      if (!currentServiceUser) {
        message.error('Service user not found');
        return;
      }

      const scope = toScope(scopedRole.projectUuid, scopedRole.environment?.uuid);

      const rolesToKeep: ServiceUserRole[] = currentServiceUser.roles.filter(
        (role) => !(role.id === scopedRole.role.id && role.scope === scope),
      );

      const updatedRole: ServiceUserRole = {
        id: newRoleId,
        scope,
      };

      // Combine existing roles with new roles
      const allRoles: ServiceUserRole[] = [updatedRole, ...rolesToKeep];

      // Call replace API
      callReplace(allRoles, 'Failed to update service user scoped role');
    },
    [getCurrentServiceUser, callReplace],
  );

  return (
    <Spin spinning={serviceUsersLoading || rolesLoading || isTableLoading} tip={'Loading...'}>
      <Space direction={'vertical'} style={{ width: '100%' }} size={'large'}>
        <PageHeader customHeading={serviceUser?.display_name} />

        <Flex gap={'middle'} wrap={'wrap'}>
          <DataEntry label={'Display Name'} value={serviceUser?.display_name} />

          <DataEntry
            label={'Generated At'}
            value={
              serviceUser
                ? formatDate(
                    serviceUser.generated_at,
                    DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE,
                  )
                : '-'
            }
          />

          <DataEntry
            label={'Token Expires At'}
            value={
              serviceUser
                ? formatDate(
                    serviceUser.current_token_expires_at,
                    DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE,
                  )
                : '-'
            }
          />

          <DataEntry
            label={'Organization Roles'}
            value={<TagList items={parseOrgRoles(serviceUser?.roles)} />}
          />
        </Flex>

        <ScopedRolesTable
          orgId={orgId}
          scopedRoles={scopedRoles}
          onLoaded={() => setIsTableLoading(false)}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      </Space>
    </Spin>
  );
};
