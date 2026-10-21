import { RouteObject, UIMatch } from 'react-router';

import { generatePluginManagerUrl } from '@src/utilities/navigation';

import { PluginInstallationDetails } from './PluginInstallationDetails';
import { PluginInstallations } from './PluginInstallations';
import { PluginManagerGate } from './PluginManagerGate';

export const pluginManagerRoute: RouteObject = {
  path: 'platform/plugins',
  element: <PluginManagerGate />,
  children: [
    {
      index: true,
      handle: { crumbs: () => [{ label: 'Platform', name: 'Plugin Manager' }] },
      element: <PluginInstallations />,
    },
    {
      path: ':installationId',
      handle: {
        crumbs: (match: UIMatch) => [
          { label: 'Platform', name: 'Plugin Manager', pathname: generatePluginManagerUrl() },
          { label: 'Installation', name: match.params.installationId },
        ],
      },
      element: <PluginInstallationDetails />,
    },
  ],
};
