import { useListActiveResourceNodes } from '@src/hooks/react-query/v2/dataplane/active-resource/active-resource';
import {
  useListDeploymentResourceNodes,
  useListLastDeployments,
} from '@src/hooks/react-query/v2/dataplane/deployment/deployment';
import { ActiveResourceNode } from '@src/models/v2/dataplane';

type DeploymentResourceGraph = {
  resources: ActiveResourceNode[] | undefined;
  activeResources: ActiveResourceNode[] | undefined;
};

/**
 * Returns resource graphs for a deployment.
 *
 * Always returns the graph for the given deployment — using the active resources endpoint
 * for the latest stateful (active) deployment, and the deployment resources endpoint for historical
 * or plan-only deployments.
 *
 * @param includeActive - When true, also fetches the active resource graph regardless of
 * which deployment is being viewed. Useful when both graphs are needed for comparison.
 */
export const useDeploymentResourceGraphs = (
  orgId: string,
  projectId: string,
  envId: string,
  deployId: string,
  includeActive: boolean,
): DeploymentResourceGraph => {
  // Get the latest stateful deployment
  const { data: deploymentsPage, isSuccess: deploymentsLoaded } = useListLastDeployments(orgId, {
    project_id: projectId,
    env_id: envId,
    per_page: 1,
    state_change_only: true,
  });

  // Is this the latest stateful deployment?
  const activeDeploymentId = deploymentsPage?.items[0]?.id;
  const isActiveDeployment = activeDeploymentId === deployId;

  // Latest stateful (active) deployment uses active resources endpoint
  const { data: activeResources } = useListActiveResourceNodes(
    orgId,
    { project_id: projectId, env_id: envId },
    { query: { enabled: includeActive || isActiveDeployment } },
  );

  // Historical and non-stateful deployments use resources endpoint
  const { data: deploymentResources } = useListDeploymentResourceNodes(orgId, deployId, {
    query: { enabled: deploymentsLoaded && !isActiveDeployment },
  });

  return {
    resources: isActiveDeployment ? activeResources?.items : deploymentResources?.items,
    activeResources: activeResources?.items,
  };
};
