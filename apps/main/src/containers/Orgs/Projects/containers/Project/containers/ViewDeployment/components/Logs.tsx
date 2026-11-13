import { Alert, Button, Card, Input, Space, Spin, Typography } from 'antd';
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';

import { RunnerLogs } from '@src/components/shared/RunnerLogs';
import { windowEnv } from '@src/config/environment';
import { MatchParams } from '@src/config/routing';
import { RBACPermission, RBACStatus, useRBAC } from '@src/hooks/useRBAC';

import { loadDeploymentLogs, maximumLogKeyFileBytes, parseLogKey } from './deploymentLogsApi';

const DeploymentLogs = ({ orgId, deploymentId }: { orgId: string; deploymentId: string }) => {
  const [key, setKey] = useState('');
  const [content, setContent] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | undefined>(undefined);

  useEffect(
    () => () => {
      generation.current += 1;
      controller.current?.abort();
    },
    [],
  );

  const clear = () => {
    generation.current += 1;
    controller.current?.abort();
    setKey('');
    setContent(undefined);
    setError(undefined);
    setBusy(false);
  };

  const importKey = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const attempt = ++generation.current;
    setKey('');
    setContent(undefined);
    setError(undefined);
    setBusy(true);
    try {
      if (file.size > maximumLogKeyFileBytes)
        throw new Error('Key files must be no larger than 4 KiB.');
      const imported = parseLogKey(await file.text());
      if (attempt === generation.current) setKey(imported);
    } catch {
      if (attempt === generation.current)
        setError('Choose a key file up to 4 KiB containing exactly one age secret key.');
    } finally {
      if (attempt === generation.current) setBusy(false);
    }
  };

  const load = async (event: FormEvent) => {
    event.preventDefault();
    const attempt = ++generation.current;
    setContent(undefined);
    setError(undefined);
    setKey('');
    setBusy(true);
    const request = new AbortController();
    controller.current = request;
    const timeout = window.setTimeout(() => request.abort(), 30_000);
    try {
      const apiBaseURL = new URL(windowEnv.BASE_URL || '/', window.location.origin).href;
      const loaded = await loadDeploymentLogs(
        apiBaseURL,
        orgId,
        deploymentId,
        parseLogKey(key),
        request.signal,
      );
      if (attempt === generation.current) setContent(loaded);
    } catch (failure) {
      if (attempt === generation.current)
        setError(failure instanceof Error ? failure.message : 'The logs could not be loaded.');
    } finally {
      window.clearTimeout(timeout);
      if (attempt === generation.current) setBusy(false);
    }
  };

  return (
    <Card title={'Runner logs'}>
      <Space direction={'vertical'} style={{ width: '100%' }}>
        <Typography.Paragraph>
          Logs are encrypted and retained for up to 30 days. Enter the age secret key for this
          deployment or load its key file. Your key is sent to the Orchestrator API to decrypt this
          request. The Console does not save your key, and clears the input after every request.
        </Typography.Paragraph>
        <Typography.Paragraph type={'secondary'}>
          For future CLI deployments, retain the key with{' '}
          <Typography.Text code>--print-logs-key</Typography.Text>. A lost key cannot be recovered.
        </Typography.Paragraph>
        <form onSubmit={(event) => void load(event)}>
          <Space direction={'vertical'} style={{ width: '100%' }}>
            <label htmlFor={'deployment-log-key'}>Log decryption key</label>
            <Input.Password
              id={'deployment-log-key'}
              autoComplete={'off'}
              value={key}
              onChange={(event) => setKey(event.target.value)}
              disabled={busy}
            />
            <label htmlFor={'deployment-log-key-file'}>Load key file</label>
            <input
              id={'deployment-log-key-file'}
              type={'file'}
              disabled={busy}
              onChange={(event) => void importKey(event)}
            />
            <Space>
              <Button type={'primary'} htmlType={'submit'} loading={busy} disabled={!key.trim()}>
                Load logs
              </Button>
              <Button onClick={clear}>Clear logs and key</Button>
            </Space>
          </Space>
        </form>
        {error && <Alert type={'error'} showIcon message={error} />}
        {content !== undefined &&
          (content ? (
            <RunnerLogs content={content} />
          ) : (
            <Alert type={'info'} message={'This deployment returned an empty log.'} />
          ))}
      </Space>
    </Card>
  );
};

export const Logs = () => {
  const { orgId, deployId } = useParams<keyof MatchParams>() as MatchParams & { deployId: string };
  const permission = useRBAC(RBACPermission.DEPLOYMENT_READ);
  return (
    <div className={'amp-block'} data-amp-mask data-dd-privacy={'hidden'}>
      {permission === RBACStatus.LOADING ? (
        <Spin />
      ) : permission === RBACStatus.NOT_ALLOWED ? (
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
