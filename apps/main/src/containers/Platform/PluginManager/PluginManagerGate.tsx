import { Flex, Spin } from 'antd';
import { Outlet } from 'react-router';

import { ErrorPage } from '@src/components/shared/ErrorPage/ErrorPage';
import { PLATFORM_RESOURCE, RBACPermission, RBACStatus, useRBAC } from '@src/hooks/useRBAC';

/**
 * Renders the Plugin Manager views only for platform operators. Nothing below the gate
 * is mounted, so no Plugin Manager request is sent before the permission is known.
 */
export const PluginManagerGate = () => {
  const status = useRBAC(RBACPermission.PLUGIN_MANAGER_READ, PLATFORM_RESOURCE);

  if (status === RBACStatus.LOADING) {
    return (
      <Flex justify={'center'} style={{ padding: 48 }}>
        <Spin />
      </Flex>
    );
  }

  if (status === RBACStatus.NOT_ALLOWED) {
    return (
      <ErrorPage
        title={"You don't have access to the Plugin Manager"}
        descriptionTexts={[
          'Viewing plugin installations needs the platform permission plugin_manager_read, which the operators of this installation grant.',
        ]}
      />
    );
  }

  return <Outlet />;
};
