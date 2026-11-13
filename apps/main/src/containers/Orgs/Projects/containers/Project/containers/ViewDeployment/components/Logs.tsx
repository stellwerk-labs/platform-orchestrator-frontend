import { Alert, Button, Card, Flex, Space, Spin, Typography } from 'antd';
import { type ReactNode, useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { RunnerLogs } from '@src/components/shared/RunnerLogs';
import { windowEnv } from '@src/config/environment';
import { MatchParams } from '@src/config/routing';
import { useGetEnvironment } from '@src/hooks/react-query/v2/controlplane/environment/environment';
import { RBACPermission, useRBACPermissions } from '@src/hooks/useRBAC';

import { loadDeploymentLogs } from './deploymentLogsApi';

const DeploymentLogs = ({ orgId, deploymentId }: { orgId: string; deploymentId: string }) => {
  const [content, setContent] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(true);
  const [visible, setVisible] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let current = true;
    const request = new AbortController();
    const timeout = window.setTimeout(() => request.abort(), 30_000);
    setContent(undefined);
    setError(undefined);
    setBusy(true);
    const apiBaseURL = new URL(windowEnv.BASE_URL || '/', window.location.origin).href;
    void loadDeploymentLogs(apiBaseURL, orgId, deploymentId, request.signal)
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
  }, [orgId, deploymentId, revision, visible]);

  const clear = () => {
    setVisible(false);
    setContent(undefined);
    setError(undefined);
    setBusy(false);
  };

  const renderToolbar = (rawToggle?: ReactNode) => (
    <Flex align={'center'} gap={8} style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}>
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
      <Typography.Text type={'secondary'} style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
        Logs are encrypted and retained for up to 30 days. The Orchestrator manages decryption keys
        for deployments using automatic log access. Your deployment log permission controls access
        to their contents.
      </Typography.Text>
    </Flex>
  );

  return (
    <Card>
      <Space direction={'vertical'} style={{ width: '100%' }}>
        {!content && renderToolbar()}
        {error && <Alert type={'error'} showIcon message={error} />}
        {content !== undefined &&
          (content ? (
            <RunnerLogs content={content} renderToolbar={renderToolbar} />
          ) : (
            <Alert type={'info'} message={'This deployment returned an empty log.'} />
          ))}
      </Space>
    </Card>
  );
};

export const Logs = () => {
  const { orgId, projectId, envId, deployId } = useParams<keyof MatchParams>() as MatchParams & {
    deployId: string;
  };
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
  const checks = [orgCheck];
  if (environment) checks.push({ ...orgCheck, resource: `env:${environment.uuid}` });
  const permissions = useRBACPermissions(checks);
  const allowed = checks.some((check) => permissions.allowed(check));
  return (
    <div className={'amp-block'} data-amp-mask data-dd-privacy={'hidden'}>
      {permissions.isPending || (!allowed && environmentPending) ? (
        <Spin />
      ) : !allowed ? (
        <Alert
          type={'error'}
          message={'You do not have permission to read these deployment logs.'}
        />
      ) : (
        <DeploymentLogs key={`${orgId}/${deployId}`} orgId={orgId} deploymentId={deployId} />
      )}
    </div>
  );
};
