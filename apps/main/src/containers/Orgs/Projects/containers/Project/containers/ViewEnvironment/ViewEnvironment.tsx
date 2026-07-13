import {
  DeploymentUnitOutlined,
  LineChartOutlined,
  PartitionOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Tabs } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import { useGetEnvironment } from '@src/hooks/react-query/v2/controlplane/environment/environment';

import { ViewEnvironmentHeader } from './ViewEnvironmentHeader';

export const ViewEnvironment = () => {
  const { t } = useTranslation('viewEnvironment');
  const tabsTranslations = t('TABS');

  const { orgId, projectId, envId } = useParams<keyof MatchParams>() as MatchParams;
  const { data: environment } = useGetEnvironment(orgId, projectId, envId);

  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = useMemo(() => {
    const urlSegments = location.pathname.split('/');
    return urlSegments[urlSegments.length - 1];
  }, [location.pathname]);

  const handleTabChange = (key: string) => {
    navigate(key);
  };

  return (
    <>
      <ViewEnvironmentHeader environment={environment} />
      <Tabs
        activeKey={activeTab}
        items={[
          {
            label: tabsTranslations.STATUS,
            icon: <LineChartOutlined />,
            key: 'status',
          },
          {
            label: tabsTranslations.DEPLOYMENTS,
            icon: <UnorderedListOutlined />,
            key: 'deploys',
          },
          {
            label: tabsTranslations.RESOURCES,
            icon: <PartitionOutlined />,
            key: 'active-resources',
          },
          {
            label: 'Available resource types',
            icon: <DeploymentUnitOutlined />,
            key: 'available-resource-types',
          },
          {
            label: tabsTranslations.ACCESS,
            icon: <TeamOutlined />,
            key: 'access',
          },
        ]}
        onChange={handleTabChange}
      />

      <Outlet />
    </>
  );
};
