import { Navigate, useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import {
  getListProjectsQueryKey,
  listProjects,
  useGetProject,
} from '@src/hooks/react-query/v2/controlplane/project/project';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { getLastVisitedApp } from '@src/utilities/local-storage';
import { generateAppUrl, generateProjectsUrl } from '@src/utilities/navigation';

export const OrgsRoot = () => {
  // Router hooks
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  // Local storage
  const lastVisitedProjectId = getLastVisitedApp() || '';

  // React query
  const { isSuccess: projectsLoaded } = useAllPages(
    getAllPagesQueryKey(getListProjectsQueryKey(orgId)),
    (params) => listProjects(orgId, params),
  );
  const { data: lastVisitedProject } = useGetProject(orgId, lastVisitedProjectId);

  // Determine where to redirect
  const getRedirectUrl = () => {
    if (lastVisitedProject?.id) {
      return generateAppUrl(orgId, lastVisitedProject.id);
    }

    return generateProjectsUrl(orgId);
  };

  return <>{projectsLoaded && <Navigate to={getRedirectUrl()} />}</>;
};
