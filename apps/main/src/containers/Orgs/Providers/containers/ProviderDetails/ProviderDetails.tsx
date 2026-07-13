import { Button, Flex, Spin, Tabs } from 'antd';
import React from 'react';
import { Outlet, useNavigate, useParams } from 'react-router';

import { ErrorPage } from '@src/components/shared/ErrorPage/ErrorPage';
import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { DataEntry } from '@src/components/shared/ui/DataEntry/DataEntry';
import { MatchParams } from '@src/config/routing';
import { useGetModuleProvider } from '@src/hooks/react-query/v2/controlplane/providers/providers';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';

export const ProviderDetails = () => {
  // router
  const { orgId, providerId, providerType } = useParams<keyof MatchParams>() as MatchParams;
  const navigate = useNavigate();

  // React Query
  const { data: provider, isPending: isProviderLoading } = useGetModuleProvider(
    orgId,
    providerType,
    providerId,
  );

  return isProviderLoading ? (
    <Flex align={'center'} justify={'center'} style={{ height: '100%', width: '100%' }}>
      <Spin />
    </Flex>
  ) : provider ? (
    <>
      <PageHeader />
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
