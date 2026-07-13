import { useMemo } from 'react';
import { useParams } from 'react-router';

import { AccessTable } from '@src/components/shared/AccessTable';
import { MatchParams } from '@src/config/routing';
import {
  getListProjectUsersQueryKey,
  listProjectUsers,
} from '@src/hooks/react-query/v2/iam/project/project';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { SubjectType } from '@src/models/v2/iam';

export const Access = () => {
  const { orgId, projectId } = useParams<keyof MatchParams>() as MatchParams;

  const { data: allProjectUsers, isFetching: areUsersLoading } = useAllPages(
    getAllPagesQueryKey(getListProjectUsersQueryKey(orgId, projectId)),
    (params) => listProjectUsers(orgId, projectId, params),
  );

  // Filter to only show users with subject_type = 'role'
  const filteredUsers = useMemo(
    () => allProjectUsers?.filter((user) => user.subject_type === SubjectType.role) || [],
    [allProjectUsers],
  );

  return <AccessTable users={filteredUsers} isLoading={areUsersLoading} orgId={orgId} />;
};
