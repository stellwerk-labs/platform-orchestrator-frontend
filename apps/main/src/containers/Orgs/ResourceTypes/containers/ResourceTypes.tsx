import { Empty, Flex, Table, TableColumnProps, Tag, Tooltip } from 'antd';
import React from 'react';
import { Link, useParams } from 'react-router';

import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { matchesSearch, TableToolbar, useTableSearch } from '@src/components/shared/TableToolbar';
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
  const search = useTableSearch();
  const filteredResourceTypes = allResourceTypes?.filter(
    (row) =>
      matchesSearch(search.query, row.id, row.description) &&
      (search.view === 'all' ||
        (search.view === 'archived'
          ? row.catalogue_status === 'archived'
          : search.view === 'accessible'
            ? row.is_developer_accessible
            : search.view === 'built_in'
              ? row.built_in
              : !row.built_in)),
  );

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
      render: (builtIn: boolean) => (builtIn ? 'Built in' : 'Custom'),
    },
    {
      title: 'Catalogue',
      dataIndex: 'catalogue_status',
      render: (status) => <Tag color={status === 'archived' ? 'orange' : 'green'}>{status}</Tag>,
    },
    {
      title: 'Created at',
      dataIndex: 'created_at',
      width: '300px',
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (value) => formatDate(value, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE),
    },
  ];

  return (
    <Flex vertical gap={'middle'}>
      <PageHeader />
      <TableToolbar
        label={'resource types'}
        {...search}
        filters={[
          { value: 'accessible', label: 'Developer accessible' },
          { value: 'built_in', label: 'Built-in' },
          { value: 'custom', label: 'Custom' },
          { value: 'archived', label: 'Archived' },
        ]}
      />
      <Table
        key={`${search.query}:${search.view}`}
        columns={columns}
        dataSource={filteredResourceTypes}
        rowKey={'id'}
        loading={resourceTypesLoading}
        size={'small'}
        locale={{
          emptyText:
            search.query || search.view !== 'all' ? (
              'No results match these filters.'
            ) : (
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
