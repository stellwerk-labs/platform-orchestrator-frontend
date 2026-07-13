import { useMemo } from 'react';

import { findRoleById, parseScope } from '@src/containers/Orgs/OrgMembers/memberships';
import {
  getListProjectsQueryKey,
  listProjects,
} from '@src/hooks/react-query/v2/controlplane/project/project';
import { getListRolesQueryKey, listRoles } from '@src/hooks/react-query/v2/iam/role/role';
import { useEnvironmentLookup } from '@src/hooks/useEnvironmentLookup';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { Environment } from '@src/models/v2/controlplane';
import { Role } from '@src/models/v2/iam';

export interface EnrichedScopedRole {
  // identifier for operations
  id?: string;

  // resources
  projectId: string;
  projectUuid: string;

  environment?: Environment;

  // assigned role
  role: Role;
}

interface Props {
  orgId: string;
  scopedRoles: ScopedRole[];
}

export interface ScopedRole {
  // Optional ID to manage roles
  // Can be enforced when service users role update endpoint is implemented
  id?: string;

  roleId: string;
  scope: string;
}

export const useEnrichScopedRoles = ({
  orgId,
  scopedRoles,
}: Props): { enrichedScopedRoles: EnrichedScopedRole[]; isLoading: boolean } => {
  const {
    data: allProjects,
    isLoading: isProjectsLoading,
    isSuccess: isProjectsSucceed,
  } = useAllPages(getAllPagesQueryKey(getListProjectsQueryKey(orgId)), (params) =>
    listProjects(orgId, params),
  );

  const {
    data: orgRoles,
    isLoading: rolesLoading,
    isSuccess: rolesSucceed,
  } = useAllPages(getAllPagesQueryKey(getListRolesQueryKey(orgId)), (params) =>
    listRoles(orgId, params),
  );

  const { findEnvironmentByUuid, isEnvironmentLookupLoading } = useEnvironmentLookup(orgId);

  const enrichedScopedRoles = useMemo(() => {
    const results: EnrichedScopedRole[] = [];

    if (!isProjectsSucceed || !rolesSucceed) {
      return [];
    }

    const addProjectRole = (projectUuid: string, role: Role, membershipId?: string) => {
      const project = allProjects.find((p) => p.uuid === projectUuid);
      if (!project) {
        return;
      }

      results.push({
        id: membershipId,
        projectId: project.id,
        projectUuid: project.uuid,
        role,
      });
    };

    const addEnvironmentRole = (environmentUuid: string, role: Role, membershipId?: string) => {
      const environment = findEnvironmentByUuid(environmentUuid);
      if (!environment) {
        return;
      }

      results.push({
        id: membershipId,

        projectId: environment.project_id,
        // this is always defined when we return it in the endpoint
        // question is just if a specific endpoint does return it
        projectUuid: environment.project_uuid!,

        environment,

        role,
      });
    };

    // Parse each scoped role directly into flattened format
    scopedRoles.forEach((scopedRole) => {
      const role = findRoleById(orgRoles, scopedRole.roleId);
      if (!role) {
        return;
      }

      const scopeInfo = parseScope(scopedRole.scope);
      if (!scopeInfo) {
        return;
      }

      if (scopeInfo.type === 'project') {
        addProjectRole(scopeInfo.id, role, scopedRole.id);
      } else if (scopeInfo.type === 'env') {
        addEnvironmentRole(scopeInfo.id, role, scopedRole.id);
      }
    });

    return results.sort((a, b) => {
      // Sort by project first
      const projectComparison = a.projectId.localeCompare(b.projectId);
      if (projectComparison !== 0) {
        return projectComparison;
      }

      if (!a.environment?.display_name && !b.environment?.display_name) {
        return 0;
      }

      if (!a.environment?.display_name) {
        return -1;
      }

      if (!b.environment?.display_name) {
        return 1;
      }

      return a.environment.display_name.localeCompare(b.environment.display_name);
    });
  }, [scopedRoles, allProjects, isProjectsSucceed, orgRoles, rolesSucceed, findEnvironmentByUuid]);

  const isLoading = isProjectsLoading || isEnvironmentLookupLoading || rolesLoading;

  return {
    enrichedScopedRoles,
    isLoading,
  };
};
