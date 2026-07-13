import { BarsOutlined, TeamOutlined } from '@ant-design/icons';
import { Tabs } from 'antd';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router';

import { ErrorPage } from '@src/components/shared/ErrorPage/ErrorPage';
import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { MatchParams } from '@src/config/routing';
import { useGetProject } from '@src/hooks/react-query/v2/controlplane/project/project';
import { setLastVisitedApp } from '@src/utilities/local-storage';

export const Project = () => {
  const { t } = useTranslation('viewApplication');
  const tabsTranslations = t('TABS');

  const { orgId, projectId } = useParams<keyof MatchParams>() as MatchParams;
  const { isError: projectLoadingError } = useGetProject(orgId, projectId);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setLastVisitedApp(projectId);
  }, [projectId]);

  const handleTabChange = (key: string) => {
    navigate(key);
  };

  const activeTab = useMemo(() => {
    const path = location.pathname;
    if (path.includes('/access')) {
      return 'access';
    }
    return 'envs';
  }, [location.pathname]);

  return (
    <>
      {projectLoadingError ? (
        <ErrorPage title={t('PROJECT_NOT_FOUND') as string} />
      ) : (
        <>
          <PageHeader showPageContext />
          <Tabs
            activeKey={activeTab}
            items={[
              {
                label: tabsTranslations.ENVIRONMENTS,
                icon: <BarsOutlined />,
                key: 'envs',
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
      )}
    </>
  );
};
