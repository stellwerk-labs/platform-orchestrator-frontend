import { useQuery } from '@tanstack/react-query';
import { Alert, Descriptions, List, Space, Typography } from 'antd';

import { getMaintenanceStatus, maintenanceStatusPath } from './settingsApi';

const stateText = {
  running: 'The installation accepts work.',
  resuming: 'Resuming, waiting for all plugins to confirm.',
  draining: 'Draining, maintenance cannot start yet.',
  ready: 'Ready for maintenance. Accepted work has finished and plugins are paused.',
  unknown: 'Not ready. The pause state could not be verified.',
};

export const MaintenanceDrainStatus = ({
  revision,
  enabled,
}: {
  revision: number;
  enabled: boolean;
}) => {
  const query = useQuery({
    queryKey: [maintenanceStatusPath],
    queryFn: getMaintenanceStatus,
    refetchInterval: 5_000,
  });
  if (query.isPending) return <Typography.Text>Checking remaining work…</Typography.Text>;
  if (query.isError)
    return <Alert type={'error'} message={'Not ready. Remaining work could not be verified.'} />;
  const value = query.data;
  if (value.revision !== revision || value.enabled !== enabled)
    return (
      <Alert
        type={'warning'}
        message={'Not ready. Waiting for the current maintenance revision to be verified.'}
      />
    );
  const dp = value.data_plane;
  const counts = dp
    ? [
        ['Executing deployments', dp.executing_deployments],
        ['Queued deployments', dp.queued_deployments],
        ['Runner jobs awaiting stop evidence', dp.runner_reservations],
        ['Admissions awaiting settlement', dp.unsettled_admissions],
        ['Executing Drift observations (deployment subset)', dp.executing_observations],
        ['Unsettled plugin dispatches', value.unsettled_dispatches],
        ['Unresolved observation requests', value.unresolved_observations],
      ]
    : [];
  return (
    <Space direction={'vertical'} style={{ width: '100%' }}>
      <Alert
        type={value.state === 'ready' ? 'success' : value.state === 'running' ? 'info' : 'warning'}
        message={stateText[value.state]}
        description={value.diagnostic}
      />
      <Descriptions
        column={1}
        size={'small'}
        items={counts.map(([label, children]) => ({ key: label, label, children }))}
      />
      <List
        size={'small'}
        dataSource={value.plugins}
        renderItem={(plugin) => (
          <List.Item>
            <Typography.Text>
              {plugin.plugin_id}:{' '}
              {plugin.diagnostic ||
                `${plugin.enabled ? 'paused' : 'running'}, ${plugin.unresolved} unresolved effects, ${plugin.parked} parked workflows or schedules`}
            </Typography.Text>
          </List.Item>
        )}
      />
      <Typography.Text type={'secondary'}>
        Counts overlap and are not added together. Only “Ready for maintenance” confirms that every
        installed plugin and Core has reached the same maintenance revision.
      </Typography.Text>
    </Space>
  );
};
