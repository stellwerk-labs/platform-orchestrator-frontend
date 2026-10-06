import { Alert, Flex } from 'antd';

import type { PluginDescriptor } from './types';

export const PluginAvailabilityNotice = ({ plugin }: { plugin: PluginDescriptor }) => {
  const features = Object.values(plugin.entitlement?.features ?? {});
  const development = features.some((feature) => feature.trust_class === 'development');
  const restricted = plugin.mode === 'read_only' || plugin.mode === 'safety_only';
  const partial = !restricted && features.some((feature) => !feature.forward);
  if (!development && !restricted && !partial) return null;

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
