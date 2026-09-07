import type { CoreModuleVersion } from '@src/models/v2/controlplane';

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

type ModuleVersionActionProvider = (
  context: ModuleVersionActionContext,
) => ModuleVersionExtensionAction[];

const providers: ModuleVersionActionProvider[] = [];

export const moduleVersionExtensionActions = (context: ModuleVersionActionContext) =>
  providers.flatMap((provider) => provider(context));
