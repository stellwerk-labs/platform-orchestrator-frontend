import { useMemo } from 'react';
import { useParams } from 'react-router';

import { AccessTable } from '@src/components/shared/AccessTable';
import { MatchParams } from '@src/config/routing';
import {
  getListEnvironmentUsersQueryKey,
  listEnvironmentUsers,
} from '@src/hooks/react-query/v2/iam/environment/environment';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { SubjectType } from '@src/models/v2/iam';

export const Access = () => {
  const { orgId, projectId, envId } = useParams<keyof MatchParams>() as MatchParams;

  const { data: allEnvironmentUsers, isFetching: areUsersLoading } = useAllPages(
    getAllPagesQueryKey(getListEnvironmentUsersQueryKey(orgId, projectId, envId)),
    (params) => listEnvironmentUsers(orgId, projectId, envId, params),
  );
  const filteredUsers = useMemo(
    () => allEnvironmentUsers?.filter((user) => user.subject_type === SubjectType.role) || [],
    [allEnvironmentUsers],
  );

  return <AccessTable orgId={orgId} users={filteredUsers} isLoading={areUsersLoading} />;
};
