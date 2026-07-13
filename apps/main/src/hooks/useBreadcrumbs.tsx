import { UIMatch, useMatches, useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import { useGetEnvironment } from '@src/hooks/react-query/v2/controlplane/environment/environment';
import { useGetProject } from '@src/hooks/react-query/v2/controlplane/project/project';
import { useGetDeployment } from '@src/hooks/react-query/v2/dataplane/deployment/deployment';
import { RouteHandle } from '@src/types/router';

export interface BreadcrumbItem {
  name?: string;
  label?: string;
  pathname?: string;
  labelAsTitle?: boolean;
}
export const useBreadcrumbs = () => {
  const { orgId, projectId, envId, deploymentId } = useParams<keyof MatchParams>() as MatchParams;

  const matches: UIMatch[] = useMatches();

  const { data: deployment } = useGetDeployment(orgId, deploymentId);

  const { data: env } = useGetEnvironment(orgId, projectId, envId);

  const { data: project } = useGetProject(orgId, projectId);
  /**
   * get the crumbs from the route handles
   */
  const crumbs = matches
    .filter((match) => Boolean((match.handle as RouteHandle)?.crumbs))
    .flatMap((match) =>
      (match.handle as RouteHandle)?.crumbs(match, {
        project,
        deployment,
        env,
      }),
    );

  return crumbs;
};
