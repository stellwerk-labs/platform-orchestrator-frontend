import { AppstoreAddOutlined } from '@ant-design/icons';
import { Menu } from 'antd';
import type { KeyboardEvent } from 'react';
import { Link } from 'react-router';

import { useListPlugins } from './pluginDiscovery';
import {
  consolePluginFrameHost,
  isPluginDescriptor,
  normalizePluginRoutePrefix,
  validatePluginFrameUrl,
} from './pluginValidation';

interface PluginNavigationItemsProps {
  orgId: string;
  onKeyDown: (event: KeyboardEvent<HTMLLIElement>) => void;
}

export const PluginNavigationItems = ({ orgId, onKeyDown }: PluginNavigationItemsProps) => {
  const discovery = useListPlugins(orgId);
  const plugins = (discovery.data?.items ?? [])
    .filter(isPluginDescriptor)
    .filter(({ mode, ui }) => mode !== 'hidden' && ui)
    .filter((plugin) => {
      try {
        validatePluginFrameUrl(plugin.ui!, consolePluginFrameHost());
        return true;
      } catch {
        return false;
      }
    })
    .sort((left, right) => left.ui!.navigation_label.localeCompare(right.ui!.navigation_label));

  return plugins.map((plugin) => {
    const routePrefix = normalizePluginRoutePrefix(plugin.ui!.route_prefix);
    return (
      <Menu.Item
        key={`plugin:${plugin.id}`}
        icon={<AppstoreAddOutlined />}
        tabIndex={0}
        onKeyDown={onKeyDown}>
        <Link to={`/orgs/${encodeURIComponent(orgId)}/${routePrefix}`} tabIndex={-1}>
          {plugin.ui!.navigation_label}
        </Link>
      </Menu.Item>
    );
  });
};
