import { Empty, Table, TableColumnProps } from 'antd';
import React from 'react';
import { useParams } from 'react-router';

import { PageHeader } from '@src/components/shared/PageHeader/PageHeader';
import { DOCS_ENVIRONMENT_TYPES, DOCS_GET_STARTED_EMPTY_STATE } from '@src/config/docs-links';
import { MatchParams } from '@src/config/routing';
import {
  getListEnvironmentTypesQueryKey,
  listEnvironmentTypes,
} from '@src/hooks/react-query/v2/controlplane/environment-type/environment-type';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { EnvironmentType } from '@src/models/v2/controlplane';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';

export const EnvironmentTypes = () => {
  // router
  const { orgId } = useParams<keyof MatchParams>() as MatchParams;

  // React Query
  const { data: allEnvTypes, isFetching: envTypesLoading } = useAllPages(
    getAllPagesQueryKey(getListEnvironmentTypesQueryKey(orgId)),
    (params) => listEnvironmentTypes(orgId, params),
  );

  const columns: TableColumnProps<EnvironmentType>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      sorter: (a, b) => a.id.localeCompare(b.id),
    },
    {
      title: 'Display name',
      dataIndex: 'display_name',
      sorter: (a, b) => a.display_name.localeCompare(b.id),
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
    <>
      <PageHeader />
      <Table
        columns={columns}
        dataSource={allEnvTypes}
        rowKey={'id'}
        loading={envTypesLoading}
        size={'small'}
        locale={{
          emptyText: (
            <Empty
              description={
                <>
                  No environment types found, see{' '}
                  <a href={DOCS_ENVIRONMENT_TYPES} target={'_blank'} rel={'noreferrer noopener'}>
                    environment types docs
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
    </>
  );
};
