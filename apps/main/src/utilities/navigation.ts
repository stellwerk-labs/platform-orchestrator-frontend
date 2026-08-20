export const generateDeploymentUrl = (
  orgId: string,
  projectId: string,
  envId: string,
  deploymentId: string,
  workloadsOrResources: 'workloads' | 'shared-resources' | 'resources' | 'manifest',
) => `${generateAppUrl(orgId, projectId, envId)}/deploys/${deploymentId}/${workloadsOrResources}`;

export const generateProjectsUrl = (orgId: string) => {
  return `${generateAppUrl(orgId)}/projects`;
};
export const generateAppUrl = (orgId: string, projectId?: string, envId?: string) => {
  let url = `/orgs/${orgId}`;
  if (projectId) url += `/projects/${projectId}`;
  if (envId) url += `/envs/${envId}`;
  return url;
};

export const generateOrgMembersUrl = (orgId: string) => {
  return `/orgs/${orgId}/members`;
};
export const generateMembershipDetailsUrl = (orgId: string, userId: string) =>
  `/orgs/${orgId}/members/${userId}`;
export const generateServiceUsersUrl = (orgId: string) => {
  return `/orgs/${orgId}/service-users`;
};
export const generateRolesUrl = (orgId: string) => `/orgs/${orgId}/roles`;

export const generateServiceUserDetailsUrl = (orgId: string, serviceUserId: string) =>
  `/orgs/${orgId}/service-users/${serviceUserId}`;

export const generateRunnersUrl = (orgId: string) => `/orgs/${orgId}/runners`;
export const generateRunnerDetailUrl = (orgId: string, runnerId: string) =>
  `/orgs/${orgId}/runners/${runnerId}`;
export const generateProvidersUrl = (orgId: string) => `/orgs/${orgId}/providers`;
export const generateEnvironmentTypesUrl = (orgId: string) => `/orgs/${orgId}/environment-types`;
export const generateProviderDetailUrl = (
  orgId: string,
  providerType: string,
  providerId: string,
) => `/orgs/${orgId}/providers/${providerType}/${providerId}`;
export const generateResourceTypesUrl = (orgId: string) => `/orgs/${orgId}/resource-types`;
export const generateResourceTypeDetailsUrl = (orgId: string, resourceTypeId: string) =>
  `/orgs/${orgId}/resource-types/${resourceTypeId}`;

export const generateModulesUrl = (orgId: string) => `/orgs/${orgId}/modules`;
export const generateProfileUrl = (orgId: string) => `/orgs/${orgId}/profile`;
export const generateModuleUrl = (orgId: string, moduleId: string) =>
  `/orgs/${orgId}/modules/${moduleId}/configuration`;
