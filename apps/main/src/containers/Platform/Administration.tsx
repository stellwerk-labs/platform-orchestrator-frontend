import { Flex, Spin, Tabs, Typography } from 'antd';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';

import { ErrorPage } from '@src/components/shared/ErrorPage/ErrorPage';
import { PLATFORM_RESOURCE, RBACPermission, RBACStatus, useRBAC } from '@src/hooks/useRBAC';

export const Administration = () => {
  const plugins = useRBAC(RBACPermission.PLUGIN_MANAGER_READ, PLATFORM_RESOURCE);
  const settings = useRBAC(RBACPermission.PLATFORM_SETTINGS_READ, PLATFORM_RESOURCE);
  const location = useLocation();
  const navigate = useNavigate();
  const items = [
    ...(plugins === RBACStatus.ALLOWED
      ? [{ key: '/platform/plugins', label: 'Plugin Manager' }]
      : []),
    ...(settings === RBACStatus.ALLOWED
      ? [{ key: '/platform/settings', label: 'Configuration' }]
      : []),
  ];
  if (plugins === RBACStatus.LOADING || settings === RBACStatus.LOADING) return <Spin />;
  const first = items[0];
  if (!first)
    return (
      <ErrorPage
        title={'Administration is restricted'}
        descriptionTexts={['The installation operator must grant platform administration access.']}
      />
    );
  if (location.pathname === '/platform' || location.pathname === '/platform/')
    return <Navigate to={first.key} replace />;
  return (
    <Flex vertical>
      <Typography.Title level={1}>Administration</Typography.Title>
      <Tabs
        activeKey={
          location.pathname.startsWith('/platform/plugins')
            ? '/platform/plugins'
            : '/platform/settings'
        }
        items={items}
        onChange={(path) => void navigate(path)}
      />
      <Outlet />
    </Flex>
  );
};
