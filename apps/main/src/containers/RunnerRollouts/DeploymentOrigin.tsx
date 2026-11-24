import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Space, Typography } from 'antd';

import { useListPlugins } from '@src/plugins/pluginDiscovery';
import { isPluginDescriptor, pluginHostRoute } from '@src/plugins/pluginValidation';
import type { PluginDescriptor } from '@src/plugins/types';

import { DeploymentLink } from './DeploymentLink';
import type { DeploymentPipeline } from './deploymentPipelineApi';
import { hasDeploymentSource, resolveDeploymentSource } from './deploymentSource';

const SourceLink = ({
  orgId,
  plugin,
  requestId,
}: {
  orgId: string;
  plugin: PluginDescriptor;
  requestId: string;
}) => {
  const supported = hasDeploymentSource(plugin);
  const source = useQuery({
    queryKey: ['deployment-source', orgId, plugin.id, requestId, plugin.version, plugin.ui],
    queryFn: () => resolveDeploymentSource(orgId, plugin, requestId),
    enabled: supported,
    retry: false,
  });
  if (!supported)
    return (
      <DeploymentLink
        url={pluginHostRoute(
          orgId,
          plugin.ui!.route_prefix,
        )}>{`Open ${plugin.display_name}`}</DeploymentLink>
    );
  if (source.isError)
    return (
      <Space direction={'vertical'}>
        <Typography.Text>Source unavailable</Typography.Text>
        <Button onClick={() => void source.refetch()}>Retry source link</Button>
      </Space>
    );
  if (!source.data)
    return (
      <Button loading disabled>
        Locating source
      </Button>
    );
  return <DeploymentLink url={source.data}>{`Open ${plugin.display_name}`}</DeploymentLink>;
};

export const DeploymentOrigin = ({
  orgId,
  origin,
}: {
  orgId: string;
  origin: NonNullable<DeploymentPipeline['origin']>;
}) => {
  const plugins = useListPlugins(orgId);
  const plugin = plugins.data?.items
    .filter(isPluginDescriptor)
    .find((item) => item.id === origin.plugin_id);
  const name = plugin?.display_name ?? origin.plugin_id;
  return (
    <Alert
      type={'info'}
      showIcon
      message={`Started by ${name}`}
      description={
        <Space direction={'vertical'} size={'small'}>
          <Typography.Text>
            Source request: <Typography.Text copyable>{origin.request_id}</Typography.Text>
          </Typography.Text>
          {origin.operation_ref && (
            <Typography.Text>
              Operation: <Typography.Text copyable>{origin.operation_ref}</Typography.Text>
            </Typography.Text>
          )}
          {origin.observation_run_id && (
            <Typography.Text>
              Observation: <Typography.Text copyable>{origin.observation_run_id}</Typography.Text>
            </Typography.Text>
          )}
        </Space>
      }
      action={
        plugin?.ui && plugin.mode !== 'hidden' ? (
          <SourceLink orgId={orgId} plugin={plugin} requestId={origin.request_id} />
        ) : undefined
      }
    />
  );
};
