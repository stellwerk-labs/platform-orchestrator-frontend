import { useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';

import { useCheckPermissions } from './react-query/v2/iam/user/user';

export enum RBACStatus {
  LOADING = 'loading',
  ALLOWED = 'allowed',
  NOT_ALLOWED = 'not-allowed',
}

export enum RBACPermission {
  MANAGE = 'manage',
  READ = 'read',
  WRITE = 'write',
}

export const useRBAC = (permission: RBACPermission): RBACStatus => {
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  const { data: permissions, isLoading } = useCheckPermissions([
    {
      resource: `organization:${orgId}`,
      permission: RBACPermission.MANAGE,
    },
    {
      resource: `organization:${orgId}`,
      permission: RBACPermission.WRITE,
    },
    {
      resource: `organization:${orgId}`,
      permission: RBACPermission.READ,
    },
  ]);

  if (isLoading) {
    return RBACStatus.LOADING;
  }

  return Boolean(
    permissions?.items.find((p) => p.permission_check.permission === permission)?.allowed,
  )
    ? RBACStatus.ALLOWED
    : RBACStatus.NOT_ALLOWED;
};
