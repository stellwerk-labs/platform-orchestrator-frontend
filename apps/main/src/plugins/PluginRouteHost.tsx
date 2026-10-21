import { Alert, Card } from 'antd';
import { useLocation, useParams } from 'react-router';

import { ErrorPage } from '@src/components/shared/ErrorPage/ErrorPage';

import { PluginAvailabilityNotice } from './PluginAvailabilityNotice';
import { useListPlugins } from './pluginDiscovery';
import { PluginFrame } from './PluginFrame';
import {
  consolePluginFrameHost,
  findPluginForOrgPath,
  isPluginDescriptor,
  validatePluginFrameUrl,
} from './pluginValidation';

export const PluginRouteHost = () => {
  const { orgId = '' } = useParams();
  const location = useLocation();
  const discovery = useListPlugins(orgId);

  if (discovery.isLoading) return <Card loading />;
  if (discovery.isError) {
    return (
      <Alert
        type={'error'}
        showIcon
        message={'Plugin discovery failed'}
        description={discovery.error.message}
      />
    );
  }

  const orgMount = `/orgs/${encodeURIComponent(orgId)}/`;
  const orgPath = location.pathname.startsWith(orgMount)
    ? location.pathname.slice(orgMount.length)
    : '';
  const plugins = (discovery.data?.items ?? []).filter(isPluginDescriptor);
  const plugin = findPluginForOrgPath(plugins, orgPath);
  if (!plugin) return <ErrorPage />;

  try {
    validatePluginFrameUrl(plugin.ui!, consolePluginFrameHost());
    return (
      <>
        <PluginAvailabilityNotice plugin={plugin} />
        <PluginFrame key={`${orgId}:${plugin.id}`} orgId={orgId} plugin={plugin} />
      </>
    );
  } catch (error) {
    return (
      <Alert
        type={'error'}
        showIcon
        message={'Plugin UI registration is invalid'}
        description={error instanceof Error ? error.message : 'The UI descriptor was rejected.'}
      />
    );
  }
};
