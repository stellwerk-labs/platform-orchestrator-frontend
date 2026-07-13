import { Button, Flex, Spin, Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate, useParams } from 'react-router';

import { ErrorPage } from '@src/components/shared/ErrorPage/ErrorPage';
import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { MatchParams } from '@src/config/routing';
import { ModuleBasicInfo } from '@src/containers/Orgs/Modules/components/ModuleBasicInfo';
import { useGetModule } from '@src/hooks/react-query/v2/controlplane/modules/modules';

export const ModuleDetails = () => {
  // i18n
  const { t } = useTranslation();
  const resourcesTranslations = t('ACCOUNT_SETTINGS').RESOURCES;

  // router
  const { orgId, moduleId } = useParams<keyof MatchParams>() as MatchParams;
  const navigate = useNavigate();

  // React Query
  const { data: moduleDefinition, isPending: isResourceDefinitionLoading } = useGetModule(
    orgId,
    moduleId,
  );

  return isResourceDefinitionLoading ? (
    <Flex align={'center'} justify={'center'} style={{ height: '100%', width: '100%' }}>
      <Spin />
    </Flex>
  ) : moduleDefinition ? (
    <>
      <PageHeader />
      <ModuleBasicInfo />
      <Tabs
        onChange={(key) => navigate(key)}
        items={[
          { label: 'Definition', key: 'configuration' },
          { label: 'Rules', key: 'rules' },
        ]}
      />
      <Outlet />
    </>
  ) : (
    <ErrorPage
      title={resourcesTranslations.RESROUCE_DEFINTIION_NOT_FOUND}
      buttons={
        <Button variant={'outlined'} href={`/orgs/${orgId}/resources`}>
          {resourcesTranslations.GO_TO_RESOURCE_DEFINITIONS}
        </Button>
      }
    />
  );
};
