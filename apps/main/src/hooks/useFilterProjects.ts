import { useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import {
  getListProjectsQueryKey,
  listProjects,
} from '@src/hooks/react-query/v2/controlplane/project/project';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';

export const useFilterProjects = (filterValue: string | undefined) => {
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  // React Query
  const {
    isLoading: projectsLoading,
    isSuccess: projectsLoaded,
    data: allProjects,
  } = useAllPages(getAllPagesQueryKey(getListProjectsQueryKey(orgId)), (params) =>
    listProjects(orgId, params),
  );

  return {
    projectsLoading,
    projectsLoaded,
    projectCount: allProjects?.length,
    filteredProjects: filterValue
      ? allProjects?.filter((application) =>
          application.display_name.toLowerCase()?.includes(filterValue.toLowerCase()),
        )
      : allProjects,
  };
};
