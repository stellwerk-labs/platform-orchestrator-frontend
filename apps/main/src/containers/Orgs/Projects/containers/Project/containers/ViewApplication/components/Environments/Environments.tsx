import { Table, TableColumnProps } from 'antd';
import { Link, useParams } from 'react-router';

import { MatchParams } from '@src/config/routing';
import {
  getListEnvironmentsQueryKey,
  listEnvironments,
} from '@src/hooks/react-query/v2/controlplane/environment/environment';
import { getAllPagesQueryKey, useAllPages } from '@src/hooks/useFetchAllPages';
import { Environment } from '@src/models/v2/controlplane';
import { DATE_FORMATS_TYPES, formatDate } from '@src/utilities/datetime/datetime';

export const Environments = () => {
  // Router hooks
  const { orgId, projectId } = useParams<keyof MatchParams>() as MatchParams;

  // React Query
  const { data: allEnvironments, isFetching: areEnvironmentsLoading } = useAllPages(
    getAllPagesQueryKey(getListEnvironmentsQueryKey(orgId, projectId)),
    (params) => listEnvironments(orgId, projectId, params),
  );

  const columns: TableColumnProps<Environment>[] = [
    {
      title: 'Name',
      dataIndex: 'display_name',
      showSorterTooltip: { target: 'full-header' },
      key: 'display_name',
      onFilter: (value, record) => record.display_name.includes(value as string),
      filters: allEnvironments?.map((environment) => ({
        text: environment.display_name,
        value: environment.display_name,
      })),
      filterSearch: true,
      sorter: (a, b) => a.display_name.localeCompare(b.display_name),
      render: (_, env) => <Link to={env.id}>{env.display_name}</Link>,
    },
    {
      title: 'Type',
      dataIndex: 'env_type_id',
      key: 'env_type_id',
      sorter: (a, b) => a.env_type_id.length - b.env_type_id.length,
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      width: '300px',
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (value) => formatDate(value, DATE_FORMATS_TYPES.DATE_MONTH_YEAR_HOUR_MINUTE),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={allEnvironments}
      loading={areEnvironmentsLoading}
      rowKey={'id'}
      locale={{ emptyText: 'No environments available' }}
    />
  );
};
