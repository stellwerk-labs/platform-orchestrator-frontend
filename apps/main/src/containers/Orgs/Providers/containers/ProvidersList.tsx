import { Empty, Flex, Table, TableColumnProps, Tooltip } from 'antd';
import { formatDate } from 'date-fns';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

import { SearchInput } from '@src/components/shared/ui/SearchInput/SearchInput';
import { DOCS_GET_STARTED_EMPTY_STATE, DOCS_PROVIDERS } from '@src/config/docs-links';
import { MatchParams } from '@src/config/routing';
import {
  getListModuleProvidersQueryKey,
  listModuleProviders,
} from '@src/hooks/react-query/v2/controlplane/providers/providers';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { ModuleProviderSummary } from '@src/models/v2/controlplane';
import { DATE_FORMATS_TYPES } from '@src/utilities/datetime/datetime';
import { generateProviderDetailUrl } from '@src/utilities/navigation';

export const ProvidersList = () => {
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;
  // React Query
  const { data: allProviders, isLoading: runnersLoading } = useAllPages(
    getAllPagesQueryKey(getListModuleProvidersQueryKey(orgId)),
    (params) => listModuleProviders(orgId, params),
  );

  // state
  const [filteredProviders, setFilteredProviders] = useState<ModuleProviderSummary[] | undefined>();

  useEffect(() => {
    setFilteredProviders(allProviders);
  }, [allProviders]);

  const columns: TableColumnProps<ModuleProviderSummary>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      sorter: (a, b) => a.id.localeCompare(b.id),
      render: (_, provider) => (
        <Link
          to={generateProviderDetailUrl(orgId, provider.provider_type, provider.id)}
          tabIndex={0}>
          {provider.id}
        </Link>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'provider_type',
      sorter: (a, b) => a.provider_type.localeCompare(b.provider_type),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      ellipsis: {
        showTitle: false,
      },
      sorter: (a, b) => (a.description ?? '').localeCompare(b.description ?? ''),
      render: (description) =>
        description ? (
          <Tooltip title={description} mouseEnterDelay={1}>
            {description}
          </Tooltip>
        ) : (
          <span>-</span>
        ),
    },
    {
      title: 'Source',
      dataIndex: 'source',
      sorter: (a, b) => a.source.localeCompare(b.source),
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
    if (value) {
      setFilteredProviders(
        allProviders?.filter(
          (provider) =>
            provider.id.toLowerCase().includes(value) ||
            provider.provider_type.toLowerCase().includes(value.toLowerCase()),
        ),
      );
    } else {
      setFilteredProviders(allProviders);
    }
  };

  return (
    <Flex vertical gap={'middle'} justify={'center'}>
      <SearchInput onChange={handleSearchChange} placeholder={'Filter providers'} />
      <Table
        columns={columns}
        dataSource={filteredProviders}
        rowKey={(record) => record.id + record.provider_type}
        loading={runnersLoading}
        size={'small'}
        locale={{
          emptyText: (
            <Empty
              description={
                <>
                  No providers found, see{' '}
                  <a href={DOCS_PROVIDERS} target={'_blank'} rel={'noreferrer noopener'}>
                    providers docs
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
