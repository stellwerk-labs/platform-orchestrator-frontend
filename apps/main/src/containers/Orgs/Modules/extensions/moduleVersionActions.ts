import type { CoreModuleVersion } from '@src/models/v2/controlplane';
import { resolveModuleVersionContextualActions } from '@src/plugins/contextualActions';
import type { PluginDescriptor } from '@src/plugins/types';

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
  hostOrigin: string,
  allowInsecureLocalhost = false,
): ModuleVersionExtensionAction[] =>
  resolveModuleVersionContextualActions(plugins, context, hostOrigin, allowInsecureLocalhost);
