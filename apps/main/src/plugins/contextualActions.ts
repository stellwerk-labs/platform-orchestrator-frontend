import type { CoreModuleVersion } from '@src/models/v2/controlplane';

import {
  isPluginContextualActionDescriptor,
  isPluginDescriptor,
  normalizePluginRoutePrefix,
  validatePluginFrameUrl,
} from './pluginValidation';
import type { PluginDescriptor, PluginModuleVersionContextValue } from './types';

export interface ModuleVersionContextualActionContext {
  orgId: string;
  moduleId: string;
  version: CoreModuleVersion;
}

export interface ResolvedPluginContextualAction {
  id: string;
  label: string;
  href: string;
  primary?: boolean;
}

const moduleVersionContextValue = (
  source: PluginModuleVersionContextValue,
  context: ModuleVersionContextualActionContext,
) => {
  switch (source) {
    case '$module_id':
      return context.moduleId;
    case '$semantic_version':
      return context.version.semantic_version;
    case '$version_uuid':
      return context.version.uuid;
    default:
      return undefined;
  }
};

export const resolveModuleVersionContextualActions = (
  descriptors: unknown[],
  context: ModuleVersionContextualActionContext,
  hostOrigin: string,
  allowInsecureLocalhost = false,
): ResolvedPluginContextualAction[] =>
  descriptors.flatMap((candidate) => {
    if (!isPluginDescriptor(candidate)) return [];
    const plugin: PluginDescriptor = candidate;
    if (plugin.state !== 'available' || plugin.mode !== 'full' || !plugin.ui) return [];
    const ui = plugin.ui;
    try {
      validatePluginFrameUrl(ui, hostOrigin, allowInsecureLocalhost);
    } catch {
      return [];
    }
    const operationIds = new Set(plugin.operations.map(({ id }) => id));
    return (ui.contextual_actions ?? []).flatMap((action) => {
      if (!isPluginContextualActionDescriptor(action, operationIds)) return [];
      if (!action.when.lifecycle_status.includes(context.version.lifecycle_status)) return [];
      if (action.when.semantic_version_required && !context.version.semantic_version) return [];

      const query = new URLSearchParams();
      for (const [key, source] of Object.entries(action.route.query ?? {})) {
        const value = moduleVersionContextValue(source, context);
        if (value === undefined) return [];
        query.set(key, value);
      }
      const routePrefix = normalizePluginRoutePrefix(ui.route_prefix);
      const suffix = query.size > 0 ? `?${query.toString()}` : '';
      return [
        {
          id: `${plugin.id}:${action.id}`,
          label: action.label,
          href: `/orgs/${encodeURIComponent(context.orgId)}/${routePrefix}/${action.route.path}${suffix}`,
          primary: action.primary,
        },
      ];
    });
  });
