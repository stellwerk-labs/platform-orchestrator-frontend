import { Alert, Flex, Spin, Typography } from 'antd';
import type { RouteObject } from 'react-router';

import { ErrorPage } from '@src/components/shared/ErrorPage/ErrorPage';
import { PLATFORM_RESOURCE, RBACPermission, RBACStatus, useRBAC } from '@src/hooks/useRBAC';

import { MaintenanceSettingsCard } from './MaintenanceSettingsCard';
import { SessionSettingsCard } from './SessionSettingsCard';

const SettingsPage = () => {
  const canWrite =
    useRBAC(RBACPermission.PLATFORM_SETTINGS_WRITE, PLATFORM_RESOURCE) === RBACStatus.ALLOWED;
  return (
    <Flex vertical gap={'large'}>
      <Typography.Title level={2}>Configuration</Typography.Title>
      <Typography.Paragraph>
        These settings apply to every organization in this installation.
      </Typography.Paragraph>
      {!canWrite && (
        <Alert
          type={'info'}
          message={'Read-only access. Changing settings requires platform_settings_write.'}
        />
      )}
      <SessionSettingsCard canWrite={canWrite} />
      <MaintenanceSettingsCard canWrite={canWrite} />
    </Flex>
  );
};
export const PlatformSettingsGate = () => {
  const status = useRBAC(RBACPermission.PLATFORM_SETTINGS_READ, PLATFORM_RESOURCE);
  if (status === RBACStatus.LOADING) return <Spin />;
  if (status !== RBACStatus.ALLOWED)
    return (
      <ErrorPage
        title={'Installation settings are restricted'}
        descriptionTexts={[
          'The installation operator must grant platform_settings_read. Organization roles do not grant access.',
        ]}
      />
    );
  return <SettingsPage />;
};
export const platformSettingsRoute: RouteObject = {
  path: 'platform/settings',
  element: <PlatformSettingsGate />,
  handle: { crumbs: () => [{ label: 'Administration', name: 'Configuration' }] },
};
