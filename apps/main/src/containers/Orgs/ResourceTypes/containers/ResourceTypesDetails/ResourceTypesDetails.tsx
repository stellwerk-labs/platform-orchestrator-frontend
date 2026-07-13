import { Button, Flex, Spin, Tabs } from 'antd';
import React from 'react';
import { Outlet, useNavigate, useParams } from 'react-router';

import { ErrorPage } from '@src/components/shared/ErrorPage/ErrorPage';
import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { DataEntry } from '@src/components/shared/ui/DataEntry/DataEntry';
import { MatchParams } from '@src/config/routing';
import { useGetResourceType } from '@src/hooks/react-query/v2/controlplane/resource-type/resource-type';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';
import { generateResourceTypesUrl } from '@src/utilities/navigation';

export const ResourceTypesDetails = () => {
  // router
  const { orgId, resourceTypeId } = useParams<keyof MatchParams>() as MatchParams;
  const navigate = useNavigate();

  // React Query
  const { data: resourceType, isPending: isResourceTypeLoading } = useGetResourceType(
    orgId,
    resourceTypeId,
  );

  return isResourceTypeLoading ? (
    <Flex align={'center'} justify={'center'} style={{ height: '100%', width: '100%' }}>
      <Spin />
    </Flex>
  ) : resourceType ? (
    <>
      <PageHeader />
      <Flex gap={'middle'} wrap={'wrap'}>
        <DataEntry
          label={'Created at'}
          value={formatDate(
            resourceType?.created_at,
            DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE,
          )}
        />
        {resourceType.description && (
          <DataEntry label={'Description'} value={resourceType?.description} />
        )}
        {resourceType.is_developer_accessible && (
          <DataEntry
            label={'Accessible to developers'}
            value={resourceType?.is_developer_accessible ? 'Yes' : 'No'}
          />
        )}
        <DataEntry label={'Type'} value={resourceType.built_in ? 'Built in' : 'Custom'} />
      </Flex>
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
