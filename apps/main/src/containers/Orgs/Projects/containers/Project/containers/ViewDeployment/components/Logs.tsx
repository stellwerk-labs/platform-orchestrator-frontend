import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Flex, Segmented, Space, Spin, Typography } from 'antd';
import { type ReactNode, useEffect, useState } from 'react';
import { useOutletContext, useParams, useSearchParams } from 'react-router';

import { RunnerLogs } from '@src/components/shared/RunnerLogs';
import { windowEnv } from '@src/config/environment';
import { MatchParams } from '@src/config/routing';
import {
  executionHasStarted,
  getDeploymentPipeline,
  pipelineQueryKey,
} from '@src/containers/RunnerRollouts/deploymentPipelineApi';
import {
  type NativeLogProgress,
  type NativeLogSelection,
  NativePhaseLogs,
} from '@src/containers/RunnerRollouts/NativePhaseLogs';
import { PipelinePlanLogs } from '@src/containers/RunnerRollouts/PipelinePlanLogs';
import { useGetEnvironment } from '@src/hooks/react-query/v2/controlplane/environment/environment';
import { RBACPermission, useRBACPermissions } from '@src/hooks/useRBAC';

import { loadDeploymentLogs } from './deploymentLogsApi';

const DeploymentLogs = ({
  orgId,
  deploymentId,
  pipeline = false,
  title,
  nativeSelection,
}: {
  orgId: string;
  deploymentId: string;
  pipeline?: boolean;
  title?: string;
  nativeSelection?: NativeLogSelection & { phase: 'plan' | 'apply' };
}) => {
  const [content, setContent] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(true);
  const [visible, setVisible] = useState(true);
  const [revision, setRevision] = useState(0);
  const nativePhase = nativeSelection?.phase;
  const executionId = nativeSelection?.executionId;
  const captureRevision = nativeSelection?.captureRevision;

  useEffect(() => {
    if (!visible) return;
    let current = true;
    const request = new AbortController();
    const timeout = window.setTimeout(() => request.abort(), 30_000);
    setContent(undefined);
    setError(undefined);
    setBusy(true);
    const apiBaseURL = new URL(windowEnv.BASE_URL || '/', window.location.origin).href;
    void loadDeploymentLogs(
      apiBaseURL,
      orgId,
      deploymentId,
      request.signal,
      pipeline,
      nativePhase ? { phase: nativePhase, executionId, captureRevision } : undefined,
    )
      .then((loaded) => {
        if (current) setContent(loaded);
      })
      .catch((failure: unknown) => {
        if (current)
          setError(failure instanceof Error ? failure.message : 'The logs could not be loaded.');
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (current) setBusy(false);
      });
    return () => {
      current = false;
      window.clearTimeout(timeout);
      request.abort();
    };
  }, [orgId, deploymentId, revision, visible, pipeline, nativePhase, executionId, captureRevision]);

  const clear = () => {
    setVisible(false);
    setContent(undefined);
    setError(undefined);
    setBusy(false);
  };

  const renderToolbar = (rawToggle?: ReactNode) => (
    <Flex align={'center'} gap={8} wrap>
      <Button
        type={'primary'}
        loading={busy}
        onClick={() => {
          setVisible(true);
          setRevision((previous) => previous + 1);
        }}>
        Reload logs
      </Button>
      <Button onClick={clear}>Clear logs</Button>
      {rawToggle ?? <Button disabled>Show raw logs</Button>}
      <Typography.Text type={'secondary'} style={{ marginLeft: 'auto', flex: '1 1 320px' }}>
        {nativeSelection
          ? 'Logs use the retained encrypted artifact. Deployment log permission controls access.'
          : pipeline
            ? 'Execution logs are encrypted at the Runner and require a reachable site. Deployment log permission controls access.'
            : 'Logs are encrypted; availability depends on retained artifacts. The Orchestrator manages decryption keys for deployments using automatic log access. Your deployment log permission controls access to their contents.'}
      </Typography.Text>
    </Flex>
  );

  return (
    <Card title={title}>
      <Space direction={'vertical'} style={{ width: '100%' }}>
        {!content && renderToolbar()}
        {error && <Alert type={'error'} showIcon message={error} />}
        {content !== undefined &&
          (content ? (
            <RunnerLogs content={content} renderToolbar={renderToolbar} scrollMode={'page'} />
          ) : (
            <Alert type={'info'} message={'This deployment returned an empty log.'} />
          ))}
      </Space>
    </Card>
  );
};

