import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Flex, Spin } from 'antd';
import { useCallback } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import { useGetEnvironment } from '@src/hooks/react-query/v2/controlplane/environment/environment';
import {
  getGetDeploymentQueryKey,
  getListDeploymentsQueryKey,
} from '@src/hooks/react-query/v2/dataplane/deployment/deployment';
import { RBACPermission, useRBACPermissions } from '@src/hooks/useRBAC';
import { generateDeploymentUrl } from '@src/utilities/navigation';

import { DeploymentLink } from './DeploymentLink';
import { DeploymentOrigin } from './DeploymentOrigin';
import {
  deploymentPipelineError,
  executionHasStarted,
  getDeploymentPipeline,
  pipelineQueryKey,
} from './deploymentPipelineApi';
import { NativePipelineControls } from './NativePipelineControls';
import { PlanActions } from './PlanActions';
import { rolloutApi } from './rolloutApi';
import { type RolloutAction, RolloutDetails } from './RolloutDetails';

export const DeploymentPipeline = () => {
  const navigate = useNavigate();
  const route = useParams<keyof MatchParams>() as MatchParams & { deployId: string };
  const actual = useOutletContext<
    (MatchParams & { deployId: string; getUserDisplayName?: (id: string) => string }) | undefined
  >();
  const scope = actual ?? route;
  const { orgId, projectId, envId, deployId } = scope;
  const { data: environment } = useGetEnvironment(orgId, projectId, envId);
  const permission = {
    resource: `env:${environment?.uuid}`,
    permission: RBACPermission.DEPLOYMENT_WRITE,
  };
  const logPermission = { ...permission, permission: RBACPermission.DEPLOYMENT_LOGS_READ };
  const readPermission = { ...permission, permission: RBACPermission.DEPLOYMENT_READ };
  const permissions = useRBACPermissions(
    environment?.uuid ? [permission, logPermission, readPermission] : [],
  );
  const canWrite = Boolean(
    environment?.uuid && permissions.allowed(permission) && permissions.allowed(readPermission),
  );
  const canReadLogs = Boolean(
    environment?.uuid && permissions.allowed(logPermission) && permissions.allowed(readPermission),
  );
  const cache = useQueryClient();
  const pipeline = useQuery({
    queryKey: pipelineQueryKey(orgId, deployId),
    queryFn: () => getDeploymentPipeline(orgId, deployId),
    retry: false,
    refetchInterval: 2000,
  });
  const refresh = useCallback(() => {
    void cache.invalidateQueries({ queryKey: pipelineQueryKey(orgId, deployId) });
    void cache.invalidateQueries({ queryKey: getGetDeploymentQueryKey(orgId, deployId) });
    void cache.invalidateQueries({ queryKey: getListDeploymentsQueryKey(orgId) });
  }, [cache, orgId, deployId]);
  const mutation = useMutation({
    mutationFn: (request: RolloutAction) => {
      if (!canWrite) throw new Error('Deployment write permission is required.');
      if (pipeline.data?.available_controls !== undefined)
        throw new Error('Native pipeline controls require a signed request.');
      switch (request.type) {
        case 'approve':
          return rolloutApi.approve(scope, request.id, request.subject);
        case 'repair':
          return rolloutApi.repair(scope, request.id, request.step);
        case 'cancel':
          return rolloutApi.cancel(scope, request.id);
        default:
          throw new Error('Unsupported pipeline action.');
      }
    },
    onSuccess: refresh,
  });
  if (pipeline.isPending) return <Spin />;
  if (pipeline.isError && !pipeline.data)
    return <Alert type={'error'} showIcon message={'Pipeline execution could not be loaded.'} />;
  if (!pipeline.data)
    return <Alert type={'info'} message={'This deployment has no pipeline execution record.'} />;
  const { definition, progress } = pipeline.data;
  return (
    <Card
      title={'Pipeline execution'}
      extra={
        <Flex gap={'small'} wrap>
          {(definition.strategy === 'reviewed' || definition.strategy === 'plan') && (
            <Button
              disabled={!canReadLogs}
              onClick={() =>
                navigate(
                  `${generateDeploymentUrl(orgId, projectId, envId, deployId, 'logs')}?log=plan`,
                )
              }>
              View plan logs
            </Button>
          )}
          {executionHasStarted(pipeline.data) && (
            <Button
              disabled={!canReadLogs}
              onClick={() =>
                navigate(
                  `${generateDeploymentUrl(orgId, projectId, envId, deployId, 'logs')}?log=apply`,
                )
              }>
              {definition.strategy === 'destroy' ? 'View execution logs' : 'View apply logs'}
            </Button>
          )}
        </Flex>
      }>
      <Flex vertical gap={'middle'}>
        {pipeline.data.origin && <DeploymentOrigin orgId={orgId} origin={pipeline.data.origin} />}
        {pipeline.data.source_plan_id && (
          <Alert
            type={'info'}
            showIcon
            message={'Applying a saved plan'}
            action={
              <DeploymentLink
                url={generateDeploymentUrl(
                  orgId,
                  projectId,
                  envId,
                  pipeline.data.source_plan_id,
                  'pipeline',
                )}>
                View source plan
              </DeploymentLink>
            }
            description={
              'This deployment applies the exact saved plan. It does not generate a new plan.'
            }
          />
        )}
        {pipeline.data.replanned_from_id && (
          <Link
            to={generateDeploymentUrl(
              orgId,
              projectId,
              envId,
              pipeline.data.replanned_from_id,
              'pipeline',
            )}>
            Replanned from an earlier plan
          </Link>
        )}
        {pipeline.data.plan && (
          <PlanActions
            key={`plan-actions:${deployId}`}
            scope={scope}
            id={deployId}
            plan={pipeline.data.plan}
            changes={progress.changes}
            canWrite={canWrite}
            unavailable={pipeline.isError}
          />
        )}
        {mutation.isError && (
          <Alert type={'error'} showIcon message={deploymentPipelineError(mutation.error)} />
        )}
        <RolloutDetails
          key={`pipeline-details:${deployId}`}
          definition={definition}
          rollout={progress}
          canWrite={canWrite}
          busy={mutation.isPending}
          unavailable={pipeline.isError}
          action={mutation.mutate}
          localActions={pipeline.data.available_controls === undefined}
          actorLabel={
            progress.approval_decision?.actor_id
              ? actual?.getUserDisplayName?.(progress.approval_decision.actor_id)
              : undefined
          }
        />
        {pipeline.data.available_controls !== undefined &&
          environment?.uuid &&
          !permissions.isPending && (
            <NativePipelineControls
              orgId={orgId}
              id={deployId}
              pipeline={pipeline.data}
              canWrite={canWrite}
              unavailable={pipeline.isError}
              onResolved={refresh}
            />
          )}
      </Flex>
    </Card>
  );
};
