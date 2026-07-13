import { ScopedRole } from '@src/hooks/useEnrichScopedRoles';
import { Role, ServiceUserRole, UserMembershipRequest } from '@src/models/v2/iam';

const VALID_SCOPE_RESOURCES = ['project', 'env'];

export const findRoleById = (
  roles: Role[] | undefined,
  roleId: string | undefined,
): Role | undefined => {
  if (!roleId || !roles) {
    return undefined;
  }

  return roles.find((r) => r.id === roleId);
};

export const parseScope = (scope: string) => {
  const [type, id] = scope.split(':');
  if (!id || !type) {
    return undefined;
  }

  if (!VALID_SCOPE_RESOURCES.includes(type)) {
    return undefined;
  }

  return { type, id };
};

export const toScope = (projectUuid: string, environmentUuid?: string): string => {
  return environmentUuid ? `env:${environmentUuid}` : `project:${projectUuid}`;
};

export const deduplicateMemberships = (
  memberships: UserMembershipRequest[],
): UserMembershipRequest[] => {
  const seen = new Set<string>();
  return memberships.filter((membership) => {
    const key = `${membership.subject_type}:${membership.subject}:${membership.scope || ''}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

export const deduplicateRoles = (roles: ServiceUserRole[]): ServiceUserRole[] => {
  const seen = new Set<string>();
  return roles.filter((r) => {
    const key = `${r.id}:${r.scope || ''}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

export const filterScopedServiceUserRoles = (roles: ServiceUserRole[]): ScopedRole[] => {
  return roles
    .filter((role) => role.scope !== undefined)
    .map((role) => ({
      roleId: role.id,
      scope: role.scope!,
    }));
};
