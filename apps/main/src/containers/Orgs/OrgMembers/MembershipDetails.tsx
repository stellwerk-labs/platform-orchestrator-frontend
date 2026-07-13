import { useQueryClient } from '@tanstack/react-query';
import { Flex, message, Space, Spin } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { ScopedRolesTable } from '@src/components/shared/ScopedRolesTable/ScopedRolesTable';
import { DataEntry } from '@src/components/shared/ui/DataEntry/DataEntry';
import { TagList } from '@src/components/shared/ui/TagList/TagList';
import { MatchParams } from '@src/config/routing';
import {
  getListMembersQueryKey,
  getListOrgMembershipsQueryKey,
  listMembers,
  listOrgMemberships,
  useDeleteOrgMembership,
  useReplaceOrgUserMemberships,
} from '@src/hooks/react-query/v2/iam/membership/membership';
import { getListRolesQueryKey, listRoles } from '@src/hooks/react-query/v2/iam/role/role';
import { useGetCurrentUser } from '@src/hooks/react-query/v2/iam/user/user';
import { EnrichedScopedRole, ScopedRole } from '@src/hooks/useEnrichScopedRoles';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { OrgMembership, SubjectType, UserMembershipRequest } from '@src/models/v2/iam';
import { generateOrgMembersUrl } from '@src/utilities/navigation';

import { deduplicateMemberships, findRoleById } from './memberships';
import { MembershipCreate } from './types';

const userRolesToScopedRoles = (memberships: OrgMembership[]): ScopedRole[] => {
  return memberships
    .filter((membership) => membership.subject_type === 'role' && !!membership.scope)
    .map((membership) => ({
      id: membership.id,
      roleId: membership.subject,
      scope: membership.scope!,
    }));
};

