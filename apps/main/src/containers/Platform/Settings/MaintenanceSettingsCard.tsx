import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Card, Space, Switch, Typography } from 'antd';

import { MaintenanceDrainStatus } from './MaintenanceDrainStatus';
import {
  getMaintenance,
  maintenancePath,
  maintenanceStatusPath,
  putMaintenance,
  settingsErrorMessage,
} from './settingsApi';
import { SettingsError } from './SettingsError';

export const MaintenanceSettingsCard = ({ canWrite }: { canWrite: boolean }) => {
  const client = useQueryClient();
  const { modal, message } = App.useApp();
  const query = useQuery({
    queryKey: [maintenancePath],
    queryFn: getMaintenance,
    refetchInterval: 10_000,
  });
  const save = useMutation({
    mutationFn: putMaintenance,
    onError: (error) => void message.error(settingsErrorMessage(error)),
    onSuccess: (value) => {
      client.setQueryData([maintenancePath], value);
      void client.invalidateQueries({ queryKey: [maintenanceStatusPath] });
      void message.success(
        value.enabled ? 'Maintenance mode enabled.' : 'Maintenance mode disabled.',
      );
    },
  });
  if (query.isPending) return <Card title={'Maintenance mode'} loading />;
  if (query.isError)
    return <SettingsError error={query.error} retry={() => void query.refetch()} />;
  const confirm = (enabled: boolean) => {
    const revision = query.data.revision;
    modal.confirm({
      title: enabled ? 'Enable maintenance mode?' : 'Accept new deployments again?',
      content: enabled
        ? 'Already accepted deployments and queued requests will continue. New work receives HTTP 503 and can retry later. This does not stop the services or upgrade them.'
        : 'New deployment requests will be accepted again.',
      okText: enabled ? 'Enable maintenance' : 'Resume deployments',
      onOk: () =>
        save.mutateAsync({ enabled, revision }).then(
          () => undefined,
          () => undefined,
        ),
    });
  };
  return (
    <Card title={'Maintenance mode'}>
      <Space direction={'vertical'} size={'middle'}>
        <Alert
          type={query.data.enabled ? 'warning' : 'success'}
          message={
            query.data.enabled
              ? 'Maintenance mode is enabled. New deployments are refused.'
              : 'The installation accepts new deployments.'
          }
        />
        <Typography.Paragraph>
          Accepted deployments and queued requests continue. Drift scheduling and Rollout
          progression pause until maintenance ends. Reading, cancellation and Runner results remain
          available.
        </Typography.Paragraph>
        <MaintenanceDrainStatus revision={query.data.revision} enabled={query.data.enabled} />
        <Switch
          checked={query.data.enabled}
          disabled={!canWrite || save.isPending}
          loading={save.isPending}
          aria-label={'Maintenance mode'}
          onChange={confirm}
        />
      </Space>
      {save.isError && (
        <SettingsError
          error={save.error}
          retry={() => {
            save.reset();
            void query.refetch();
          }}
        />
      )}
    </Card>
  );
};
