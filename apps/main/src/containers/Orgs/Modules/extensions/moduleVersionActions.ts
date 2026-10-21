import type { CoreModuleVersion } from '@src/models/v2/controlplane';
import { resolveModuleVersionContextualActions } from '@src/plugins/contextualActions';
import type { PluginDescriptor, PluginFrameHost } from '@src/plugins/types';

export interface ModuleVersionActionContext {
  orgId: string;
  moduleId: string;
  version: CoreModuleVersion;
}

export interface ModuleVersionExtensionAction {
  id: string;
  label: string;
  href: string;
  primary?: boolean;
}

export const moduleVersionExtensionActions = (
  context: ModuleVersionActionContext,
  plugins: PluginDescriptor[],
  host: PluginFrameHost,
): ModuleVersionExtensionAction[] => resolveModuleVersionContextualActions(plugins, context, host);