export const MembershipDetails = () => {
  const { orgId, userId } = useParams<keyof MatchParams>() as MatchParams;
  const navigate = useNavigate();

  const { mutate: deleteOrgMembership } = useDeleteOrgMembership();
  const { mutate: replaceMemberships } = useReplaceOrgUserMemberships();
  const queryClient = useQueryClient();

  const { data: currentUser } = useGetCurrentUser();
  const {
    data: memberships,
    isLoading: membershipsLoading,
    isSuccess: membershipsSucceed,
    isError: membershipsError,
  } = useAllPages(getAllPagesQueryKey(getListOrgMembershipsQueryKey(orgId, { userId })), (params) =>
    listOrgMemberships(orgId, { userId, ...params }),
  );

  const { data: members, isLoading: membersLoading } = useAllPages(
    getAllPagesQueryKey(getListMembersQueryKey(orgId, { userId })),
    (params) => listMembers(orgId, { userId, ...params }),
  );

  const scopedRoles = useMemo(() => {
    if (!membershipsSucceed || !memberships) {
      return [];
    }
    return userRolesToScopedRoles(memberships);
  }, [memberships, membershipsSucceed]);

  const isOwnScopedRoles = useMemo((): boolean => {
    if (!currentUser?.id) {
      // Disable editing if we don't have current user info yet
      return true;
    }

    return userId === currentUser.id;
  }, [currentUser, userId]);

  const {
    data: orgRoles,
    isLoading: rolesLoading,
    isSuccess: rolesSucceed,
  } = useAllPages(getAllPagesQueryKey(getListRolesQueryKey(orgId)), (params) =>
    listRoles(orgId, params),
  );

  useEffect(() => {
    if (membershipsError || (membershipsSucceed && memberships.length === 0)) {
      navigate(generateOrgMembersUrl(orgId), { replace: true });
    }
  }, [membershipsError, membershipsSucceed, memberships, navigate, orgId]);

  const [isTableLoading, setIsTableLoading] = useState<boolean>(true);

  const findRoleName = useCallback(
    (roleId: string | undefined) => {
      if (!rolesSucceed) {
        return undefined;
      }

      return findRoleById(orgRoles, roleId)?.display_name;
    },
    [orgRoles, rolesSucceed],
  );

  interface UserInfo {
    name: string;
    email?: string;
    providers: string[];
    orgRoles: string[];
  }

  const userDetails = useMemo((): UserInfo | null => {
    if (!members || members.length === 0) {
      return null;
    }

    const first = members[0];
    if (!first) return null;

    const parsedOrgRoles = members
      .filter((m) => m.subject_type === SubjectType.role)
      .map((m) => findRoleName(m.subject))
      .filter((name): name is string => !!name);

    return {
      name: first.user_display_name,
      email: first.user_primary_email_address,
      orgRoles: parsedOrgRoles,
      providers: first.identity_providers,
    };
  }, [members, findRoleName]);

  const handleDelete = async (scopedRole: EnrichedScopedRole): Promise<void> => {
    if (!scopedRole.id) {
      return;
    }

    deleteOrgMembership(
      { orgId, membershipId: scopedRole.id },
      {
        onSuccess: async () => {
          queryClient.invalidateQueries({
            queryKey: getAllPagesQueryKey(getListOrgMembershipsQueryKey(orgId, { userId })),
          });
          queryClient.invalidateQueries({
            queryKey: getAllPagesQueryKey(getListMembersQueryKey(orgId)),
          });
        },
        onError: () => {
          message.error('Failed to delete user scoped role');
        },
      },
    );
  };

  const handleCreate = useCallback(
    async (membershipsCreate: MembershipCreate[]) => {
      // Fetch current roles
      const currentRoles = await queryClient.fetchQuery({
        queryKey: getListOrgMembershipsQueryKey(orgId, { userId }),
        queryFn: () => listOrgMemberships(orgId, { userId }),
        staleTime: 0,
      });

      // Create new role memberships
      const newRoles = membershipsCreate.map((membership) => ({
        subject_type: SubjectType.role,
        subject: membership.roleId,
        scope: membership.scope,
      }));

      // New memberships array
      const newMemberships: UserMembershipRequest[] = deduplicateMemberships([
        ...newRoles,
        ...currentRoles.items.map((m) => ({
          subject_type: m.subject_type,
          subject: m.subject,
          scope: m.scope,
        })),
      ]);

      // Call replace
      replaceMemberships(
        {
          orgId,
          userId,
          data: {
            memberships: newMemberships,
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getAllPagesQueryKey(getListOrgMembershipsQueryKey(orgId, { userId })),
            });
            queryClient.invalidateQueries({
              queryKey: getAllPagesQueryKey(getListMembersQueryKey(orgId)),
            });
          },
          onError: () => {
            message.error('Failed to assign user scoped role');
          },
        },
      );
    },
    [queryClient, orgId, userId, replaceMemberships],
  );

  const handleUpdate = useCallback(
    async (scopedRole: EnrichedScopedRole, newRoleId: string) => {
      const membershipId = scopedRole.id;

      // Fetch current roles
      const currentRoles = await queryClient.fetchQuery({
        queryKey: getListOrgMembershipsQueryKey(orgId, { userId }),
        queryFn: () => listOrgMemberships(orgId, { userId }),
        staleTime: 0,
      });

      // Get membership to update
      const currentMembership = currentRoles.items.find(
        (m: OrgMembership) => m.id === membershipId,
      );

      // Sanity check
      if (!currentMembership || currentMembership.subject_type !== SubjectType.role) {
        message.error('Membership to update not found');
        return;
      }

      // Create updated membership
      const updatedRole = {
        subject_type: currentMembership.subject_type,
        subject: newRoleId,
        scope: currentMembership.scope,
      };

      // New memberships array
      const newMemberships: UserMembershipRequest[] = deduplicateMemberships([
        updatedRole,
        ...currentRoles.items
          .filter((m) => m.id !== membershipId)
          .map((m) => ({
            subject_type: m.subject_type,
            subject: m.subject,
            scope: m.scope,
          })),
      ]);

      // Call replace
      replaceMemberships(
        {
          orgId,
          userId,
          data: {
            memberships: newMemberships,
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getAllPagesQueryKey(getListOrgMembershipsQueryKey(orgId, { userId })),
            });
            queryClient.invalidateQueries({
              queryKey: getAllPagesQueryKey(getListMembersQueryKey(orgId)),
            });
          },
          onError: () => {
            message.error('Failed to update scoped role');
          },
        },
      );
    },
    [queryClient, orgId, userId, replaceMemberships],
  );

  return (
    <Spin
      spinning={membershipsLoading || membersLoading || rolesLoading || isTableLoading}
      tip={'Loading...'}>
      <Space direction={'vertical'} style={{ width: '100%' }} size={'large'}>
        <PageHeader customHeading={userDetails?.name} />

        <Flex gap={'middle'} wrap={'wrap'}>
          <DataEntry label={'Display Name'} value={userDetails?.name} />
          <DataEntry
            label={'Identity Provider'}
            value={<TagList items={userDetails?.providers} />}
          />
          <DataEntry label={'Email'} value={userDetails?.email || '-'} />
          <DataEntry
            label={'Organization Roles'}
            value={<TagList items={userDetails?.orgRoles} />}
          />
        </Flex>

        <ScopedRolesTable
          orgId={orgId}
          scopedRoles={scopedRoles}
          onLoaded={() => setIsTableLoading(false)}
          onCreate={isOwnScopedRoles ? undefined : handleCreate}
          onDelete={isOwnScopedRoles ? undefined : handleDelete}
          onUpdate={isOwnScopedRoles ? undefined : handleUpdate}
        />
      </Space>
    </Spin>
  );
};