export const Logs = () => {
  const [search, setSearch] = useSearchParams();
  const route = useParams<keyof MatchParams>() as MatchParams & { deployId: string };
  const actual = useOutletContext<(MatchParams & { deployId: string }) | undefined>();
  const { orgId, projectId, envId, deployId } = actual ?? route;
  const { data: environment, isPending: environmentPending } = useGetEnvironment(
    orgId,
    projectId,
    envId,
    { query: { retry: false } },
  );
  const orgCheck = {
    resource: `organization:${orgId}`,
    permission: RBACPermission.DEPLOYMENT_LOGS_READ,
  };
  const logChecks = [orgCheck];
  if (environment) logChecks.push({ ...orgCheck, resource: `env:${environment.uuid}` });
  const readChecks = logChecks.map((check) => ({
    ...check,
    permission: RBACPermission.DEPLOYMENT_READ,
  }));
  const checks = [...logChecks, ...readChecks];
  const permissions = useRBACPermissions(checks);
  const allowed =
    logChecks.some((check) => permissions.allowed(check)) &&
    readChecks.some((check) => permissions.allowed(check));
  const pipeline = useQuery({
    queryKey: pipelineQueryKey(orgId, deployId),
    queryFn: () => getDeploymentPipeline(orgId, deployId),
    enabled: allowed,
    retry: false,
    refetchInterval: 2000,
  });
  return (
    <div className={'amp-block'} data-amp-mask data-dd-privacy={'hidden'}>
      {permissions.isPending || (!allowed && environmentPending) ? (
        <Spin />
      ) : !allowed ? (
        <Alert
          type={'error'}
          message={'You do not have permission to read these deployment logs.'}
        />
      ) : pipeline.isPending ? (
        <Spin />
      ) : pipeline.isError ? (
        <Alert type={'warning'} message={'Deployment execution could not be loaded.'} />
      ) : pipeline.data ? (
        <PipelineLogs
          execution={pipeline.data}
          scope={{ orgId, projectId, envId }}
          id={deployId}
          requested={search.get('log')}
          canRead={allowed}
          onSelect={(kind) => setSearch({ log: kind }, { replace: true })}
        />
      ) : (
        <DeploymentLogs key={`${orgId}/${deployId}`} orgId={orgId} deploymentId={deployId} />
      )}
    </div>
  );
};

const PipelineLogs = ({
  execution,
  scope,
  id,
  requested,
  canRead,
  onSelect,
}: {
  execution: NonNullable<Awaited<ReturnType<typeof getDeploymentPipeline>>> & {
    native_logs?: boolean;
    progress: NativeLogProgress;
  };
  scope: { orgId: string; projectId: string; envId: string };
  id: string;
  requested: string | null;
  canRead: boolean;
  onSelect: (kind: string) => void;
}) => {
  const hasPlan =
    execution.definition.strategy === 'plan' ||
    execution.definition.strategy === 'reviewed' ||
    Boolean(execution.source_plan_id);
  const hasApply = executionHasStarted(execution);
  const kind = hasPlan && (requested === 'plan' || !hasApply) ? 'plan' : 'apply';
  return (
    <Space direction={'vertical'} style={{ width: '100%' }}>
      {hasPlan && hasApply && (
        <Segmented
          aria-label={'Log phase'}
          value={kind}
          options={[
            { value: 'plan', label: 'Plan logs' },
            { value: 'apply', label: 'Apply logs' },
          ]}
          onChange={onSelect}
        />
      )}
      {execution.native_logs ? (
        <NativePhaseLogs
          key={`${scope.orgId}/${id}/${kind}`}
          scope={scope}
          phase={kind}
          progress={execution.progress}
          canRead={canRead}
          renderLogs={(selection, subject) =>
            kind === 'plan' ? (
              <PipelinePlanLogs
                scope={scope}
                id={id}
                subject={subject}
                canRead={canRead}
                nativeSelection={selection}
              />
            ) : (
              <DeploymentLogs
                key={JSON.stringify(selection)}
                orgId={scope.orgId}
                deploymentId={id}
                pipeline
                title={'Apply logs'}
                nativeSelection={{ ...selection, phase: 'apply' }}
              />
            )
          }
        />
      ) : kind === 'plan' ? (
        <PipelinePlanLogs
          scope={scope}
          id={id}
          subject={execution.progress.subject ?? ''}
          canRead={canRead}
        />
      ) : hasApply ? (
        <DeploymentLogs
          key={`${scope.orgId}/${id}`}
          orgId={scope.orgId}
          deploymentId={id}
          pipeline
          title={execution.definition.strategy === 'destroy' ? 'Execution logs' : 'Apply logs'}
        />
      ) : (
        <Alert
          type={'info'}
          message={'Apply has not started. Its logs will be available here after execution begins.'}
        />
      )}
    </Space>
  );
};
