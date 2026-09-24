import { useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import type { ResourcePermissionCheck, ResourcePermissionCheckResult } from '@src/models/v2/iam';

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
  INVITATION_WRITE = 'invitation_write',
  MEMBERSHIP_WRITE = 'membership_write',
  ROLE_WRITE = 'role_write',
  SERVICE_USER_WRITE = 'service_user_write',
  MODULE_READ = 'module.read',
  MODULE_ARCHIVE = 'module.archive',
  MODULE_VERSION_READ = 'module.version.read',
  MODULE_VERSION_PUBLISH = 'module.version.publish',
  MODULE_VERSION_PROMOTE = 'module.version.promote',
  MODULE_VERSION_DEPRECATE = 'module.version.deprecate',
  MODULE_VERSION_DEFECTIVE = 'module.version.mark-defective',
  MODULE_VERSION_RESTORE = 'module.version.restore',
  MODULE_VERSION_PIN = 'module.version.pin',
  MODULE_VERSION_PIN_NOTE = 'module.version.pin-note',
  MODULE_VERSION_UNPIN = 'module.version.unpin',
  MODULE_VERSION_PIN_DEFECTIVE = 'module.version.pin-defective',
  RESOURCE_TYPE_WRITE = 'resource_type_write',
}

export const permissionAllowed = (
  result: ResourcePermissionCheckResult | undefined,
  check: ResourcePermissionCheck,
): boolean =>
  result?.items.some(
    (item) =>
      item.permission_check.resource === check.resource &&
      item.permission_check.permission === check.permission &&
      item.allowed === true,
  ) ?? false;

export const useRBACPermissions = (checks: ResourcePermissionCheck[]) => {
  const { data, isPending, isError } = useCheckPermissions(checks, {
    query: { enabled: checks.length > 0 },
  });
  return {
    isPending: checks.length > 0 && isPending,
    allowed: (check: ResourcePermissionCheck) =>
      !isPending && !isError && permissionAllowed(data, check),
  };
};

export const useRBAC = (permission: RBACPermission, resource?: string): RBACStatus => {
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;
  const check = { resource: resource ?? `organization:${orgId}`, permission };
  const permissions = useRBACPermissions([check]);

  if (permissions.isPending) {
    return RBACStatus.LOADING;
  }

  return permissions.allowed(check) ? RBACStatus.ALLOWED : RBACStatus.NOT_ALLOWED;
};
