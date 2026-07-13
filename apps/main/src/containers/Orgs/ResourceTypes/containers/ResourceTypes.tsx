import { Empty, Flex, Table, TableColumnProps, Tooltip } from 'antd';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { SearchInput } from '@src/components/shared/ui/SearchInput/SearchInput';
import {
  DOCS_GET_STARTED_EMPTY_STATE,
  DOCS_RESOURCE_TYPES_EMPTY_STATE,
} from '@src/config/docs-links';
import { MatchParams } from '@src/config/routing';
import {
  getListResourceTypesQueryKey,
  listResourceTypes,
} from '@src/hooks/react-query/v2/controlplane/resource-type/resource-type';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { ResourceType } from '@src/models/v2/controlplane';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';
import { generateResourceTypeDetailsUrl } from '@src/utilities/navigation';

export const ResourceTypes = () => {
  // Router hooks
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  // React Query
  const { data: allResourceTypes, isFetching: resourceTypesLoading } = useAllPages(
    getAllPagesQueryKey(getListResourceTypesQueryKey(orgId)),
    (params) => listResourceTypes(orgId, params),
  );
  // state
  const [filteredResourceTypes, setFilteredResourceTypes] = useState<ResourceType[] | undefined>();

  useEffect(() => {
    setFilteredResourceTypes(allResourceTypes);
  }, [allResourceTypes]);

  const columns: TableColumnProps<ResourceType>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      ellipsis: true,
      sorter: (a, b) => a.id.localeCompare(b.id),
      render: (resourceTypeId) => (
        <Link to={generateResourceTypeDetailsUrl(orgId, resourceTypeId)} tabIndex={0}>
          {resourceTypeId}
        </Link>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      ellipsis: {
        showTitle: false,
      },
      sorter: (a, b) => (a.description ?? '').localeCompare(b.description ?? ''),
      render: (description) => (
        <Tooltip title={description} mouseEnterDelay={1}>
          {description}
        </Tooltip>
      ),
    },
    {
      title: 'Accessible to developers',
      dataIndex: 'is_developer_accessible',
      ellipsis: true,
      render: (_, { is_developer_accessible }) => (is_developer_accessible ? 'Yes' : 'No'),
    },
    {
      title: 'Type',
      dataIndex: 'built_in',
      ellipsis: true,
      render: (record) => (record.built_in ? 'Built in' : 'Custom'),
    },
    {
      title: 'Created at',
      dataIndex: 'created_at',
      width: '300px',
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (value) => formatDate(value, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE),
    },
  ];

  const handleSearchChange = (value: string) => {
    setFilteredResourceTypes(
      allResourceTypes?.filter((resourceType) => resourceType.id.includes(value)),
    );
  };

  return (
    <Flex vertical gap={'middle'}>
      <PageHeader />
      <SearchInput onChange={handleSearchChange} placeholder={'Filter resource types'} />
      <Table
        columns={columns}
        dataSource={filteredResourceTypes}
        rowKey={'id'}
        loading={resourceTypesLoading}
        size={'small'}
        locale={{
          emptyText: (
            <Empty
              description={
                <>
                  No resource types found, see{' '}
                  <a
                    href={DOCS_RESOURCE_TYPES_EMPTY_STATE}
                    target={'_blank'}
                    rel={'noreferrer noopener'}>
                    resource types docs
                  </a>{' '}
                  for details, or follow the{' '}
                  <a
                    href={DOCS_GET_STARTED_EMPTY_STATE}
                    target={'_blank'}
                    rel={'noreferrer noopener'}>
                    tutorial
                  </a>{' '}
                  to explore the full setup flow.
                </>
              }
              styles={{ image: { display: 'none' } }}
            />
          ),
        }}
      />
    </Flex>
  );
};
