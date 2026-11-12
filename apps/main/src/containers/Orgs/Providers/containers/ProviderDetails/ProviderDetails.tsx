import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Flex, message, Popconfirm, Spin, Tabs } from 'antd';
import { isAxiosError } from 'axios';
import React, { useEffect } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router';

import { ErrorPage } from '@src/components/shared/ErrorPage/ErrorPage';
import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { DataEntry } from '@src/components/shared/ui/DataEntry/DataEntry';
import { MatchParams } from '@src/config/routing';
import {
  getGetModuleProviderQueryKey,
  getListModuleProvidersQueryKey,
  useDeleteModuleProvider,
  useGetModuleProvider,
} from '@src/hooks/react-query/v2/controlplane/providers/providers';
import { getAllPagesQueryKey } from '@src/hooks/useFetchAllPages';
import { RBACPermission, RBACStatus, useRBAC } from '@src/hooks/useRBAC';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';

export const ProviderDetails = () => {
  // router
  const { orgId, providerId, providerType } = useParams<keyof MatchParams>() as MatchParams;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canDelete = useRBAC(RBACPermission.MODULE_PROVIDER_WRITE) === RBACStatus.ALLOWED;
  const [messageApi, messageContext] = message.useMessage();
  const requestDeletion = useDeleteModuleProvider({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getGetModuleProviderQueryKey(orgId, providerType, providerId),
        });
        await queryClient.invalidateQueries({
          queryKey: getAllPagesQueryKey(getListModuleProvidersQueryKey(orgId)),
        });
        messageApi.success('Provider deletion requested');
      },
      onError: () =>
        messageApi.error(
          'Provider deletion could not be requested. Check your permissions and whether Provider retirement is enabled.',
        ),
    },
  });

  // React Query
  const {
    data: provider,
    isPending: isProviderLoading,
    error,
  } = useGetModuleProvider(orgId, providerType, providerId, {
    query: {
      refetchInterval: (query) =>
        isAxiosError(query.state.error) && query.state.error.response?.status === 404
          ? false
          : query.state.data?.deletion_requested_at
            ? 5000
            : false,
      retry: (attempt, cause) =>
        !(isAxiosError(cause) && cause.response?.status === 404) && attempt < 3,
    },
  });

  const isRemoved = isAxiosError(error) && error.response?.status === 404;
  useEffect(() => {
    if (!isRemoved) return;
    void queryClient.invalidateQueries({
      queryKey: getAllPagesQueryKey(getListModuleProvidersQueryKey(orgId)),
    });
    if (provider?.deletion_requested_at) {
      navigate(`/orgs/${orgId}/providers`, { replace: true });
    }
  }, [isRemoved, navigate, orgId, provider?.deletion_requested_at, queryClient]);

  return isProviderLoading ? (
    <Flex align={'center'} justify={'center'} style={{ height: '100%', width: '100%' }}>
      <Spin />
    </Flex>
  ) : provider && !isRemoved ? (
    <>
      {messageContext}
      <PageHeader
        rightContent={
          <Popconfirm
            title={'Request Provider deletion?'}
            description={
              'Configuration stays available for cleanup until managed bindings are released. Workloads are not deleted by this request.'
            }
            onConfirm={() => requestDeletion.mutateAsync({ orgId, providerType, providerId })}
            okText={'Request deletion'}
            okButtonProps={{ danger: true }}
            disabled={!canDelete || Boolean(provider.deletion_requested_at)}>
            <Button
              danger
              disabled={!canDelete || Boolean(provider.deletion_requested_at)}
              loading={requestDeletion.isPending}>
              {provider.deletion_requested_at ? 'Deletion pending' : 'Request deletion'}
            </Button>
          </Popconfirm>
        }
      />
      {provider.deletion_requested_at && (
        <Alert
          type={'warning'}
          showIcon
          message={'Provider deletion is pending'}
          description={
            'The Provider configuration is retained while managed state or in-flight operations still need it. Update or remove those bindings to complete deletion.'
          }
        />
      )}
      <Flex gap={'middle'} wrap={'wrap'}>
        <DataEntry
          label={'Created at'}
          value={formatDate(provider?.created_at, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE)}
        />
        {provider.provider_type && <DataEntry label={'Type'} value={provider?.provider_type} />}
        {provider.source && <DataEntry label={'Source'} value={provider?.source} />}
        {provider.description && <DataEntry label={'Description'} value={provider?.description} />}
      </Flex>
      <Tabs
        onChange={(key) => navigate(key)}
        items={[
          {
            label: 'Configuration',
            key: 'configuration',
          },
        ]}
      />
      <Outlet />
    </>
  ) : (
    <ErrorPage
      title={'Provider not found'}
      buttons={
        <Button variant={'outlined'} href={`/orgs/${orgId}/providers`}>
          Go to providers list
        </Button>
      }
    />
  );
};
