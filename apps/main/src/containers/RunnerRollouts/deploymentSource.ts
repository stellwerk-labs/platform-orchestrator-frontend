import { invokePluginOperation } from '@src/plugins/pluginInvocation';
import { pluginHostRoute } from '@src/plugins/pluginValidation';
import type { PluginDescriptor } from '@src/plugins/types';

export const deploymentSourceOperation = 'resolveDeploymentSource';

export const hasDeploymentSource = (plugin: PluginDescriptor) =>
  plugin.operations.some(
    (operation) =>
      operation.id === deploymentSourceOperation &&
      operation.method === 'GET' &&
      operation.mutating === false,
  );

export const resolveDeploymentSource = async (
  orgId: string,
  plugin: PluginDescriptor,
  requestId: string,
) => {
  const response = await invokePluginOperation(orgId, plugin.id, {
    operation_id: deploymentSourceOperation,
    path_parameters: { requestId },
  });
  const route = (response.body as { route?: unknown } | null)?.route;
  if (
    response.status !== 200 ||
    typeof route !== 'string' ||
    route.length > 512 ||
    !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/u.test(route) ||
    !plugin.ui
  ) {
    throw new Error('The source is unavailable.');
  }
  return pluginHostRoute(orgId, plugin.ui.route_prefix, route);
};
