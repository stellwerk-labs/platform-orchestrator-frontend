import { useParams } from 'react-router';

import { FullHeightContainer } from '@src/components/shared/ui/FullHeightContainer/FullHeightContainer';
import { MatchParams } from '@src/config/routing';
import { ResourceGraph } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewEnvironment/components/ResourceGraph/ResourceGraph';
import { useGetDeployment } from '@src/hooks/react-query/v2/dataplane/deployment/deployment';
import { useDeploymentResourceGraphs } from '@src/hooks/useDeploymentResourceGraph';
import { Deployment } from '@src/models/v2/dataplane';
import { parseDeploymentError } from '@src/utilities/deployment/parseDeploymentError';
import { getNewNodes, getRemovedNodes, mergeNodes } from '@src/utilities/resourceGraph';

type Params = MatchParams & { deployId: string };

const getFailingModuleIds = (deployment: Deployment): string[] => {
  if (deployment.status !== 'failed' || !deployment.status_message) return [];
  return parseDeploymentError(deployment.status_message).failingModuleIds;
};

export const Resources = () => {
  const { orgId, projectId, envId, deployId } = useParams<keyof MatchParams>() as Params;
  const { data: deployment, isSuccess: deploymentLoaded } = useGetDeployment(orgId, deployId);

  const graphs = useDeploymentResourceGraphs(
    orgId,
    projectId,
    envId,
    deployId,
    // Include active resources too
    !!deployment?.plan_only,
  );

  if (!deploymentLoaded) {
    return null;
  }

  const failingModuleIds = getFailingModuleIds(deployment);

  const isPlanOnly = deployment.plan_only;
  const bothLoaded = graphs.resources !== undefined && graphs.activeResources !== undefined;
  const planned = graphs.resources ?? [];
  const active = graphs.activeResources ?? [];

  const resources = isPlanOnly ? mergeNodes(planned, active) : planned;
  const createdNodeIds =
    isPlanOnly && bothLoaded ? getNewNodes(planned, active).map((n) => n.id) : undefined;
  const deletedNodeIds =
    isPlanOnly && bothLoaded ? getRemovedNodes(planned, active).map((n) => n.id) : undefined;

  return (
    <FullHeightContainer height={'80%'}>
      <ResourceGraph
        resources={resources}
        highlightedModuleIds={failingModuleIds}
        deletedNodeIds={deletedNodeIds}
        createdNodeIds={createdNodeIds}
      />
    </FullHeightContainer>
  );
};
