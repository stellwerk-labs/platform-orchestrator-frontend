import { customInstance } from '@src/custom-instance';

interface SettingsMetadata {
  revision: number;
  updated_at: string;
  updated_by: string | null;
}
export interface SessionPolicy extends SettingsMetadata {
  browser_idle_timeout: string;
  cli_token_ttl: string;
}
export type SessionPolicyValues = Pick<SessionPolicy, 'browser_idle_timeout' | 'cli_token_ttl'>;
export interface Maintenance extends SettingsMetadata {
  enabled: boolean;
  executing_deployments: number;
  queued_deployments: number;
}
export const sessionPath = '/platform-settings/sessions';
export const maintenancePath = '/platform-settings/deployments';
export const getSessionPolicy = () => customInstance<SessionPolicy>({ url: sessionPath });
export const putSessionPolicy = ({
  values,
  revision,
}: {
  values: SessionPolicyValues;
  revision: number;
}) =>
  customInstance<SessionPolicy>({
    url: sessionPath,
    method: 'PUT',
    data: values,
    headers: { 'If-Match': `"${revision}"` },
  });
export const getMaintenance = () => customInstance<Maintenance>({ url: maintenancePath });
export const putMaintenance = ({ enabled, revision }: { enabled: boolean; revision: number }) =>
  customInstance<Maintenance>({
    url: maintenancePath,
    method: 'PUT',
    data: { enabled },
    headers: { 'If-Match': `"${revision}"` },
  });
export const settingsErrorMessage = (error: unknown) => {
  const response = error as { response?: { status?: number; data?: { message?: string } } };
  if (response.response?.status === 412)
    return 'These settings changed elsewhere. Reload them before saving again.';
  return (
    response.response?.data?.message || 'The settings could not be loaded or saved. Try again.'
  );
};

export interface MaintenanceStatus {
  revision: number;
  enabled: boolean;
  state: 'running' | 'resuming' | 'draining' | 'ready' | 'unknown';
  diagnostic?: string;
  data_plane?: {
    executing_deployments: number;
    queued_deployments: number;
    runner_reservations: number;
    unsettled_admissions: number;
    executing_observations: number;
  };
  unsettled_dispatches: number;
  unresolved_observations: number;
  plugins: {
    plugin_id: string;
    revision: number;
    enabled: boolean;
    unresolved: number;
    parked: number;
    diagnostic?: string;
  }[];
}
export const maintenanceStatusPath = '/platform-settings/maintenance-status';
export const getMaintenanceStatus = () =>
  customInstance<MaintenanceStatus>({ url: maintenanceStatusPath });
