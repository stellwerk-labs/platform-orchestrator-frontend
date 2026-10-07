import { Alert, Flex } from 'antd';

import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';

import { entitlementWarning } from './pluginValidation';
import type { PluginDescriptor } from './types';

export const PluginAvailabilityNotice = ({ plugin }: { plugin: PluginDescriptor }) => {
  const features = Object.values(plugin.entitlement?.features ?? {});
  const development = features.some((feature) => feature.trust_class === 'development');
  const restricted = plugin.mode === 'read_only' || plugin.mode === 'safety_only';
  const partial = !restricted && features.some((feature) => !feature.forward);
  const grace = entitlementWarning(plugin);
  if (!development && !restricted && !partial && !grace) return null;

  return (
    <Flex vertical gap={8} style={{ marginBottom: 16 }}>
      {development && (
        <Alert
          type={'warning'}
          showIcon
          message={`${plugin.display_name}: development licence`}
          description={
            'This installation uses a development-only licence, not a production licence.'
          }
        />
      )}
      {grace && (
        <Alert
          type={'warning'}
          showIcon
          message={`${plugin.display_name}: licence grace period until ${formatDate(grace.grace_until, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE)}`}
          description={grace.message}
        />
      )}
      {(restricted || partial) && (
        <Alert
          type={'warning'}
          showIcon
          message={`${plugin.display_name}: ${restricted ? 'new work disabled' : 'limited licence access'}`}
          description={
            restricted
              ? 'History and supported safety actions remain available according to your permissions. Ask an administrator to check plugin enablement and the signed licence. Renewal does not restart paused work.'
              : 'Some features are unavailable under the current licence. Only server-approved actions are available; your permissions still apply.'
          }
        />
      )}
    </Flex>
  );
};
