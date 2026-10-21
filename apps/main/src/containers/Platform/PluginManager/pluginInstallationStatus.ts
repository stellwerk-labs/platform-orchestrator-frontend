import { useQuery } from '@tanstack/react-query';

import type { ErrorType } from '@src/custom-instance';
import {
  getListPluginAuditEventsQueryKey,
  listPluginAuditEvents,
} from '@src/hooks/react-query/v2/controlplane/plugin-manager/plugin-manager';
import type {
  Error as ApiError,
  PluginAuditEvent,
  PluginEnablement,
  PluginEntitlementGrant,
  PluginInstallation,
  PluginPackage,
} from '@src/models/v2/controlplane';

const auditPageSize = 200;
const recentAuditEvents = 20;

export const grantStateColors: Record<PluginEntitlementGrant['state'], string> = {
  valid: 'green',
  grace: 'gold',
  not_yet_valid: 'default',
  expired: 'red',
  revoked: 'red',
  untrusted: 'red',
};

export const registrationStateColors: Record<
  PluginEnablement['capability_registration']['state'],
  string
> = {
  registered: 'green',
  pending: 'gold',
  failed: 'red',
};

export const enabledOrganizations = (installation: PluginInstallation) =>
  installation.organizations.filter(({ state }) => state === 'enabled');

export const registrationProblems = (installation: PluginInstallation) => ({
  failed: installation.organizations.filter(
    ({ capability_registration }) => capability_registration.state === 'failed',
  ),
  pending: installation.organizations.filter(
    ({ capability_registration }) => capability_registration.state === 'pending',
  ),
});

export const packageVersion = (packages: PluginPackage[] | undefined, digest: string) =>
  packages?.find(({ manifest_sha256 }) => manifest_sha256 === digest)?.version;

export const shortDigest = (digest: string) => digest.slice(0, 12);

/**
 * The audit trail has no filter and no tail read: it is read in commit order from the
 * start, so the recent events of one installation come from walking it to the end.
 */
const fetchAuditTrail = async (): Promise<PluginAuditEvent[]> => {
  const events: PluginAuditEvent[] = [];
  let after = 0;
  for (;;) {
    const { items } = await listPluginAuditEvents({ after, limit: auditPageSize });
    events.push(...items);
    const last = items[items.length - 1];
    if (!last || items.length < auditPageSize) return events;
    after = last.id;
  }
};

export const useRecentInstallationAuditEvents = (installationId: string) =>
  useQuery<PluginAuditEvent[], ErrorType<ApiError>, PluginAuditEvent[]>({
    queryKey: [...getListPluginAuditEventsQueryKey(), 'trail'],
    queryFn: fetchAuditTrail,
    select: (events) =>
      events
        .filter((event) => event.installation_id === installationId)
        .slice(-recentAuditEvents)
        .reverse(),
  });
