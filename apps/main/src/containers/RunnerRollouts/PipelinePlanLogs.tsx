import { Alert, Button, Card, Flex, Space, Typography } from 'antd';
import { type ReactNode, useEffect, useState } from 'react';

import { RunnerLogs } from '@src/components/shared/RunnerLogs';
import { windowEnv } from '@src/config/environment';
import { loadDeploymentLogs } from '@src/containers/Orgs/Projects/containers/Project/containers/ViewDeployment/components/deploymentLogsApi';

import type { NativeLogSelection } from './NativePhaseLogs';
import { loadPlanLogs } from './planLogsApi';
import type { RolloutScope } from './rolloutApi';

type Props = {
  scope: RolloutScope;
  id: string;
  subject: string;
  nativeSelection?: NativeLogSelection;
};

const PlanLogContent = ({ scope, id, subject, nativeSelection }: Props) => {
  const { orgId, projectId, envId } = scope;
  const [visible, setVisible] = useState(true);
  const [revision, setRevision] = useState(0);
  const [content, setContent] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(true);
  const native = Boolean(nativeSelection);
  const executionId = nativeSelection?.executionId;
  const captureRevision = nativeSelection?.captureRevision;
  useEffect(() => {
    if (!visible) return;
    const request = new AbortController();
    let current = true;
    const timeout = window.setTimeout(() => request.abort(), 30_000);
    setContent(undefined);
    setError(undefined);
    setBusy(true);
    const apiBaseURL = new URL(windowEnv.BASE_URL || '/', window.location.origin).href;
    const load = native
      ? loadDeploymentLogs(apiBaseURL, orgId, id, request.signal, true, {
          executionId,
          captureRevision,
          phase: 'plan',
          subject,
        })
      : loadPlanLogs(apiBaseURL, { orgId, projectId, envId }, id, subject, request.signal);
    void load
      .then((loaded) => {
        if (current) setContent(loaded);
      })
      .catch((failure: unknown) => {
        if (current)
          setError(failure instanceof Error ? failure.message : 'Plan logs unavailable.');
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
  }, [
    visible,
    revision,
    orgId,
    projectId,
    envId,
    id,
    subject,
    native,
    executionId,
    captureRevision,
  ]);

  const clear = () => {
    setVisible(false);
    setContent(undefined);
    setError(undefined);
    setBusy(false);
  };
  const renderToolbar = (rawToggle?: ReactNode) => (
    <Flex gap={8} wrap align={'center'}>
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
          ? 'Plan logs use the retained encrypted artifact. Deployment log permission controls access.'
          : 'Plan logs are encrypted at the Runner and require a reachable site. Deployment log permission controls access.'}
      </Typography.Text>
    </Flex>
  );
  return (
    <Card title={'Plan logs'}>
      <Space direction={'vertical'} style={{ width: '100%' }}>
        {content === undefined && renderToolbar()}
        {error && <Alert type={'error'} showIcon message={error} />}
        {content !== undefined &&
          (content ? (
            <RunnerLogs content={content} renderToolbar={renderToolbar} scrollMode={'page'} />
          ) : (
            <>
              {renderToolbar()}
              <Alert type={'info'} message={'This run returned an empty plan log.'} />
            </>
          ))}
      </Space>
    </Card>
  );
};

export const PipelinePlanLogs = ({ canRead, ...props }: Props & { canRead: boolean }) => (
  <div className={'amp-block'} data-amp-mask data-dd-privacy={'hidden'}>
    {canRead ? (
      <PlanLogContent
        key={JSON.stringify([
          props.scope.orgId,
          props.scope.projectId,
          props.scope.envId,
          props.id,
          props.subject,
          props.nativeSelection?.executionId,
          props.nativeSelection?.captureRevision,
        ])}
        {...props}
      />
    ) : (
      <Alert
        type={'error'}
        showIcon
        message={'Deployment log permission is required to read plan logs.'}
      />
    )}
  </div>
);
