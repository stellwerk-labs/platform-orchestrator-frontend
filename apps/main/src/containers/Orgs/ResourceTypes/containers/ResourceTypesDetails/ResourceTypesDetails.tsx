import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Flex, Input, message, Modal, Spin, Tabs, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router';

import { ErrorPage } from '@src/components/shared/ErrorPage/ErrorPage';
import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { DataEntry } from '@src/components/shared/ui/DataEntry/DataEntry';
import { MatchParams } from '@src/config/routing';
import {
  getGetResourceTypeQueryKey,
  useChangeResourceTypeCatalogueStatus,
  useGetResourceType,
} from '@src/hooks/react-query/v2/controlplane/resource-type/resource-type';
import { RBACPermission, RBACStatus, useRBAC } from '@src/hooks/useRBAC';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';
import { generateResourceTypesUrl } from '@src/utilities/navigation';

export const ResourceTypesDetails = () => {
  // router
  const { orgId, resourceTypeId } = useParams<keyof MatchParams>() as MatchParams;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messageApi, messageContext] = message.useMessage();
  const [catalogueModalOpen, setCatalogueModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const idempotencyKey = useRef(crypto.randomUUID());
  const canManage = useRBAC(RBACPermission.RESOURCE_TYPE_WRITE) === RBACStatus.ALLOWED;

  // React Query
  const { data: resourceType, isPending: isResourceTypeLoading } = useGetResourceType(
    orgId,
    resourceTypeId,
  );
  const catalogueAction = resourceType?.catalogue_status === 'archived' ? 'unarchive' : 'archive';
  const changeCatalogue = useChangeResourceTypeCatalogueStatus({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getGetResourceTypeQueryKey(orgId, resourceTypeId),
        });
        idempotencyKey.current = crypto.randomUUID();
        setCatalogueModalOpen(false);
        setReason('');
        messageApi.success(`Resource Type ${catalogueAction}d`);
      },
      onError: () => messageApi.error(`Resource Type could not be ${catalogueAction}d`),
    },
    request: { headers: { 'Idempotency-Key': idempotencyKey.current } },
  });

  return isResourceTypeLoading ? (
    <Flex align={'center'} justify={'center'} style={{ height: '100%', width: '100%' }}>
      <Spin />
    </Flex>
  ) : resourceType ? (
    <>
      {messageContext}
      <PageHeader />
      <Flex justify={'space-between'} align={'flex-start'} gap={'middle'}>
        <Flex gap={'middle'} wrap={'wrap'}>
          <DataEntry
            label={'Created at'}
            value={formatDate(
              resourceType.created_at,
              DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE,
            )}
          />
          {resourceType.description && (
            <DataEntry label={'Description'} value={resourceType.description} />
          )}
          <DataEntry
            label={'Accessible to developers'}
            value={resourceType.is_developer_accessible ? 'Yes' : 'No'}
          />
          <DataEntry label={'Type'} value={resourceType.built_in ? 'Built in' : 'Custom'} />
          <Flex vertical gap={4}>
            <span>Catalogue status</span>
            <Tag color={resourceType.catalogue_status === 'archived' ? 'orange' : 'green'}>
              {resourceType.catalogue_status}
            </Tag>
          </Flex>
        </Flex>
        {!resourceType.built_in && (
          <Button
            disabled={!canManage}
            danger={catalogueAction === 'archive'}
            onClick={() => setCatalogueModalOpen(true)}>
            {catalogueAction === 'archive' ? 'Archive Resource Type' : 'Reactivate Resource Type'}
          </Button>
        )}
      </Flex>
      {resourceType.catalogue_status === 'archived' && (
        <Alert
          type={'warning'}
          showIcon
          message={'New Modules cannot bind this Resource Type'}
          description={
            'Existing Modules keep their immutable binding and remain fully manageable and deployable.'
          }
          style={{ marginTop: 16 }}
        />
      )}
      <Tabs
        onChange={(key) => navigate(key)}
        items={[
          {
            label: 'Schema',
            key: 'schema',
          },
        ]}
      />
      <Outlet />
      <Modal
        title={catalogueAction === 'archive' ? 'Archive Resource Type' : 'Reactivate Resource Type'}
        open={catalogueModalOpen}
        okText={catalogueAction === 'archive' ? 'Archive' : 'Reactivate'}
        okButtonProps={{
          danger: catalogueAction === 'archive',
          disabled: !canManage || !reason.trim(),
        }}
        confirmLoading={changeCatalogue.isPending}
        onCancel={() => setCatalogueModalOpen(false)}
        onOk={() =>
          canManage &&
          changeCatalogue.mutate({
            orgId,
            typeId: resourceTypeId,
            catalogueAction,
            data: {
              expected_resource_version: resourceType.resource_version,
              reason: reason.trim(),
            },
          })
        }>
        <Alert
          type={'info'}
          showIcon
          message={'The immutable contract and existing Module bindings are unchanged'}
          style={{ marginBottom: 16 }}
        />
        <Input.TextArea
          aria-label={'Audited Resource Type catalogue reason'}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          placeholder={'Audited reason'}
        />
      </Modal>
    </>
  ) : (
    <ErrorPage
      title={'Environment type not found'}
      buttons={
        <Button variant={'outlined'} href={generateResourceTypesUrl(orgId)}>
          Go to resource type list
        </Button>
      }
    />
  );
};
