import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Flex, Input, message, Modal, Spin, Tabs, Tag } from 'antd';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useMatch, useNavigate, useParams } from 'react-router';

import { ErrorPage } from '@src/components/shared/ErrorPage/ErrorPage';
import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { MatchParams } from '@src/config/routing';
import { ModuleBasicInfo } from '@src/containers/Orgs/Modules/components/ModuleBasicInfo';
import { invalidateModuleManagementQueries } from '@src/containers/Orgs/Modules/moduleManagementCache';
import {
  useChangeModuleCatalogueStatus,
  useGetModuleCatalogueEntry,
} from '@src/hooks/react-query/v2/controlplane/modules/modules';
import { RBACPermission, RBACStatus, useRBAC } from '@src/hooks/useRBAC';

export const ModuleDetails = () => {
  // i18n
  const { t } = useTranslation();
  const resourcesTranslations = t('ACCOUNT_SETTINGS').RESOURCES;

  // router
  const { orgId, moduleId } = useParams<keyof MatchParams>() as MatchParams;
  const tabMatch = useMatch('/orgs/:orgId/modules/:moduleId/:tab/*');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messageApi, messageContext] = message.useMessage();
  const [catalogueModalOpen, setCatalogueModalOpen] = useState(false);
  const [catalogueReason, setCatalogueReason] = useState('');
  const idempotencyKey = useRef(crypto.randomUUID());
  const canArchive = useRBAC(RBACPermission.MODULE_ARCHIVE) === RBACStatus.ALLOWED;

  // React Query
  const catalogue = useGetModuleCatalogueEntry(orgId, moduleId);
  const catalogueAction = catalogue.data?.status === 'archived' ? 'unarchive' : 'archive';
  const changeCatalogue = useChangeModuleCatalogueStatus({
    mutation: {
      onSuccess: async () => {
        await invalidateModuleManagementQueries(queryClient, orgId, moduleId);
        idempotencyKey.current = crypto.randomUUID();
        setCatalogueModalOpen(false);
        setCatalogueReason('');
        messageApi.success(`Module ${catalogueAction}d`);
      },
      onError: () => messageApi.error(`Module could not be ${catalogueAction}d`),
    },
    request: { headers: { 'Idempotency-Key': idempotencyKey.current } },
  });

  return catalogue.isPending ? (
    <Flex align={'center'} justify={'center'} style={{ height: '100%', width: '100%' }}>
      <Spin />
    </Flex>
  ) : catalogue.data ? (
    <>
      {messageContext}
      <PageHeader />
      <ModuleBasicInfo />
      <Flex justify={'space-between'} align={'center'} style={{ marginBlock: 16 }}>
        <Flex gap={'small'} align={'center'}>
          <span>Catalogue status</span>
          <Tag color={catalogue.data?.status === 'archived' ? 'orange' : 'green'}>
            {catalogue.data?.status ?? 'loading'}
          </Tag>
        </Flex>
        <Button disabled={!canArchive} onClick={() => setCatalogueModalOpen(true)}>
          {catalogueAction === 'archive' ? 'Archive Module' : 'Reactivate Module'}
        </Button>
      </Flex>
      {catalogue.data?.status === 'archived' && (
        <Alert
          type={'warning'}
          showIcon
          message={'This Module is archived'}
          description={
            'No new versions, rules or Environment adoptions are accepted. Existing Environments and retained Rollback history remain unchanged.'
          }
        />
      )}
      <Tabs
        activeKey={tabMatch?.params.tab ?? 'configuration'}
        onChange={(key) => navigate(key)}
        items={[
          { label: 'Definition', key: 'configuration' },
          { label: 'Versions', key: 'versions' },
          { label: 'Environment Pins', key: 'pins' },
          { label: 'Rules', key: 'rules' },
        ]}
      />
      <Outlet />
      <Modal
        title={catalogueAction === 'archive' ? 'Archive Module' : 'Reactivate Module'}
        open={catalogueModalOpen}
        okText={catalogueAction === 'archive' ? 'Archive' : 'Reactivate'}
        okButtonProps={{
          danger: catalogueAction === 'archive',
          disabled: !canArchive || !catalogueReason.trim(),
        }}
        confirmLoading={changeCatalogue.isPending}
        onCancel={() => setCatalogueModalOpen(false)}
        onOk={() => {
          if (!catalogue.data || !canArchive) return;
          changeCatalogue.mutate({
            orgId,
            moduleId,
            catalogueAction,
            data: {
              expected_resource_version: catalogue.data.resource_version,
              reason: catalogueReason.trim(),
            },
          });
        }}>
        <Alert
          type={'info'}
          showIcon
          message={'This catalogue action does not deploy or destroy infrastructure'}
          style={{ marginBottom: 16 }}
        />
        <Input.TextArea
          aria-label={'Audited catalogue reason'}
          value={catalogueReason}
          onChange={(event) => setCatalogueReason(event.target.value)}
          rows={3}
          placeholder={'Audited reason'}
        />
      </Modal>
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
